import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'
import { getProfile } from './db.js'
import { verify, verifySession, verifyLiveKey } from './token.js'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, hash] = combinedHash.split(':')
    if (!salt || !hash) return false
    const computed = scryptSync(password, salt, 64).toString('hex')
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'))
  } catch {
    return false
  }
}

export async function getUserFromRequest(req: any) {
  const authHeader = req.headers?.authorization || ''
  const rawUrl = req.url || ''
  const urlParams = new URLSearchParams(rawUrl.split('?')[1] || '')
  const token =
    authHeader.replace(/^Bearer\s+/i, '').trim() ||
    req.query?.token ||
    urlParams.get('token') ||
    ''

  if (!token) return null

  // 1. Try HMAC-signed Engram Session Token (ses1....)
  if (token.startsWith('ses1.')) {
    const ses = verifySession(token)
    if (ses?.id) {
      const profile = await getProfile(ses.id)
      return {
        id: ses.id,
        email: profile?.email || ses.email,
        name: profile?.name || ses.name || ses.email.split('@')[0],
        plan_tier: profile?.plan_tier || ses.plan_tier || 'free_personal',
      }
    }
  }

  // 2. Try Engram API Key (eng_live_..., eng_usr_... or eng_team_...)
  if (token.startsWith('eng_live_')) {
    const live = verifyLiveKey(token)
    if (live?.uid) {
      const profile = await getProfile(live.uid)
      return {
        id: live.uid,
        email: profile?.email || `${live.scope}-${live.uid.slice(0, 8)}@engram.memory`,
        name: profile?.name || 'API Client',
        plan_tier: profile?.plan_tier || 'free_personal',
        apiKey: { id: live.kid || 'live', user_id: live.uid, scope: live.scope, team_id: live.tid, room: live.room || 'my-space' },
      }
    }
  }

  if (token.startsWith('eng_')) {
    try {
      const { validateApiKey } = await import('./db.js')
      const apiKey = await validateApiKey(token)
      if (apiKey) {
        const profile = await getProfile(apiKey.user_id)
        return {
          id: apiKey.user_id,
          email: profile?.email || `${apiKey.scope}-${apiKey.id.slice(0, 8)}@engram.memory`,
          name: apiKey.name || profile?.name || 'API Client',
          plan_tier: profile?.plan_tier || 'free_personal',
          apiKey,
        }
      }
    } catch (e) {
      console.warn('API key check failed:', e)
    }
  }

  // 3. Try Supabase Auth JWT
  const supabaseAdmin = getSupabaseAdmin()
  if (supabaseAdmin) {
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
      if (!error && user) {
        const profile = await getProfile(user.id)
        return {
          id: user.id,
          email: user.email!,
          name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0],
          plan_tier: profile?.plan_tier || 'free_personal',
        }
      }
    } catch {}
  }

  // 4. Legacy session_<id> or mock_token_<id> support
  if (token.startsWith('session_') || token.startsWith('mock_token_')) {
    const rawId = token.replace(/^(session_|mock_token_)/, '')
    if (rawId) {
      const profile = await getProfile(rawId)
      if (profile) {
        return {
          id: profile.id,
          email: profile.email,
          name: profile.name || profile.email?.split('@')[0],
          plan_tier: profile.plan_tier || 'free_personal',
        }
      }
    }
  }

  // 5. Provisioned space token (v1....)
  try {
    const verified = verify(token)
    if (verified?.tid) {
      return {
        id: `tid_${verified.tid}`,
        email: `guest-${verified.tid.slice(0, 6)}@engram.local`,
        name: `Space ${verified.tid.slice(0, 6)}`,
        plan_tier: 'free_personal',
      }
    }
  } catch {}

  return null
}
