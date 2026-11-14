// Rate limits for endpoints that anyone can call (sign-up, sign-in, CLI login, OAuth registration).
// `allowShared` counts in Postgres (migration 20261112_rate_limits.sql), so the limit holds across
// every serverless instance; until that migration runs it falls back to a per-instance counter.
import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'

const buckets = new Map<string, { count: number; resetAt: number }>()

export function clientIp(req: any): string {
  return (
    String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

/** Per-instance check: true while the caller is within `limit` hits per `windowMs` for this key. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k)
  }
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  b.count++
  return b.count <= limit
}

// null = not tried yet, false = the database function isn't installed (use the local counter).
let sharedAvailable: boolean | null = null

/**
 * Shared check across instances. Keys are hashed before they reach the database, so the table
 * never holds raw emails or IP addresses. Database errors fall back to the local counter.
 */
export async function allowShared(key: string, limit: number, windowMs: number): Promise<boolean> {
  const local = allow(key, limit, windowMs)
  if (!local) return false
  const supabase = getSupabaseAdmin()
  if (!supabase || sharedAvailable === false) return local
  try {
    const { data, error } = await supabase.rpc('hit_rate_limit', {
      p_key: createHash('sha256').update(key).digest('hex'),
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    })
    if (error) {
      // PGRST202 / 42883: the function doesn't exist yet.
      if (['PGRST202', '42883'].includes(error.code)) sharedAvailable = false
      return local
    }
    sharedAvailable = true
    return data !== false
  } catch {
    return local
  }
}

/** Standard 429 body with a Retry-After header. */
export function tooMany(res: any, message: string, retryAfterSeconds: number) {
  res.setHeader('Retry-After', String(retryAfterSeconds))
  return res.status(429).json({ error: message, code: 'RATE_LIMITED' })
}
