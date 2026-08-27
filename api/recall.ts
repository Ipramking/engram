// Explicit recall — powers the "what do you remember about…" search box.
import {
  memwalFor,
  normalizeRecall,
  decodeMemory,
  recallMaxDistance,
  type Scope,
} from "./_lib/memwal";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { query = "", scope = "personal", teamCode = "default", topK = 10 } = req.body ?? {};
  const mem = memwalFor(scope as Scope, teamCode);
  const r = await mem.recall({ query, topK, maxDistance: recallMaxDistance() });
  const results = normalizeRecall(r).map((m) => ({ ...decodeMemory(m.text), blobId: m.blobId }));
  res.status(200).json({ results });
}
