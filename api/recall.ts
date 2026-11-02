// Explicit recall — powers the MCP engram_recall tool and search endpoints.
import {
  memwalFor,
  normalizeRecall,
  decodeMemory,
  recallMaxDistance,
  type Scope,
} from "./_lib/memwal.js";
import { getUserFromRequest, authorizeMemoryAccess } from "./_lib/auth.js";
import { checkAndIncrementUsage } from "./_lib/db.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";
import { computeContentHash, verifyMemoryIntegrity } from "./_lib/storage.js";

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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "GET or POST only" });
  }

  const rawUrl = req.url || "";
  const searchParams = new URLSearchParams(rawUrl.split("?")[1] || "");
  const source = req.method === "GET" ? { ...Object.fromEntries(searchParams.entries()), ...(req.query || {}) } : (req.body ?? {});

  const query = String(source.query ?? "");
  const scope = (source.scope === "team" ? "team" : "personal") as Scope;
  const teamCode = String(source.teamCode ?? "default");
  const topK = Number(source.topK ?? 10) || 10;
  const includeSuperseded = source.includeSuperseded === true || source.includeSuperseded === "true";

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: authentication required to access memory." });
  }

  // Centralized authorization enforcement
  const authRes = await authorizeMemoryAccess({
    user,
    requestedScope: scope,
    requestedTeamCode: teamCode,
  });

  if (!authRes.authorized) {
    return res.status(authRes.statusCode || 403).json({ error: authRes.error });
  }

  const effectiveScope = authRes.effectiveScope;
  const effectiveTeamId = authRes.effectiveTeamId;

  await checkAndIncrementUsage({
    entityType: effectiveScope === "team" ? "team" : "user",
    entityId: effectiveScope === "team" ? effectiveTeamId! : user.id,
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

      if (effectiveScope === "team" && effectiveTeamId) {
        q = q.eq("team_id", effectiveTeamId);
      } else {
        q = q.eq("user_id", user.id).is("team_id", null);
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
              const { verified, actualHash } = verifyMemoryIntegrity(row.text || '', row.type || 'note', row.content_hash);
              combined.push({
                id: row.id,
                type: row.type || "note",
                text: row.text,
                blobId: row.blob_id,
                contentHash: actualHash,
                integrityVerified: verified,
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
  const ns = effectiveScope === "team" ? effectiveTeamId! : `usr_${user.id}`;
  const mem = memwalFor(effectiveScope as Scope, ns);
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
      const { verified, actualHash } = verifyMemoryIntegrity(decoded.text, decoded.type);
      combined.push({
        type: decoded.type,
        text: decoded.text,
        blobId: m.blobId,
        contentHash: actualHash,
        integrityVerified: verified,
        isSuperseded,
        supersededBy,
        score: scoreMemoryMatch(decoded.text, decoded.type, query) + 0.5,
      });
    }
  } catch {}

  let results = combined
    .filter((m) => includeSuperseded || !m.isSuperseded)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(topK) || 50)
    .map(({ score: _score, ...rest }) => rest);

  const format = source.format || "json";
  if (format === "text") {
    const textOutput =
      results.length > 0
        ? results
            .map(
              (m, i) =>
                `• (${m.type}) ${i + 1}. ${m.text}${
                  m.blobId ? ` [walrus:${m.blobId.slice(0, 8)}...]` : ""
                }`
            )
            .join("\n")
        : "No memories stored yet.";
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(textOutput);
  }

  res.status(200).json({ ok: true, count: results.length, results, memories: results });
}
