// LLM layer. Uses Groq (fast open-weight models — switch between them to prove
// memory is portable across models) when GROQ_API_KEY is set, otherwise falls
// back to a deterministic offline agent so the whole app runs with zero API keys.
import { generateText, generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
import { EXTRACTION_INSTRUCTIONS } from "./prompt";
import { MEMORY_TYPES, type MemoryType } from "./types";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export function llmEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

function model(id?: string) {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });
  return groq(id ?? process.env.ENGRAM_MODEL ?? "openai/gpt-oss-20b");
}

export async function generateReply(
  system: string,
  messages: ChatMsg[],
  modelId?: string,
): Promise<string> {
  if (!llmEnabled()) return offlineReply(system, messages);
  const { text } = await generateText({ model: model(modelId), system, messages });
  return text;
}

const factSchema = z.object({
  facts: z
    .array(
      z.object({
        type: z.enum(MEMORY_TYPES),
        text: z.string().describe("one self-contained fact, absolute dates, user's wording"),
      }),
    )
    .describe("durable memories worth reusing weeks later; empty if none"),
});

export async function extractFacts(
  userText: string,
  assistantText: string,
  modelId?: string,
): Promise<{ type: MemoryType; text: string }[]> {
  if (!llmEnabled()) return offlineExtract(userText);
  const today = new Date().toISOString().slice(0, 10);
  const { object } = await generateObject({
    model: model(modelId),
    schema: factSchema,
    prompt: `${EXTRACTION_INSTRUCTIONS}

Today's date: ${today}.

USER said:
"""${userText}"""

ASSISTANT replied:
"""${assistantText}"""

Extract the durable memories from this turn.`,
  });
  return object.facts;
}

// ── Offline fallback (no API key) ──────────────────────────────────────────

function offlineReply(system: string, messages: ChatMsg[]): string {
  const recalled = (system.match(/## Recalled memories[\s\S]*/) || [""])[0]
    .split("\n")
    .filter((l) => l.startsWith("- ") && !l.includes("(none"))
    .map((l) => l.replace(/^- /, ""));
  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (recalled.length) {
    return `Here's what I remember relevant to that:\n${recalled
      .map((r) => `• ${r}`)
      .join("\n")}\n\n(Offline mode — set OPENROUTER_API_KEY for full answers. I'll still remember anything durable you tell me.)`;
  }
  return `Got it: "${last}". I don't have a memory that matches yet — tell me your decisions, configs, gotchas or people and I'll remember them. (Offline mode: set OPENROUTER_API_KEY for full answers.)`;
}

function offlineExtract(userText: string): { type: MemoryType; text: string }[] {
  const t = userText.trim();
  if (t.length < 4) return [];
  const lower = t.toLowerCase();
  // Explicit request to keep something (a plan, note, snippet) — store the full
  // content verbatim, minus the "remember/save/store this:" lead-in.
  const ask = lower.match(/\b(remember|save|store|keep|note)( this| that)?\b[:,-]?\s*/);
  if (ask) {
    const body = t.slice((ask.index ?? 0) + ask[0].length).trim() || t;
    return [{ type: "plan", text: body }];
  }
  if (t.endsWith("?")) return [];
  let type: MemoryType | null = null;
  if (/\b(decid|chose|moved|switch|migrat|because|instead of)\b/.test(lower)) type = "decision";
  else if (/\b(env|url|key lives|set in|config|port|token|variable|\.env|dashboard)\b/.test(lower))
    type = "config";
  else if (/\b(bug|error|fails?|gotcha|workaround|fix|use .* instead|does ?n'?t work)\b/.test(lower))
    type = "gotcha";
  else if (/\b(leads|prefers|owns|is in|timezone|handles|works on|met )\b/.test(lower)) type = "person";
  else if (/\b(i prefer|i want|i like|always|never|my goal|i need)\b/.test(lower)) type = "preference";
  return type ? [{ type, text: t }] : [];
}
