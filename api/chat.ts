// Main agent turn: recall relevant memories -> answer -> auto-capture new
// durable memories. Returns the reply plus what was recalled and remembered
// (with blob ids) so the UI can show proof.
import {
  memwalFor,
  normalizeRecall,
  decodeMemory,
  encodeMemory,
  blobIdOf,
  recallMaxDistance,
  type Scope,
} from "./_lib/memwal.js";
import { buildSystemPrompt } from "./_lib/prompt.js";
import { generateReply, extractFacts, type ChatMsg } from "./_lib/llm.js";
import { getUserFromRequest } from "./_lib/auth.js";
import { isTeamMember } from "./_lib/db.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";
import { scanForSecrets, sanitizeMemoryText } from "./_lib/security.js";

function scoreQueryMatch(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const words = q.replace(/[^a-z0-9\s_-]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return 1;
  const lower = text.toLowerCase();
  let score = 0;
  if (lower.includes(q)) score += 5;
  for (const w of words) {
    if (lower.includes(w)) score += 1;
  }
  return score;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { messages = [], scope = "personal", teamCode = "default", model } = req.body ?? {};

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: authentication required to access chat agent." });
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

  const ns = scope === "team" ? teamCode : `usr_${user.id}`;
  const mem = memwalFor(scope as Scope, ns);
  const lastUser =
    [...messages].reverse().find((m: ChatMsg) => m.role === "user")?.content ?? "";

  // 1. RECALL (Walrus + Supabase memories_meta)
  let recalled: { type: string; text: string; blobId?: string }[] = [];
  const seenTexts = new Set<string>();
  try {
    const r = await mem.recall({ query: lastUser, topK: 6, maxDistance: recallMaxDistance() });
    for (const m of normalizeRecall(r)) {
      const dec = decodeMemory(sanitizeMemoryText(m.text));
      const key = dec.text.toLowerCase();
      if (!seenTexts.has(key)) {
        seenTexts.add(key);
        recalled.push({ type: dec.type, text: dec.text, blobId: m.blobId });
      }
    }
  } catch (e) {
    console.error("recall failed", e);
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      let query = supabase
        .from("memories_meta")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (scope === "team" && teamCode && teamCode !== "default") {
        query = query.eq("team_id", teamCode);
      } else {
        query = query.eq("user_id", user.id).is("team_id", null);
      }

      const { data: metaRows } = await query;
      if (metaRows && metaRows.length > 0) {
        const activeRows = metaRows
          .filter((r: any) => !(r.room || "").startsWith("superseded_by:"))
          .map((r: any) => {
            const dec = decodeMemory(sanitizeMemoryText(r.text));
            return {
              type: r.type || dec.type || "decision",
              text: dec.text,
              blobId: r.blob_id || undefined,
              score: scoreQueryMatch(lastUser, `${r.type || ""} ${dec.text}`),
            };
          })
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score);

        for (const r of activeRows) {
          const key = r.text.toLowerCase();
          if (!seenTexts.has(key) && recalled.length < 6) {
            seenTexts.add(key);
            recalled.push({ type: r.type, text: r.text, blobId: r.blobId });
          }
        }
      }
    } catch (e) {
      console.error("supabase recall failed", e);
    }
  }

  // 2. ANSWER
  const system = buildSystemPrompt(recalled, scope);
  const reply = await generateReply(system, messages, model);

  // 3. REMEMBER (auto-capture per the rules)
  const remembered: { type: string; text: string; blobId?: string }[] = [];
  try {
    const facts = await extractFacts(lastUser, reply, model);
    for (const f of facts) {
      if (scanForSecrets(f.text).hasSecret) continue;
      const cleanFact = sanitizeMemoryText(f.text);
      let blobId: string | undefined;
      try {
        const job = await mem.rememberAndWait(encodeMemory(f.type, cleanFact), undefined, {
          timeoutMs: 30_000,
        });
        blobId = blobIdOf(job);
      } catch (e) {
        console.warn("walrus auto-remember warning:", e);
      }
      if (supabase) {
        await supabase.from("memories_meta").insert({
          user_id: user.id,
          team_id: scope === "team" ? (teamCode !== "default" ? teamCode : null) : null,
          room: "my-space",
          type: f.type,
          text: cleanFact,
          blob_id: blobId ?? null,
        });
      }
      remembered.push({ type: f.type, text: cleanFact, blobId });
    }
  } catch (e) {
    console.error("remember failed", e);
  }

  res.status(200).json({ reply, recalled, remembered, scope });
}
