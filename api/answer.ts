// Self-contained LLM endpoint for the web DEMO (no relative imports, so it
// resolves as an ESM serverless function on Vercel). Given the messages and the
// memories the client already recalled, produce a reply + extract new durable
// facts. No storage here — the browser owns the demo's memory. Real memory lives
// on Walrus via the MCP.
import { generateText, generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

const MEMORY_TYPES = ["decision", "config", "gotcha", "person", "preference", "plan"] as const;
type Msg = { role: "user" | "assistant"; content: string };

const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;
const llmOn = () => Boolean(env.GROQ_API_KEY);
const model = (id?: string) =>
  createGroq({ apiKey: env.GROQ_API_KEY! })(id ?? env.ENGRAM_MODEL ?? "openai/gpt-oss-20b");

const PROTOCOL = `You are Engram, an assistant with a persistent, portable memory backed by Walrus Memory.
Treat the "Recalled memories" block below as ground truth; when you use one, say so briefly. Be concise
and practical. Durable facts the user states (decisions, configs, gotchas, people, preferences) and
anything they ask you to remember (plans, notes) get stored automatically by the app — you just answer.`;

const EXTRACT = `Extract durable memories from a conversation turn. Return only facts worth reusing weeks later.
Types: decision (a choice + reason), config (a setup value/location), gotcha (a pitfall + fix), person
(a stable fact about a teammate), preference (a lasting preference/goal), plan (a plan/spec/note to keep).
ALWAYS capture anything the user explicitly asks to remember/save/store/keep (use "plan" for plans/notes,
keep their full content). Use absolute dates. Don't extract secrets or pure small talk/questions unless
asked to keep them. If nothing is worth remembering, return an empty list.`;

function buildSystem(recalled: { type: string; text: string }[], scope: string) {
  const today = new Date().toISOString().slice(0, 10);
  const block = recalled.length ? recalled.map((m) => `- (${m.type}) ${m.text}`).join("\n") : "- (none yet)";
  return `${PROTOCOL}\n\nToday's date: ${today}. Active memory scope: ${scope}.\n\n## Recalled memories (${scope})\n${block}`;
}

async function reply(system: string, messages: Msg[], modelId?: string): Promise<string> {
  if (!llmOn()) {
    const rec = (system.match(/## Recalled[\s\S]*/) || [""])[0]
      .split("\n")
      .filter((l) => l.startsWith("- ") && !l.includes("(none"))
      .map((l) => l.replace(/^- /, ""));
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return rec.length
      ? `Here's what I remember relevant to that:\n${rec.map((r) => `• ${r}`).join("\n")}`
      : `Got it: “${last}”. Tell me a decision, config, gotcha or person — or ask me to remember a plan — and I'll keep it.`;
  }
  const { text } = await generateText({ model: model(modelId), system, messages });
  return text;
}

const schema = z.object({
  facts: z.array(z.object({ type: z.enum(MEMORY_TYPES), text: z.string() })),
});

async function extract(userText: string, assistantText: string, modelId?: string): Promise<{ type: string; text: string }[]> {
  if (!llmOn()) return offlineExtract(userText);
  const today = new Date().toISOString().slice(0, 10);
  const { object } = await generateObject({
    model: model(modelId),
    schema,
    prompt: `${EXTRACT}\n\nToday: ${today}.\n\nUSER:\n"""${userText}"""\n\nASSISTANT:\n"""${assistantText}"""\n\nExtract the durable memories.`,
  });
  return object.facts;
}

function offlineExtract(t0: string): { type: string; text: string }[] {
  const t = t0.trim();
  if (t.length < 4) return [];
  const lower = t.toLowerCase();
  const ask = lower.match(/\b(remember|save|store|keep|note)( this| that)?\b[:,-]?\s*/);
  if (ask) return [{ type: "plan", text: t.slice((ask.index ?? 0) + ask[0].length).trim() || t }];
  if (t.endsWith("?")) return [];
  const rules: [RegExp, string][] = [
    [/\b(decid|chose|moved|switch|migrat|because|instead of)\b/, "decision"],
    [/\b(env|url|set in|config|port|token|variable|dashboard|\.env)\b/, "config"],
    [/\b(bug|error|fails?|gotcha|workaround|fix|instead|does ?n'?t work)\b/, "gotcha"],
    [/\b(leads|prefers|owns|timezone|handles|works on|met )\b/, "person"],
    [/\b(i prefer|i want|i like|always|never|my goal)\b/, "preference"],
  ];
  for (const [re, type] of rules) if (re.test(lower)) return [{ type, text: t }];
  return [];
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { messages = [], recalled = [], scope = "personal", model: modelId } = req.body ?? {};
  const lastUser = [...messages].reverse().find((m: Msg) => m.role === "user")?.content ?? "";
  const system = buildSystem(recalled, scope);
  const text = await reply(system, messages, modelId);
  let remembered: { type: string; text: string }[] = [];
  try {
    remembered = await extract(lastUser, text, modelId);
  } catch (e) {
    console.error("extract failed", e);
  }
  res.status(200).json({ reply: text, remembered });
}
