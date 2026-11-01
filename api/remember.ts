// Manual "pin this" — store a memory the user explicitly chose.
import { memwalFor, encodeMemory, blobIdOf, MEMORY_TYPES, type Scope } from "./_lib/memwal";
import { getUserFromRequest } from "./_lib/auth";
import { checkAndIncrementUsage, getQuotaResetMetadata, PLAN_LIMITS } from "./_lib/db";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { text, type = "decision", scope = "personal", teamCode = "default" } = req.body ?? {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });
  const t = (MEMORY_TYPES as readonly string[]).includes(type) ? type : "decision";

  const { resetAt, secondsUntilReset } = getQuotaResetMetadata();
  const user = await getUserFromRequest(req);
  if (user) {
    const plan = user.plan_tier || (scope === 'team' ? 'free_team' : 'free_personal');
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free_personal;
    try {
      const usageResult = await checkAndIncrementUsage({
        entityType: scope === 'team' ? 'team' : 'user',
        entityId: scope === 'team' ? (teamCode !== 'default' ? teamCode : user.id) : user.id,
        operation: 'save',
        planTier: user.plan_tier,
      });

      res.setHeader('X-RateLimit-Limit', String(usageResult.limit));
      res.setHeader('X-RateLimit-Remaining', String(usageResult.remaining));
      res.setHeader('X-RateLimit-Reset', String(resetAt));
    } catch (quotaErr: any) {
      res.setHeader('Retry-After', String(secondsUntilReset));
      res.setHeader('X-RateLimit-Limit', String(limits.dailySaves));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(resetAt));
      return res.status(429).json({
        error: quotaErr.message,
        code: 'DAILY_QUOTA_EXCEEDED',
        limit: limits.dailySaves,
        resetAt,
        secondsUntilReset,
      });
    }
  }

  const ns = user ? (scope === 'team' ? teamCode : `usr_${user.id}`) : teamCode;
  const mem = memwalFor(scope as Scope, ns);
  const job = await mem.rememberAndWait(encodeMemory(t as any, text), undefined, {
    timeoutMs: 30_000,
  });
  res.status(200).json({ ok: true, type: t, text, blobId: blobIdOf(job) });
}
