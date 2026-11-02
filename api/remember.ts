// Manual "pin this" — store a memory the user explicitly chose.
import { memwalFor, encodeMemory, decodeMemory, MEMORY_TYPES, type Scope } from "./_lib/memwal.js";
import { getUserFromRequest, authorizeMemoryAccess } from "./_lib/auth.js";
import { checkAndIncrementUsage, getQuotaResetMetadata, PLAN_LIMITS } from "./_lib/db.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";
import { detectAndResolveConflicts } from "./_lib/conflicts.js";
import { scanForSecrets, sanitizeMemoryText } from "./_lib/security.js";
import { writeMemoryWithRetry } from "./_lib/storage.js";
import { executeLifecyclePipeline } from "./_lib/intelligence.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "GET or POST only" });
  }

  const rawUrl = req.url || "";
  const searchParams = new URLSearchParams(rawUrl.split("?")[1] || "");
  const source =
    req.method === "GET"
      ? { ...Object.fromEntries(searchParams.entries()), ...(req.query || {}) }
      : (req.body ?? {});

  const { text, type, scope = "personal", teamCode = "default" } = source;
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

  // Centralized authorization enforcement
  const authRes = await authorizeMemoryAccess({
    user,
    requestedScope: scope,
    requestedTeamCode: teamCode,
  });

  if (!authRes.authorized) {
    return res.status(authRes.statusCode || 403).json({ error: authRes.error });
  }

  const effectiveScope = authRes.effectiveScope;
  const effectiveTeamId = authRes.effectiveTeamId;
  const ns = effectiveScope === "team" ? effectiveTeamId! : `usr_${user.id}`;

  const decoded = decodeMemory(sanitizeMemoryText(text));
  const t = type && (MEMORY_TYPES as readonly string[]).includes(type)
    ? type
    : (decoded.type !== 'note' ? decoded.type : 'decision');
  const cleanText = decoded.text;

  const { resetAt, secondsUntilReset } = getQuotaResetMetadata();
  const plan = user.plan_tier || (effectiveScope === 'team' ? 'free_team' : 'free_personal');
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free_personal;
  try {
    const usageResult = await checkAndIncrementUsage({
      entityType: effectiveScope === 'team' ? 'team' : 'user',
      entityId: effectiveScope === 'team' ? effectiveTeamId! : user.id,
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

  const mem = memwalFor(effectiveScope as Scope, ns);
  const encoded = encodeMemory(t as any, cleanText);

  // Resilient write-ahead with exponential backoff & idempotency protection
  const writeRes = await writeMemoryWithRetry({
    mem,
    encodedText: encoded,
    type: t as any,
    cleanText,
    userId: user.id,
    scope: effectiveScope as 'personal' | 'team',
    teamId: effectiveTeamId,
  });

  const blobId = writeRes.blobId;
  const storageState = writeRes.storageState;
  const contentHash = writeRes.contentHash;
  const idempotencyKey = writeRes.idempotencyKey;
  const storageProvider = writeRes.storageProvider;

  // Persist to memories_meta and run smart conflict resolution
  let superseded: any[] = [];
  const supabase = getSupabaseAdmin();
  if (supabase && user) {
    try {
      await supabase.from('memories_meta').insert({
        user_id: user.id,
        team_id: effectiveScope === 'team' ? effectiveTeamId : null,
        room: 'my-space',
        type: t,
        text: cleanText,
        blob_id: blobId ?? null,
      });

      const conflictRes = await detectAndResolveConflicts({
        userId: user.id,
        teamId: effectiveScope === 'team' ? effectiveTeamId : null,
        scope: effectiveScope as 'personal' | 'team',
        newText: cleanText,
        newType: t,
        newBlobId: blobId,
      });
      superseded = conflictRes.supersededList;
    } catch (metaErr) {
      console.error('Failed to update memories_meta or resolve conflicts:', metaErr);
    }
  }

  const accept = String(req.headers?.accept || "");
  if (req.method === "GET" && accept.includes("text/html") && source.format !== "json") {
    const safeHtmlText = cleanText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const isDurable = storageState === 'confirmed_durable' || storageState === 'local_mock';
    const badgeHtml = isDurable
      ? `<div class="badge" style="display:inline-block;background:rgba(52,211,153,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.35);border-radius:99px;padding:6px 14px;font-size:12px;font-family:monospace;text-transform:uppercase;margin-bottom:16px;">✓ Anchored on Walrus</div>`
      : `<div class="badge" style="display:inline-block;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);border-radius:99px;padding:6px 14px;font-size:12px;font-family:monospace;text-transform:uppercase;margin-bottom:16px;">⚡ Stored in Vault (${storageState === 'recovery_required' ? 'Recovery Queued' : 'Walrus Pending'})</div>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Saved to Engram</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#09070f; color:#f6f2ff; font-family:system-ui,-apple-system,sans-serif; padding:20px; box-sizing:border-box; }
    .card { max-width:420px; width:100%; background:#130f1e; border:1px solid rgba(251,113,133,0.35); border-radius:24px; padding:28px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.6); }
    h1 { font-size:22px; margin:0 0 10px; }
    .mem { background:#09070f; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:14px; font-size:14px; line-height:1.5; color:#e2dcf0; margin:16px 0 22px; word-break:break-word; text-align:left; }
    .type { color:#fb7185; font-family:monospace; font-size:11px; text-transform:uppercase; font-weight:bold; display:block; margin-bottom:4px; }
    .btn { display:block; width:100%; padding:13px; border-radius:99px; background:linear-gradient(90deg,#fb7185,#a78bfa); color:#09070f; font-weight:600; font-size:14px; text-decoration:none; border:none; cursor:pointer; box-sizing:border-box; }
  </style>
</head>
<body>
  <div class="card">
    ${badgeHtml}
    <h1>Memory Saved!</h1>
    <p style="font-size:13px;color:#9f96b8;margin:0;">This fact is now synced across your phone, laptop, and CLI.</p>
    <div class="mem">
      <span class="type">[${t}]</span>
      ${safeHtmlText}
    </div>
    <button class="btn" onclick="if(window.history.length>1){window.history.back()}else{window.close()}">← Return to Chat</button>
    <a href="/dashboard" style="display:inline-block;margin-top:14px;font-size:12px;color:#9f96b8;text-decoration:none;">Open Engram Dashboard →</a>
  </div>
</body>
</html>`);
  }

  const pipelineResult = executeLifecyclePipeline({
    userId: user.id,
    scope: effectiveScope as 'personal' | 'team',
    teamId: effectiveTeamId,
    text: cleanText,
    type: t,
    blobId,
  });
  const structured = pipelineResult.memory;

  res.status(200).json({
    ok: true,
    type: t,
    text: cleanText,
    category: structured.category,
    subtype: structured.subtype,
    entities: structured.entities,
    confidence: structured.confidence,
    importance: structured.importance,
    sensitivity: structured.sensitivity,
    blobId: blobId ?? null,
    storageState,
    persistenceState: storageState,
    contentHash,
    idempotencyKey,
    storageProvider,
    integrityVerified: true,
    isDuplicate: writeRes.isDuplicate ?? false,
    superseded,
  });
}
