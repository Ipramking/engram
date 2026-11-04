import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export function getSigningSecret(override?: string): string {
  if (override) return override
  const secret = process.env.ENGRAM_SIGNING_SECRET
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)

  if (isProd) {
    if (!secret || secret.trim().length < 16) {
      throw new Error(
        'CRITICAL_SECURITY_ERROR: ENGRAM_SIGNING_SECRET is missing or insecure (<16 characters) in production. Engram fails closed.'
      )
    }
    return secret
  }

  return secret || 'engram-default-session-secret-2026'
}

export function getPreviousSigningSecret(): string | null {
  const prev = process.env.ENGRAM_PREVIOUS_SIGNING_SECRET
  return prev && prev.trim().length >= 16 ? prev.trim() : null
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export function newTid(): string {
  return randomBytes(12).toString('base64url')
}

export function sign(tid: string, secretOverride?: string): string {
  const secret = getSigningSecret(secretOverride)
  const iat = Math.floor(Date.now() / 1000)
  // Space tokens expire after 90 days; older tokens without exp keep working until rotated.
  const payload = b64u(JSON.stringify({ tid, iat, exp: iat + 90 * 86400 }))
  const mac = b64u(createHmac('sha256', secret).update('v1.' + payload).digest())
  return `v1.${payload}.${mac}`
}

function verifyHmacWithRotation(
  data: string,
  providedMac: string,
  secretOverride?: string,
  sliceLen?: number
): boolean {
  const secretsToTry: string[] = []
  try {
    secretsToTry.push(getSigningSecret(secretOverride))
  } catch {
    return false
  }

  if (!secretOverride) {
    const prev = getPreviousSigningSecret()
    if (prev) secretsToTry.push(prev)
  }

  const a = Buffer.from(providedMac)
  for (const s of secretsToTry) {
    let expected = b64u(createHmac('sha256', s).update(data).digest())
    if (sliceLen) expected = expected.slice(0, sliceLen)
    const b = Buffer.from(expected)
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true
    }
  }
  return false
}

export function verify(token: string, secretOverride?: string): { tid: string; iat: number; exp?: number } | null {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return null

  if (!verifyHmacWithRotation(`v1.${parts[1]}`, parts[2], secretOverride)) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (typeof parsed?.exp === 'number' && Math.floor(Date.now() / 1000) > parsed.exp) return null
    return parsed
  } catch {
    return null
  }
}

export interface SessionUser {
  id: string
  email: string
  name?: string
  plan_tier?: string
  iat?: number
  exp?: number
}

export function signSession(
  user: SessionUser,
  secretOverride?: string,
  expiresInSeconds: number = 7 * 86400
): string {
  const secret = getSigningSecret(secretOverride)
  const now = Math.floor(Date.now() / 1000)
  const payload = b64u(
    JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      plan_tier: user.plan_tier || 'free_personal',
      iat: user.iat || now,
      exp: user.exp || now + expiresInSeconds,
    })
  )
  const mac = b64u(createHmac('sha256', secret).update('ses1.' + payload).digest())
  return `ses1.${payload}.${mac}`
}

export function verifySession(token: string, secretOverride?: string): SessionUser | null {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'ses1') return null

  if (!verifyHmacWithRotation(`ses1.${parts[1]}`, parts[2], secretOverride)) {
    return null
  }

  try {
    const parsed: SessionUser = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (parsed.exp && typeof parsed.exp === 'number') {
      const now = Math.floor(Date.now() / 1000)
      if (now > parsed.exp) {
        return null // Session expired
      }
    }
    return parsed
  } catch {
    return null
  }
}

export interface LiveKeyPayload {
  uid: string
  kid?: string
  scope: 'personal' | 'team'
  tid?: string
  room?: string
  iat?: number
  exp?: number
}

export function signLiveKey(
  payload: LiveKeyPayload,
  secretOverride?: string,
  expiresInSeconds: number = 30 * 86400
): string {
  const secret = getSigningSecret(secretOverride)
  const now = Math.floor(Date.now() / 1000)
  const fullPayload: LiveKeyPayload = {
    ...payload,
    iat: payload.iat || now,
    exp: payload.exp || now + expiresInSeconds,
  }
  const encoded = b64u(JSON.stringify(fullPayload))
  const mac = b64u(createHmac('sha256', secret).update('eng_live.' + encoded).digest()).slice(0, 24)
  return `eng_live_${encoded}.${mac}`
}

export function verifyLiveKey(token: string, secretOverride?: string): LiveKeyPayload | null {
  if (typeof token !== 'string' || !token.startsWith('eng_live_')) return null
  const raw = token.slice('eng_live_'.length)
  const [encoded, mac] = raw.split('.')
  if (!encoded || !mac) return null

  if (!verifyHmacWithRotation('eng_live.' + encoded, mac, secretOverride, 24)) {
    return null
  }

  try {
    const parsed: LiveKeyPayload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (parsed.exp && typeof parsed.exp === 'number') {
      const now = Math.floor(Date.now() / 1000)
      if (now > parsed.exp) {
        return null // Token expired
      }
    }
    return parsed
  } catch {
    return null
  }
}
