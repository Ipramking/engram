import { newTid, sign } from '../mcp/token.mjs'

const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>

interface RateBucket {
  count: number
  resetAt: number
}

const rateBuckets = new Map<string, RateBucket>()
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const RATE_LIMIT_MAX = 5 // max 5 provisions per 10 min per IP
const MAX_BUCKET_MAP_SIZE = 5000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()

  // Evict expired entries if map gets large
  if (rateBuckets.size > MAX_BUCKET_MAP_SIZE) {
    for (const [key, bucket] of rateBuckets.entries()) {
      if (bucket.resetAt <= now) {
        rateBuckets.delete(key)
      }
    }
  }

  const existing = rateBuckets.get(ip)
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return false
  }

  existing.count += 1
  return true
}

function slugify(room: unknown): string {
  if (typeof room !== 'string') return 'my-space'
  const cleaned = room.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '').slice(0, 50)
  return cleaned || 'my-space'
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed: use POST' })
  }

  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Rate limit exceeded: maximum 5 space tokens per 10 minutes. Please try again later.',
    })
  }

  const secret = env.ENGRAM_SIGNING_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-signing-secret-placeholder' : '')
  if (!secret) {
    return res.status(500).json({ error: 'ENGRAM_SIGNING_SECRET is not configured on the server' })
  }

  try {
    const room = slugify(req.body?.room)
    const tid = newTid()
    const token = sign(tid, secret)
    const host = env.ENGRAM_MCP_HOST || 'https://engram-mcp.onrender.com'
    const url = `${host}/mcp?token=${encodeURIComponent(token)}&room=${encodeURIComponent(room)}`

    return res.status(200).json({
      ok: true,
      token,
      room,
      url,
      tid,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to provision space token' })
  }
}
