import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const getSecret = (override?: string) => override || process.env.ENGRAM_SIGNING_SECRET || 'engram-default-session-secret-2026'
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export function newTid(): string {
  return randomBytes(12).toString('base64url')
}

export function sign(tid: string, secretOverride?: string): string {
  const secret = getSecret(secretOverride)
  const payload = b64u(JSON.stringify({ tid, iat: Math.floor(Date.now() / 1000) }))
  const mac = b64u(createHmac('sha256', secret).update('v1.' + payload).digest())
  return `v1.${payload}.${mac}`
}

export function verify(token: string, secretOverride?: string): { tid: string; iat: number } | null {
  const secret = getSecret(secretOverride)
  if (!secret || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return null
  const expected = b64u(createHmac('sha256', secret).update(`v1.${parts[1]}`).digest())
  const a = Buffer.from(parts[2])
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export interface SessionUser {
  id: string
  email: string
  name?: string
  plan_tier?: string
}

export function signSession(user: SessionUser, secretOverride?: string): string {
  const secret = getSecret(secretOverride)
  const payload = b64u(
    JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      plan_tier: user.plan_tier || 'free_personal',
      iat: Math.floor(Date.now() / 1000),
    })
  )
  const mac = b64u(createHmac('sha256', secret).update('ses1.' + payload).digest())
  return `ses1.${payload}.${mac}`
}

export function verifySession(token: string, secretOverride?: string): SessionUser | null {
  const secret = getSecret(secretOverride)
  if (!secret || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'ses1') return null
  const expected = b64u(createHmac('sha256', secret).update(`ses1.${parts[1]}`).digest())
  const a = Buffer.from(parts[2])
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}
