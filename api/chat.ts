// Main agent turn: recall relevant memories -> answer -> auto-capture new
// durable memories. Returns the reply plus what was recalled and remembered
// (with blob ids) so the UI can show proof.
import { decodeMemory, type Scope } from "./_lib/memwal.js";
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
import { searchMemories } from "./_lib/search.js";

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

  const lastUser =
    [...messages].reverse().find((m: ChatMsg) => m.role === "user")?.content ?? "";

  // 1. RECALL from the database (it knows about deleted and replaced memories).
  const recalled: { type: string; text: string; blobId?: string }[] = [];
  const supabase = getSupabaseAdmin();
  if (supabase && lastUser.trim()) {
    try {
      const found = await searchMemories(supabase, {
        scope,
        userId: user.id,
        teamId: scope === "team" && teamCode !== "default" ? teamCode : null,
        query: lastUser.slice(0, 500),
        limit: 6,
      });
      const seen = new Set<string>();
      for (const r of found.rows) {
        const text = decodeMemory(sanitizeMemoryText(r.text)).text;
        if (seen.has(text.toLowerCase())) continue;
        seen.add(text.toLowerCase());
        recalled.push({ type: r.type || "decision", text, blobId: r.blob_id || undefined });
      }
    } catch (e) {
      console.error("[api/chat] recall failed", e);
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
