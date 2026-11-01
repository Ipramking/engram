// Manual "pin this" — store a memory the user explicitly chose.
import { memwalFor, encodeMemory, decodeMemory, blobIdOf, MEMORY_TYPES, type Scope } from "./_lib/memwal.js";
import { getUserFromRequest } from "./_lib/auth.js";
import { checkAndIncrementUsage, getQuotaResetMetadata, PLAN_LIMITS, isTeamMember } from "./_lib/db.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";
import { detectAndResolveConflicts } from "./_lib/conflicts.js";
import { scanForSecrets, sanitizeMemoryText } from "./_lib/security.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { text, type, scope = "personal", teamCode = "default" } = req.body ?? {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });

  // Deterministic server-side secret scanner (Security Audit Finding 4)
  const secretCheck = scanForSecrets(text);
  if (secretCheck.hasSecret) {
    return res.status(400).json({
      error: secretCheck.reason,
      code: "SECRET_DETECTED",
    });
  }

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

  const decoded = decodeMemory(sanitizeMemoryText(text));
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
  let blobId: string | undefined;
  try {
    const encoded = encodeMemory(t as any, cleanText);
    const job = await Promise.race([
      mem.rememberAndWait(encoded, undefined, { timeoutMs: 4500 }),
      new Promise((resolve) => setTimeout(() => resolve(null), 4500)),
    ]);
    blobId = blobIdOf(job);
    if (!blobId && typeof mem.remember === 'function') {
      const asyncJob = await Promise.race([
        mem.remember(encoded),
        new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      blobId = blobIdOf(asyncJob) || (asyncJob as any)?.jobId || (asyncJob as any)?.job_id;
    }
  } catch (walrusErr) {
    console.warn("Walrus relayer write warning (persisting to Supabase metadata):", walrusErr);
  }

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
        blob_id: blobId ?? null,
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
