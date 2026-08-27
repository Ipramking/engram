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
} from "./_lib/memwal";
import { buildSystemPrompt } from "./_lib/prompt";
import { generateReply, extractFacts, type ChatMsg } from "./_lib/llm";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { messages = [], scope = "personal", teamCode = "default", model } = req.body ?? {};
  const mem = memwalFor(scope as Scope, teamCode);
  const lastUser =
    [...messages].reverse().find((m: ChatMsg) => m.role === "user")?.content ?? "";

  // 1. RECALL
  let recalled: { type: string; text: string; blobId?: string }[] = [];
  try {
    const r = await mem.recall({ query: lastUser, topK: 6, maxDistance: recallMaxDistance() });
    recalled = normalizeRecall(r).map((m) => ({ ...decodeMemory(m.text), blobId: m.blobId }));
  } catch (e) {
    console.error("recall failed", e);
  }

  // 2. ANSWER
  const system = buildSystemPrompt(recalled, scope);
  const reply = await generateReply(system, messages, model);

  // 3. REMEMBER (auto-capture per the rules)
  const remembered: { type: string; text: string; blobId?: string }[] = [];
  try {
    const facts = await extractFacts(lastUser, reply, model);
    for (const f of facts) {
      const job = await mem.rememberAndWait(encodeMemory(f.type, f.text), undefined, {
        timeoutMs: 30_000,
      });
      remembered.push({ type: f.type, text: f.text, blobId: blobIdOf(job) });
    }
  } catch (e) {
    console.error("remember failed", e);
  }

  res.status(200).json({ reply, recalled, remembered, scope });
}
