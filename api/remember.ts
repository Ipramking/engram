// Manual "pin this" — store a memory the user explicitly chose.
import { memwalFor, encodeMemory, decodeMemory, blobIdOf, MEMORY_TYPES, type Scope } from "./_lib/memwal";
import { getUserFromRequest } from "./_lib/auth";
import { checkAndIncrementUsage, getQuotaResetMetadata, PLAN_LIMITS, isTeamMember } from "./_lib/db";
import { getSupabaseAdmin } from "./_lib/supabase";
import { detectAndResolveConflicts } from "./_lib/conflicts";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { text, type, scope = "personal", teamCode = "default" } = req.body ?? {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: authentication required to access memory." });
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

  const decoded = decodeMemory(text);
  const t = type && (MEMORY_TYPES as readonly string[]).includes(type)
    ? type
    : (decoded.type !== 'note' ? decoded.type : 'decision');
  const cleanText = decoded.text;

  const { resetAt, secondsUntilReset } = getQuotaResetMetadata();
  const plan = user.plan_tier || (scope === 'team' ? 'free_team' : 'free_personal');
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free_personal;
  try {
    const usageResult = await checkAndIncrementUsage({
      entityType: scope === 'team' ? 'team' : 'user',
      entityId: scope === 'team' ? teamCode : user.id,
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

  const ns = scope === 'team' ? teamCode : `usr_${user.id}`;
  const mem = memwalFor(scope as Scope, ns);
  const job = await mem.rememberAndWait(encodeMemory(t as any, cleanText), undefined, {
    timeoutMs: 30_000,
  });
  const blobId = blobIdOf(job);

  // Persist to memories_meta and run smart conflict resolution
  let superseded: any[] = [];
  const supabase = getSupabaseAdmin();
  if (supabase && user) {
    try {
      await supabase.from('memories_meta').insert({
        user_id: user.id,
        team_id: scope === 'team' ? (teamCode !== 'default' ? teamCode : null) : null,
        room: 'my-space',
        type: t,
        text: cleanText,
        blob_id: blobId,
      });

      const conflictRes = await detectAndResolveConflicts({
        userId: user.id,
        teamId: scope === 'team' ? (teamCode !== 'default' ? teamCode : null) : null,
        scope: scope as 'personal' | 'team',
        newText: cleanText,
        newType: t,
        newBlobId: blobId,
      });
      superseded = conflictRes.supersededList;
    } catch (metaErr) {
      console.error('Failed to update memories_meta or resolve conflicts:', metaErr);
    }
  }

  res.status(200).json({ ok: true, type: t, text: cleanText, blobId, superseded });
}
