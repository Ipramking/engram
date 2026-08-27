// Manual "pin this" — store a memory the user explicitly chose.
import { memwalFor, encodeMemory, blobIdOf, MEMORY_TYPES, type Scope } from "./_lib/memwal";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { text, type = "decision", scope = "personal", teamCode = "default" } = req.body ?? {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });
  const t = (MEMORY_TYPES as readonly string[]).includes(type) ? type : "decision";
  const mem = memwalFor(scope as Scope, teamCode);
  const job = await mem.rememberAndWait(encodeMemory(t as any, text), undefined, {
    timeoutMs: 30_000,
  });
  res.status(200).json({ type: t, text, blobId: blobIdOf(job) });
}
