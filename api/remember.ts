// Manual "pin this" — store a memory the user explicitly chose.
import { getUserFromRequest } from "./_lib/auth.js";
import { getQuotaResetMetadata, PLAN_LIMITS } from "./_lib/db.js";
import { executeMemoryCreationLifecycle } from "./_lib/lifecycle.js";

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

  const { text, type, scope: requestedScope, teamCode = "default" } = source;

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: this Engram key is missing, expired or revoked. Create a new key at https://engram-pearl.vercel.app/dashboard?tab=keys and update your app.", code: "KEY_INVALID" });
  }
  // No explicit scope: use the key's own scope so team keys work without extra arguments.
  const scope = requestedScope || (user as any).apiKey?.scope || "personal";

  const lifecycleResult = await executeMemoryCreationLifecycle({
    user,
    text,
    type,
    scope,
    teamCode,
    source: 'explicit_user',
  });

  if (!lifecycleResult.ok) {
    if (lifecycleResult.statusCode === 429) {
      const { resetAt, secondsUntilReset } = getQuotaResetMetadata();
      const plan = user.plan_tier || (scope === 'team' ? 'free_team' : 'free_personal');
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free_personal;
      res.setHeader('Retry-After', String(secondsUntilReset));
      res.setHeader('X-RateLimit-Limit', String(limits.dailySaves));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(resetAt));
      return res.status(429).json({
        error: lifecycleResult.error,
        code: 'DAILY_QUOTA_EXCEEDED',
        limit: limits.dailySaves,
        resetAt,
        secondsUntilReset,
      });
    }

    return res.status(lifecycleResult.statusCode).json({
      error: lifecycleResult.error,
      code: lifecycleResult.code,
    });
  }

  const accept = String(req.headers?.accept || "");
  if (req.method === "GET" && accept.includes("text/html") && source.format !== "json") {
    const safeHtmlText = lifecycleResult.cleanText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const isDurable =
      lifecycleResult.storageState === 'confirmed_durable' ||
      lifecycleResult.storageState === 'local_mock';
    const badgeHtml = isDurable
      ? `<div class="badge" style="display:inline-block;background:rgba(52,211,153,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.35);border-radius:99px;padding:6px 14px;font-size:12px;font-family:monospace;text-transform:uppercase;margin-bottom:16px;">✓ Anchored on Walrus</div>`
      : `<div class="badge" style="display:inline-block;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);border-radius:99px;padding:6px 14px;font-size:12px;font-family:monospace;text-transform:uppercase;margin-bottom:16px;">⚡ Stored in Vault (${lifecycleResult.storageState === 'recovery_required' ? 'Recovery Queued' : 'Walrus Pending'})</div>`;

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
      <span class="type">[${lifecycleResult.type}]</span>
      ${safeHtmlText}
    </div>
    <button class="btn" onclick="if(window.history.length>1){window.history.back()}else{window.close()}">← Return to Chat</button>
    <a href="/dashboard" style="display:inline-block;margin-top:14px;font-size:12px;color:#9f96b8;text-decoration:none;">Open Engram Dashboard →</a>
  </div>
</body>
</html>`);
  }

  res.status(200).json({
    ok: true,
    type: lifecycleResult.type,
    text: lifecycleResult.cleanText,
    category: lifecycleResult.category,
    subtype: lifecycleResult.subtype,
    entities: lifecycleResult.entities,
    confidence: lifecycleResult.confidence,
    importance: lifecycleResult.importance,
    sensitivity: lifecycleResult.sensitivity,
    blobId: lifecycleResult.blobId,
    storageState: lifecycleResult.storageState,
    persistenceState: lifecycleResult.persistenceState,
    contentHash: lifecycleResult.contentHash,
    idempotencyKey: lifecycleResult.idempotencyKey,
    storageProvider: lifecycleResult.storageProvider,
    integrityVerified: lifecycleResult.integrityVerified,
    isDuplicate: lifecycleResult.isDuplicate,
    superseded: lifecycleResult.superseded,
  });
}
