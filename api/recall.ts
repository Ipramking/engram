// Explicit recall — powers the "what do you remember about…" search box.
import {
  memwalFor,
  normalizeRecall,
  decodeMemory,
  recallMaxDistance,
  type Scope,
} from "./_lib/memwal";
import { getUserFromRequest } from "./_lib/auth";
import { checkAndIncrementUsage } from "./_lib/db";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { query = "", scope = "personal", teamCode = "default", topK = 10 } = req.body ?? {};

  const user = await getUserFromRequest(req);
  if (user) {
    await checkAndIncrementUsage({
      entityType: scope === 'team' ? 'team' : 'user',
      entityId: scope === 'team' ? (teamCode !== 'default' ? teamCode : user.id) : user.id,
      operation: 'recall',
      planTier: user.plan_tier,
    }).catch(() => {});
  }

  const ns = user ? (scope === 'team' ? teamCode : `usr_${user.id}`) : teamCode;
  const mem = memwalFor(scope as Scope, ns);
  const r = await mem.recall({ query, topK, maxDistance: recallMaxDistance() });
  const results = normalizeRecall(r).map((m) => ({ ...decodeMemory(m.text), blobId: m.blobId }));
  res.status(200).json({ ok: true, results });
}
