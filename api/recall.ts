// Explicit recall — powers the MCP engram_recall tool and search endpoints.
import {
  memwalFor,
  normalizeRecall,
  decodeMemory,
  recallMaxDistance,
  type Scope,
} from "./_lib/memwal.js";
import { getUserFromRequest } from "./_lib/auth.js";
import { checkAndIncrementUsage, isTeamMember } from "./_lib/db.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";

function scoreMemoryMatch(text: string, type: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const hay = `${type} ${text}`.toLowerCase();
  if (hay.includes(q)) return 10;

  const words = q
    .split(/[^a-z0-9_]+/)
    .filter((w) => w.length >= 2 && !["the", "and", "for", "with", "what", "how", "our", "are", "was"].includes(w));
  if (words.length === 0) return 1;

  let hits = 0;
  for (const w of words) {
    if (hay.includes(w)) hits += 1;
  }
  return hits / words.length;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { query = "", scope = "personal", teamCode = "default", topK = 10, includeSuperseded = false } = req.body ?? {};

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: authentication required to access memory." });
  }

  if (scope === "team") {
    if (!teamCode || teamCode === "default") {
      return res.status(400).json({ error: "teamCode (team ID) is required for team scope." });
    }
    const isMember = await isTeamMember(user.id, teamCode);
    if (!isMember) {
      return res.status(403).json({ error: "Forbidden: you are not an active member of this team." });
    }
  }

  await checkAndIncrementUsage({
    entityType: scope === "team" ? "team" : "user",
    entityId: scope === "team" ? teamCode : user.id,
    operation: "recall",
    planTier: user.plan_tier,
  }).catch(() => {});

  const combined: Array<{
    id?: string;
    type: string;
    text: string;
    blobId?: string;
    isSuperseded: boolean;
    supersededBy: string | null;
    score: number;
  }> = [];
  const seenTexts = new Set<string>();
  const supersededMap = new Map<string, string>();

  // 1. Query Supabase memories_meta (includes migrated Walrus memories + pinned cloud memories)
  const supabase = getSupabaseAdmin();
  if (supabase && user) {
    try {
      let q = supabase
        .from("memories_meta")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (scope === "team" && teamCode !== "default") {
        q = q.eq("team_id", teamCode);
      } else {
        q = q.eq("user_id", user.id);
      }

      const { data: rows } = await q;
      if (rows) {
        for (const row of rows) {
          const isSuperseded = Boolean(row.room && row.room.startsWith("superseded_by:"));
          const supersededBy = isSuperseded ? row.room.replace("superseded_by:", "") : null;
          if (isSuperseded && row.blob_id) {
            supersededMap.set(row.blob_id, supersededBy || "latest");
          }
          const score = scoreMemoryMatch(row.text || "", row.type || "note", query);
          if (score > 0) {
            const key = String(row.text || "").trim().toLowerCase();
            if (!seenTexts.has(key)) {
              seenTexts.add(key);
              combined.push({
                id: row.id,
                type: row.type || "note",
                text: row.text,
                blobId: row.blob_id,
                isSuperseded,
                supersededBy,
                score,
              });
            }
          }
        }
      }
    } catch {}
  }

  // 2. Also query live Walrus / MemWal namespace and merge
  const ns = scope === "team" ? teamCode : `usr_${user.id}`;
  const mem = memwalFor(scope as Scope, ns);
  try {
    const r = await Promise.race([
      mem.recall({ query: query || " ", topK, maxDistance: recallMaxDistance() }),
      new Promise((resolve) => setTimeout(() => resolve([]), 3500)),
    ]);
    for (const m of normalizeRecall(r)) {
      const decoded = decodeMemory(m.text);
      const key = decoded.text.trim().toLowerCase();
      if (seenTexts.has(key)) continue;
      seenTexts.add(key);
      const isSuperseded = m.blobId ? supersededMap.has(m.blobId) : false;
      const supersededBy = m.blobId ? supersededMap.get(m.blobId) || null : null;
      combined.push({
        type: decoded.type,
        text: decoded.text,
        blobId: m.blobId,
        isSuperseded,
        supersededBy,
        score: scoreMemoryMatch(decoded.text, decoded.type, query) + 0.5,
      });
    }
  } catch {}

  let results = combined
    .filter((m) => includeSuperseded || !m.isSuperseded)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(topK) || 10)
    .map(({ score: _score, ...rest }) => rest);

  res.status(200).json({ ok: true, results });
}
