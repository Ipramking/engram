import { getUserFromRequest, isMachineToken } from './_lib/auth.js'
import { newTid, sign } from './_lib/token.js'
import { allowShared } from './_lib/ratelimit.js'

const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const RATE_LIMIT_MAX = 5 // max 5 space links per 10 min per network

function slugify(room: unknown): string {
  if (typeof room !== 'string') return 'my-space'
  const cleaned = room.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '').slice(0, 50)
  return cleaned || 'my-space'
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed: use POST' })
  }

  // Space links write real memory, so only signed-in people may create them.
  if (isMachineToken(req)) {
    return res.status(403).json({ error: 'API keys cannot create space links. Sign in to the dashboard instead.' })
  }
  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Sign in to create a space link.' })
  }

  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'

  if (!(await allowShared(`provision:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS))) {
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
    const host = env.ENGRAM_MCP_HOST || 'https://engram-pearl.vercel.app'
    const url = `${host}/mcp?token=${encodeURIComponent(token)}&room=${encodeURIComponent(room)}`

    return res.status(200).json({
      ok: true,
      token,
      room,
      url,
      tid,
    })
  } catch (err: any) {
    console.error('[api/provision] failed:', err?.message || err)
    return res.status(500).json({ error: 'Could not create a space link. Try again.' })
  }
}
