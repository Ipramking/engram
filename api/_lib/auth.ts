import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin, getSupabaseAuth } from './supabase'
import { getProfile, createProfile } from './db'

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
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || req.query?.token

  if (!token) return null

  // 1. Try Supabase Auth
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
    } catch (e) {
      // not a supabase jwt, fallback
    }
  }

  // 2. Try Engram API Key (eng_usr_... or eng_team_...)
  if (token.startsWith('eng_')) {
    try {
      const { validateApiKey } = await import('./db')
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

  // 3. Fallback session / token check
  try {
    const { verify } = await import('./token')
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
