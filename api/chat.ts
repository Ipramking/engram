// Main agent turn: recall relevant memories -> answer -> auto-capture new
// durable memories. Returns the reply plus what was recalled and remembered
// (with blob ids) so the UI can show proof.
import {
  memwalFor,
  normalizeRecall,
  decodeMemory,
  recallMaxDistance,
  type Scope,
} from "./_lib/memwal.js";
import { buildSystemPrompt } from "./_lib/prompt.js";
import { generateReply, extractFacts, type ChatMsg } from "./_lib/llm.js";
import { getUserFromRequest, authorizeMemoryAccess, keyCan, permissionError } from "./_lib/auth.js";
import { checkAndIncrementUsage, getUsage } from "./_lib/db.js";
import { executeMemoryCreationLifecycle } from "./_lib/lifecycle.js";

// Chat spends the server's LLM key, so the model is never client-controlled and inputs are capped.
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 40000;
const CHAT_DAILY_LIMIT = 100;
import { getSupabaseAdmin } from "./_lib/supabase.js";
import { sanitizeMemoryText } from "./_lib/security.js";

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

  const { messages: rawMessages = [], scope: requestedScope = "personal", teamCode: requestedTeamCode = "default" } = req.body ?? {};
  const model = undefined;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `Send between 1 and ${MAX_MESSAGES} messages.` });
  }
  const messages: ChatMsg[] = rawMessages
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  if (messages.reduce((n, m) => n + m.content.length, 0) > MAX_TOTAL_CHARS) {
    return res.status(413).json({ error: "Conversation too long. Start a new chat." });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: authentication required to access chat agent." });
  }

  if (!keyCan(user, "manage")) {
    return res.status(403).json({ error: permissionError("manage"), code: "KEY_PERMISSION" });
  }
  const auth = await authorizeMemoryAccess({ user, requestedScope, requestedTeamCode });
  if (!auth.authorized) return res.status(auth.statusCode || 403).json({ error: auth.error });
  const scope = auth.effectiveScope as Scope;
  const teamCode = auth.effectiveTeamId || "default";
  // Each chat turn spends LLM budget; cap turns per person/team per UTC day.
  const entityType = scope === "team" ? "team" : "user";
  const entityId = scope === "team" ? teamCode : user.id;
  const today = await getUsage(entityType, entityId).catch(() => null);
  if ((today?.recalls_count ?? 0) >= CHAT_DAILY_LIMIT) {
    return res.status(429).json({ error: `Daily chat limit (${CHAT_DAILY_LIMIT}) reached. It resets at midnight UTC.` });
  }
  await checkAndIncrementUsage({ entityType, entityId, operation: "recall" }).catch(() => {});

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
          .filter((r: any) => r.score > 0)
          .sort((a: any, b: any) => b.score - a.score);

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
  let reply: string;
  try {
    reply = await generateReply(system, messages, model);
  } catch (e: any) {
    console.error("[api/chat] LLM failed:", e?.message || e);
    return res.status(502).json({ error: "The assistant is unavailable right now. Try again shortly.", recalled });
  }

  // 3. REMEMBER (auto-capture per the rules)
  const remembered: { type: string; text: string; blobId?: string }[] = [];
  try {
    const facts = await extractFacts(lastUser, reply, model);
    // Same path as every other write: quota, secret scan, dedupe and conflict handling.
    for (const f of facts.slice(0, 5)) {
      const r = await executeMemoryCreationLifecycle({
        user,
        text: f.text,
        type: f.type,
        scope,
        teamCode,
        source: "conversation_extraction",
      });
      if (r.ok) remembered.push({ type: r.type, text: r.cleanText, blobId: r.blobId || undefined });
      else if (r.statusCode === 429) break;
    }
  } catch (e) {
    console.error("remember failed", e);
  }

  res.status(200).json({ reply, recalled, remembered, scope });
}
