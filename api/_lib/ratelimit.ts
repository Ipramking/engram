// Best-effort per-instance rate limiting for auth endpoints. Serverless instances don't share
// memory, so this slows down scripted abuse from one IP but is not a global guarantee.
const buckets = new Map<string, { count: number; resetAt: number }>()

export function clientIp(req: any): string {
  return (
    String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

/** Returns true when the caller is still within `limit` hits per `windowMs` for this key. */
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
