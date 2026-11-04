// Explicit recall — powers the MCP engram_recall tool and search endpoints with hybrid scoring.
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
import { verifyMemoryIntegrity } from "./_lib/storage.js";
import {
  scoreMemoryHybrid,
  mapSubtypeToCategory,
  extractEntities,
  type StructuredMemory,
} from "./_lib/intelligence.js";

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
  let scope = (source.scope === "team" ? "team" : "personal") as Scope;
  const teamCode = String(source.teamCode ?? "default");
  const topK = Number(source.topK ?? 10) || 10;
  const includeSuperseded = source.includeSuperseded === true || source.includeSuperseded === "true";
  const categoryFilter = source.category ? String(source.category).toLowerCase() : undefined;

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: this Engram key is missing, expired or revoked. Create a new key at https://engram-pearl.vercel.app/dashboard?tab=keys and update your app.", code: "KEY_INVALID" });
  }
  if (!source.scope && (user as any).apiKey?.scope === "team") scope = "team";

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

  const combined: any[] = [];
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

          const key = String(row.text || "").trim().toLowerCase();
          if (!seenTexts.has(key)) {
            seenTexts.add(key);
            const { verified, actualHash } = verifyMemoryIntegrity(row.text || '', row.type || 'note', row.content_hash);
            const { category, subtype } = mapSubtypeToCategory(row.type || 'note');

            const structured: StructuredMemory = {
              id: row.id,
              userId: user.id,
              teamId: effectiveTeamId,
              scope: effectiveScope,
              category,
              subtype,
              text: row.text,
              entities: extractEntities(row.text),
              confidence: 1.0,
              importance: (row.type === 'decision' ? 4 : 3),
              sensitivity: 'internal',
              status: isSuperseded ? 'superseded' : 'active',
              source: 'explicit_user',
              version: 1,
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.created_at || new Date().toISOString(),
              blobId: row.blob_id,
              contentHash: actualHash,
            };

            const scored = scoreMemoryHybrid(structured, query);
            combined.push({
              ...scored,
              type: subtype, // backward-compat for existing clients
              isSuperseded,
              supersededBy,
              integrityVerified: verified,
            });
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
      const { category, subtype } = mapSubtypeToCategory(decoded.type);

      const structured: StructuredMemory = {
        id: `walrus-${combined.length + 1}`,
        userId: user.id,
        teamId: effectiveTeamId,
        scope: effectiveScope,
        category,
        subtype,
        text: decoded.text,
        entities: extractEntities(decoded.text),
        confidence: 1.0,
        importance: (decoded.type === 'decision' ? 4 : 3),
        sensitivity: 'internal',
        status: isSuperseded ? 'superseded' : 'active',
        source: 'explicit_user',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        blobId: m.blobId,
        contentHash: actualHash,
      };

      const scored = scoreMemoryHybrid(structured, query);
      combined.push({
        ...scored,
        type: subtype,
        isSuperseded,
        supersededBy,
        integrityVerified: verified,
      });
    }
  } catch {}

  let results = combined
    .filter((m) => includeSuperseded || (!m.isSuperseded && m.status !== 'superseded'))
    .filter((m) => !categoryFilter || categoryFilter === 'all' || m.category === categoryFilter || m.subtype === categoryFilter)
    .filter((m) => (query ? m.score > 0.05 : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(topK) || 50);

  const format = source.format || "json";

  if (results.length === 0) {
    if (format === "text") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(`No relevant memories in ${effectiveScope} scope for "${query}".`);
    }
    return res.status(200).json({
      ok: true,
      count: 0,
      confidence: "uncertain",
      reason: `No memories in ${effectiveScope} scope matched query "${query}" with sufficient evidence.`,
      results: [],
      memories: [],
    });
  }

  if (format === "text") {
    const textOutput = results
      .map(
        (m, i) =>
          `• (${m.type}) ${i + 1}. ${m.text}${
            m.blobId ? ` [walrus:${m.blobId.slice(0, 8)}...]` : ""
          }`
      )
      .join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(textOutput);
  }

  res.status(200).json({
    ok: true,
    count: results.length,
    confidence: results[0].score >= 0.4 ? "high" : "medium",
    results,
    memories: results,
  });
}
