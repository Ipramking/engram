import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export function getSigningSecret(override) {
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

export function getPreviousSigningSecret() {
  const prev = process.env.ENGRAM_PREVIOUS_SIGNING_SECRET
  return prev && prev.trim().length >= 16 ? prev.trim() : null
}

const b64u = (b) => Buffer.from(b).toString('base64url')

export function newTid() {
  return randomBytes(12).toString('base64url')
}

export function sign(tid, secretOverride) {
  const secret = getSigningSecret(secretOverride)
  const payload = b64u(JSON.stringify({ tid, iat: Math.floor(Date.now() / 1000) }))
  const mac = b64u(createHmac('sha256', secret).update('v1.' + payload).digest())
  return `v1.${payload}.${mac}`
}

function verifyHmacWithRotation(data, providedMac, secretOverride, sliceLen) {
  const secretsToTry = []
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

export function verify(token, secretOverride) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return null

  if (!verifyHmacWithRotation(`v1.${parts[1]}`, parts[2], secretOverride)) {
    return null
  }

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export function signLiveKey(payload, secretOverride, expiresInSeconds = 30 * 86400) {
  const secret = getSigningSecret(secretOverride)
  const now = Math.floor(Date.now() / 1000)
  const fullPayload = {
    ...payload,
    iat: payload.iat || now,
    exp: payload.exp || now + expiresInSeconds,
  }
  const encoded = b64u(JSON.stringify(fullPayload))
  const mac = b64u(createHmac('sha256', secret).update('eng_live.' + encoded).digest()).slice(0, 24)
  return `eng_live_${encoded}.${mac}`
}

export function verifyLiveKey(token, secretOverride) {
  if (typeof token !== 'string' || !token.startsWith('eng_live_')) return null
  const raw = token.slice('eng_live_'.length)
  const [encoded, mac] = raw.split('.')
  if (!encoded || !mac) return null

  if (!verifyHmacWithRotation('eng_live.' + encoded, mac, secretOverride, 24)) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
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
