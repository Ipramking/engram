import { getSupabaseAdmin, authApi } from './supabase.js'
import { getProfile, getApiKeyRow, isTeamMember } from './db.js'
import { verify, verifySession, verifyLiveKey } from './token.js'

/**
 * What a credential may do. Signed-in sessions can do everything; API keys are limited by their
 * permissions: read_write (default), read (recall only) or save (write only).
 */
export function keyCan(user: any, need: 'read' | 'write' | 'manage'): boolean {
  if (!user?.apiKey) return true
  const p = user.apiKey.permissions || 'read_write'
  if (need === 'read') return p !== 'save'
  if (need === 'write') return p !== 'read'
  return p === 'read_write'
}

export const permissionError = (need: 'read' | 'write' | 'manage') =>
  need === 'read'
    ? 'This key can only save memories. Use a read or read-and-save key to recall.'
    : need === 'write'
      ? 'This key is read-only. Use a save or read-and-save key to store memories.'
      : 'This key needs full read-and-save access for this action.'

/** API keys and space tokens may read and write memory, but must never manage keys or teams. */
export function isMachineToken(req: any): boolean {
  const header = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
  const query = String(req.query?.token || new URLSearchParams(String(req.url || '').split('?')[1] || '').get('token') || '')
  const token = header || query
  return token.startsWith('eng_') || token.startsWith('v1.')
}

export async function getUserFromRequest(req: any) {
  const authHeader = req.headers?.authorization || ''
  const rawUrl = req.url || ''
  const urlParams = new URLSearchParams(rawUrl.split('?')[1] || '')
  const authBearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const queryToken = req.query?.token || urlParams.get('token') || ''

  if (!authBearerToken && queryToken) {
    console.warn(
      '[SECURITY DEPRECATION] Query-string authentication (?token=...) is deprecated and will be removed in Engram 3.0. Use "Authorization: Bearer <token>" header.'
    )
  }

  const token = authBearerToken || queryToken
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

  // 2. Try Engram Live API Key (eng_live_...)
  if (token.startsWith('eng_live_')) {
    const live = verifyLiveKey(token)
    if (!live?.uid) {
      return null
    }
    const row = live.kid ? await getApiKeyRow(live.kid) : null
    if (live.kid && !row?.is_active) {
      return null // Revoked or unknown key
    }
    const profile = await getProfile(live.uid)
    return {
      id: live.uid,
      email: profile?.email || `${live.scope}-${live.uid.slice(0, 8)}@engram.memory`,
      name: profile?.name || 'API Client',
      plan_tier: profile?.plan_tier || 'free_personal',
      apiKey: { id: live.kid || 'live', user_id: live.uid, scope: live.scope, team_id: live.tid, room: live.room || 'my-space', permissions: row?.permissions || 'read_write' },
    }
  }

  // 3. Try standard DB API Key (eng_usr_... or eng_team_...)
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

  // 4. Try Supabase Auth JWT
  const supabaseAdmin = getSupabaseAdmin()
  if (supabaseAdmin) {
    try {
      const { data: { user }, error } = await authApi(supabaseAdmin).getUser(token)
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

  // 5. Development-only mock session support (Strictly blocked in production)
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)
  if (!isProd && (token.startsWith('session_') || token.startsWith('mock_token_'))) {
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

  // 6. Provisioned space token (v1....)
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

export interface AuthMemoryResult {
  authorized: boolean
  statusCode: number
  error?: string
  effectiveScope: 'personal' | 'team'
  effectiveTeamId?: string
  namespaces: string[]
}

/**
 * Centralized authorization engine for memory operations across REST & MCP.
 * Prevents cross-tenant / IDOR attacks by strictly enforcing team membership
 * and key scope boundaries.
 */
export async function authorizeMemoryAccess(opts: {
  user: any
  requestedScope?: 'personal' | 'team' | 'both' | string
  requestedTeamCode?: string
}): Promise<AuthMemoryResult> {
  const { user, requestedScope = 'personal', requestedTeamCode } = opts
  if (!user || !user.id) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: authentication required to access memory.',
      effectiveScope: 'personal',
      namespaces: [],
    }
  }

  const userNamespace = `usr_${user.id}`

  // 1. Team-scoped API key enforcement: strictly bound to its own team_id
  if (user.apiKey?.scope === 'team') {
    const keyTeamId = user.apiKey.team_id
    if (!keyTeamId) {
      return {
        authorized: false,
        statusCode: 403,
        error: 'Forbidden: invalid team API key with no associated team.',
        effectiveScope: 'team',
        namespaces: [],
      }
    }

    if (requestedScope === 'personal') {
      return {
        authorized: false,
        statusCode: 403,
        error: 'Forbidden: team-scoped API key cannot access personal memory space.',
        effectiveScope: 'team',
        namespaces: [],
      }
    }

    if (requestedTeamCode && requestedTeamCode !== 'default' && requestedTeamCode !== keyTeamId) {
      return {
        authorized: false,
        statusCode: 403,
        error: `Forbidden: this API key is strictly scoped to team ${keyTeamId}. Cross-team access is blocked.`,
        effectiveScope: 'team',
        namespaces: [],
      }
    }

    const isMember = await isTeamMember(user.id, keyTeamId)
    if (!isMember) {
      return {
        authorized: false,
        statusCode: 403,
        error: 'Forbidden: caller is not an active member of this team.',
        effectiveScope: 'team',
        namespaces: [],
      }
    }

    return {
      authorized: true,
      statusCode: 200,
      effectiveScope: 'team',
      effectiveTeamId: keyTeamId,
      namespaces: [keyTeamId],
    }
  }

  // 2. Personal key or Session requesting Team scope: must prove active membership
  if (requestedScope === 'team') {
    if (!requestedTeamCode || requestedTeamCode === 'default') {
      return {
        authorized: false,
        statusCode: 400,
        error: 'teamCode (team ID) is required for team scope.',
        effectiveScope: 'team',
        namespaces: [],
      }
    }

    const isMember = await isTeamMember(user.id, requestedTeamCode)
    if (!isMember) {
      return {
        authorized: false,
        statusCode: 403,
        error: `Forbidden: you are not an active member of team ${requestedTeamCode}.`,
        effectiveScope: 'team',
        namespaces: [],
      }
    }

    return {
      authorized: true,
      statusCode: 200,
      effectiveScope: 'team',
      effectiveTeamId: requestedTeamCode,
      namespaces: [requestedTeamCode],
    }
  }

  // 3. Requesting both scopes (e.g. unified recall)
  if (requestedScope === 'both') {
    const namespaces = [userNamespace]
    let effectiveTeamId: string | undefined = undefined

    if (requestedTeamCode && requestedTeamCode !== 'default') {
      const isMember = await isTeamMember(user.id, requestedTeamCode)
      if (!isMember) {
        return {
          authorized: false,
          statusCode: 403,
          error: `Forbidden: you are not an active member of team ${requestedTeamCode}.`,
          effectiveScope: 'personal',
          namespaces: [],
        }
      }
      namespaces.push(requestedTeamCode)
      effectiveTeamId = requestedTeamCode
    }

    return {
      authorized: true,
      statusCode: 200,
      effectiveScope: effectiveTeamId ? 'team' : 'personal',
      effectiveTeamId,
      namespaces,
    }
  }

  // 4. Personal scope default
  return {
    authorized: true,
    statusCode: 200,
    effectiveScope: 'personal',
    namespaces: [userNamespace],
  }
}
