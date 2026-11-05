// "Sign in with Engram": OAuth 2.1 for MCP connectors (Claude, ChatGPT, Le Chat…).
// Clients register dynamically (RFC 7591), users approve on the dashboard, codes use PKCE (S256),
// and every approval becomes one revocable API key, so revoking it on the Keys page disconnects
// that app. Codes and refresh tokens are stored as SHA-256 hashes only.
import { createHash, randomBytes } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'
import { createApiKey, getApiKeyRow } from './db.js'
import { signLiveKey } from './token.js'

export const ACCESS_TTL_SECONDS = 7 * 86400
const sha256hex = (s: string) => createHash('sha256').update(s).digest('hex')
const token = (bytes = 32) => randomBytes(bytes).toString('base64url')

type Result = { status: number; body: any; headers?: Record<string, string> }
const oauthError = (status: number, error: string, description: string): Result => ({
  status,
  body: { error, error_description: description },
})
const notEnabled = (): Result => oauthError(503, 'temporarily_unavailable', 'Sign in with Engram is not enabled on this server yet.')
const missingTable = (e: any) => e && ['42P01', 'PGRST205'].includes(e.code)

export function authorizationServerMetadata(host: string) {
  return {
    issuer: host,
    authorization_endpoint: `${host}/oauth/authorize`,
    token_endpoint: `${host}/oauth/token`,
    registration_endpoint: `${host}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['memory'],
    service_documentation: `${host}/docs`,
  }
}

export function protectedResourceMetadata(host: string) {
  return {
    resource: `${host}/mcp`,
    authorization_servers: [host],
    bearer_methods_supported: ['header'],
    scopes_supported: ['memory'],
    resource_name: 'Engram memory',
  }
}

function validRedirect(uri: unknown) {
  if (typeof uri !== 'string' || uri.length > 500) return false
  try {
    const u = new URL(uri)
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    return (u.protocol === 'https:' || (u.protocol === 'http:' && local)) && !u.hash
  } catch {
    return false
  }
}

export async function registerClient(body: any): Promise<Result> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return notEnabled()
  const redirectUris: unknown[] = Array.isArray(body?.redirect_uris) ? body.redirect_uris : []
  if (redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every(validRedirect)) {
    return oauthError(400, 'invalid_redirect_uri', 'redirect_uris must be https URLs (or http on localhost).')
  }
  const clientName = String(body?.client_name || 'MCP client').replace(/[^\w .()-]/g, '').slice(0, 60) || 'MCP client'
  const clientId = `ec_${token(18)}`
  const { error } = await supabase
    .from('oauth_clients')
    .insert({ client_id: clientId, client_name: clientName, redirect_uris: redirectUris })
  if (error) return missingTable(error) ? notEnabled() : oauthError(500, 'server_error', 'Could not register the client.')
  return {
    status: 201,
    body: {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
  }
}

export async function describeClient(clientId: string): Promise<Result> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return notEnabled()
  const { data, error } = await supabase.from('oauth_clients').select('client_id, client_name, redirect_uris').eq('client_id', clientId).maybeSingle()
  if (error) return missingTable(error) ? notEnabled() : oauthError(500, 'server_error', 'Lookup failed.')
  if (!data) return oauthError(404, 'invalid_client', 'Unknown client. Ask the app to reconnect.')
  return { status: 200, body: { clientId: data.client_id, clientName: data.client_name, redirectUris: data.redirect_uris } }
}

/** Called by the dashboard consent page with the signed-in user's session. */
export async function approveAuthorization(userId: string, body: any): Promise<Result> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return notEnabled()
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method, scope, approve } = body || {}
  const { data: client } = await supabase.from('oauth_clients').select('*').eq('client_id', String(client_id || '')).maybeSingle()
  if (!client) return oauthError(400, 'invalid_client', 'Unknown client.')
  if (!client.redirect_uris.includes(redirect_uri)) return oauthError(400, 'invalid_request', 'redirect_uri does not match the registered client.')

  const back = new URL(redirect_uri)
  if (state) back.searchParams.set('state', String(state))
  if (approve === false) {
    back.searchParams.set('error', 'access_denied')
    return { status: 200, body: { redirect: back.toString() } }
  }
  if (code_challenge_method !== 'S256' || typeof code_challenge !== 'string' || code_challenge.length < 43) {
    return oauthError(400, 'invalid_request', 'PKCE with S256 is required.')
  }
  const code = token(32)
  const { error } = await supabase.from('oauth_codes').insert({
    code_hash: sha256hex(code),
    client_id: client.client_id,
    user_id: userId,
    redirect_uri,
    code_challenge,
    scope: scope ? String(scope).slice(0, 100) : 'memory',
  })
  if (error) return oauthError(500, 'server_error', 'Could not create the authorization.')
  back.searchParams.set('code', code)
  return { status: 200, body: { redirect: back.toString() } }
}

async function issueTokens(supabase: any, opts: { clientId: string; userId: string; keyId: string; room?: string }) {
  const accessToken = signLiveKey({ uid: opts.userId, kid: opts.keyId, scope: 'personal', room: opts.room || 'my-space' }, undefined, ACCESS_TTL_SECONDS)
  const refreshToken = token(32)
  await supabase.from('oauth_refresh_tokens').insert({
    token_hash: sha256hex(refreshToken),
    client_id: opts.clientId,
    user_id: opts.userId,
    api_key_id: opts.keyId,
  })
  return {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
    body: { access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TTL_SECONDS, refresh_token: refreshToken, scope: 'memory' },
  }
}

export async function exchangeToken(body: any): Promise<Result> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return notEnabled()
  const grant = String(body?.grant_type || '')

  if (grant === 'authorization_code') {
    const { code, redirect_uri, client_id, code_verifier } = body
    if (!code || !code_verifier) return oauthError(400, 'invalid_request', 'code and code_verifier are required.')
    const { data: row } = await supabase.from('oauth_codes').select('*').eq('code_hash', sha256hex(String(code))).maybeSingle()
    if (!row || row.used || new Date(row.expires_at).getTime() < Date.now()) return oauthError(400, 'invalid_grant', 'The code is invalid or expired.')
    if ((client_id && row.client_id !== client_id) || row.redirect_uri !== redirect_uri) return oauthError(400, 'invalid_grant', 'Client or redirect_uri mismatch.')
    const challenge = createHash('sha256').update(String(code_verifier)).digest('base64url')
    if (challenge !== row.code_challenge) return oauthError(400, 'invalid_grant', 'PKCE verification failed.')
    // Single use: only the request that flips `used` gets tokens.
    const { data: claimed } = await supabase.from('oauth_codes').update({ used: true }).eq('code_hash', row.code_hash).eq('used', false).select('code_hash')
    if (!claimed || claimed.length === 0) return oauthError(400, 'invalid_grant', 'The code was already used.')
    const { data: client } = await supabase.from('oauth_clients').select('client_name').eq('client_id', row.client_id).maybeSingle()
    const key = await createApiKey({ userId: row.user_id, name: `${client?.client_name || 'Connector'} (connector)`, scope: 'personal', room: 'my-space' })
    return issueTokens(supabase, { clientId: row.client_id, userId: row.user_id, keyId: (key as any).id })
  }

  if (grant === 'refresh_token') {
    const refresh = String(body?.refresh_token || '')
    if (!refresh) return oauthError(400, 'invalid_request', 'refresh_token is required.')
    const { data: row } = await supabase.from('oauth_refresh_tokens').select('*').eq('token_hash', sha256hex(refresh)).maybeSingle()
    if (!row || row.revoked || (body.client_id && body.client_id !== row.client_id)) return oauthError(400, 'invalid_grant', 'The refresh token is invalid.')
    const key = await getApiKeyRow(row.api_key_id)
    if (!key?.is_active) return oauthError(400, 'invalid_grant', 'Access was revoked on the Engram dashboard.')
    // Rotate: the old refresh token stops working as soon as a new one is issued.
    const { data: rotated } = await supabase.from('oauth_refresh_tokens').update({ revoked: true }).eq('token_hash', row.token_hash).eq('revoked', false).select('token_hash')
    if (!rotated || rotated.length === 0) return oauthError(400, 'invalid_grant', 'The refresh token was already used.')
    return issueTokens(supabase, { clientId: row.client_id, userId: row.user_id, keyId: row.api_key_id, room: key.room })
  }

  return oauthError(400, 'unsupported_grant_type', 'Use authorization_code or refresh_token.')
}
