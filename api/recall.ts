// REST recall (Python SDK, scripts, shortcuts). Same search as the MCP engram_recall tool:
// database full text with word forms, prefixes and typo tolerance, widened with related terms
// when few memories match. Replaced memories are left out unless asked for.
import { decodeMemory, type Scope } from "./_lib/memwal.js";
import { getUserFromRequest, authorizeMemoryAccess, keyCan, permissionError } from "./_lib/auth.js";
import { checkAndIncrementUsage } from "./_lib/db.js";
import { fetchScopeRows, isSupersededRow, rank, searchMemories, supersededByOf, type MemoryRow } from "./_lib/search.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";
import { sanitizeMemoryText } from "./_lib/security.js";
import { expandQueryTerms } from "./_lib/llm.js";
import { mapSubtypeToCategory, extractEntities } from "./_lib/intelligence.js";

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

  const query = String(source.query ?? source.q ?? "").trim().slice(0, 500);
  let scope = (source.scope === "team" ? "team" : "personal") as Scope;
  const teamCode = String(source.teamCode ?? "default");
  const topK = Math.min(Math.max(Number(source.topK ?? 10) || 10, 1), 50);
  const includeSuperseded = source.includeSuperseded === true || source.includeSuperseded === "true";
  const categoryFilter = source.category ? String(source.category).toLowerCase() : undefined;

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: this Engram key is missing, expired or revoked. Create a new key at https://engram-pearl.vercel.app/dashboard?tab=keys and update your app.", code: "KEY_INVALID" });
  }
  if (!source.scope && (user as any).apiKey?.scope === "team") scope = "team";
  if (!keyCan(user, "read")) {
    return res.status(403).json({ error: permissionError("read"), code: "KEY_PERMISSION" });
  }

  const authRes = await authorizeMemoryAccess({ user, requestedScope: scope, requestedTeamCode: teamCode });
  if (!authRes.authorized) {
    return res.status(authRes.statusCode || 403).json({ error: authRes.error });
  }
  const effectiveScope = authRes.effectiveScope as Scope;
  const teamId = effectiveScope === "team" ? authRes.effectiveTeamId : null;

  await checkAndIncrementUsage({
    entityType: effectiveScope === "team" ? "team" : "user",
    entityId: effectiveScope === "team" ? teamId! : user.id,
    operation: "recall",
    planTier: user.plan_tier,
  }).catch(() => {});

  const supabase = getSupabaseAdmin();
  let rows: Array<MemoryRow & { rank?: number }> = [];
  let expanded: string[] = [];
  if (supabase) {
    try {
      if (!query) {
        rows = (await fetchScopeRows(supabase, { scope: effectiveScope, userId: user.id, teamId, limit: 200 }))
          .filter((r) => includeSuperseded || !isSupersededRow(r));
      } else if (!includeSuperseded) {
        const found = await searchMemories(supabase, {
          scope: effectiveScope,
          userId: user.id,
          teamId,
          query,
          limit: Math.max(topK, 20),
          expand: expandQueryTerms,
        });
        rows = found.rows;
        expanded = found.expanded;
      } else {
        // History view: the lexical ranking over recent rows, replaced memories included.
        const recent = await fetchScopeRows(supabase, { scope: effectiveScope, userId: user.id, teamId, limit: 500 });
        rows = rank(recent, query, (r) => r.text, (r) => r.type).map((x) => ({ ...x.row, rank: x.score }));
      }
    } catch (err: any) {
      console.error("[api/recall] search failed:", err?.message || err);
      return res.status(500).json({ error: "Search failed. Try again." });
    }
  }

  const results = rows
    .map((row, i) => {
      const text = decodeMemory(sanitizeMemoryText(row.text)).text;
      const { category, subtype } = mapSubtypeToCategory(row.type || "decision");
      return {
        id: row.id,
        type: row.type || subtype,
        text,
        category,
        subtype,
        entities: extractEntities(text),
        createdAt: row.created_at,
        blobId: row.blob_id,
        // Rank from the database search when available; otherwise position-based.
        score: typeof row.rank === "number" ? Number(row.rank.toFixed(4)) : Number((1 / (i + 1)).toFixed(4)),
        confidence: 1.0,
        importance: row.type === "decision" ? 4 : 3,
        isSuperseded: isSupersededRow(row),
        supersededBy: supersededByOf(row),
      };
    })
    .filter((m) => !categoryFilter || categoryFilter === "all" || m.category === categoryFilter || m.subtype === categoryFilter || m.type === categoryFilter)
    .slice(0, topK);

  const format = source.format || "json";
  if (format === "text") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    if (!results.length) return res.status(200).send(`No memories in ${effectiveScope} scope match "${query}".`);
    return res
      .status(200)
      .send(results.map((m, i) => `${i + 1}. [${m.type}] ${m.text} (saved ${String(m.createdAt || "").slice(0, 10) || "unknown date"})`).join("\n"));
  }

  if (!results.length) {
    return res.status(200).json({
      ok: true,
      count: 0,
      confidence: "uncertain",
      reason: query ? `No memories in ${effectiveScope} scope match "${query}".` : `No memories in ${effectiveScope} scope yet.`,
      results: [],
      memories: [],
    });
  }

  res.status(200).json({
    ok: true,
    count: results.length,
    // "medium" when fewer than three memories matched the caller's own words and related terms were added.
    confidence: expanded.length ? "medium" : "high",
    expandedTerms: expanded,
    results,
    memories: results,
  });
}
