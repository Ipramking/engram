// Connections into Engram from other apps: OAuth 2.1 ("Sign in with Engram") for MCP connectors
// and the Telegram bot webhook. One function keeps the project within Vercel's function limit.
import { getUserFromRequest, isMachineToken } from './_lib/auth.js'
import {
  approveAuthorization,
  authorizationServerMetadata,
  describeClient,
  exchangeToken,
  protectedResourceMetadata,
  registerClient,
} from './_lib/oauth.js'
import { approveTelegramLink, handleTelegramUpdate, telegramInfo } from './_lib/telegram.js'

const HOST = (globalThis as any).process?.env?.ENGRAM_MCP_HOST || 'https://engram-pearl.vercel.app'

export default async function handler(req: any, res: any) {
  const rawUrl = req.url || ''
  const searchParams = new URLSearchParams(rawUrl.split('?')[1] || '')
  const sub = String(req.query?.subpath || searchParams.get('subpath') || '')
  const method = req.method

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (method === 'OPTIONS') return res.status(204).end()

  const send = (r: { status: number; body: any; headers?: Record<string, string> }) => {
    for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v)
    return res.status(r.status).json(r.body)
  }

  // Discovery documents (public).
  if (sub === 'asm') return res.status(200).json(authorizationServerMetadata(HOST))
  if (sub === 'prm') return res.status(200).json(protectedResourceMetadata(HOST))

  // Client-facing OAuth endpoints (no user session; the client app calls these).
  if (sub === 'register' && method === 'POST') return send(await registerClient(req.body))
  if (sub === 'token' && method === 'POST') return send(await exchangeToken(req.body))
  if (sub === 'client' && method === 'GET') return send(await describeClient(String(req.query?.client_id || searchParams.get('client_id') || '')))

  // Telegram webhook (authenticated by Telegram's secret header) and public bot info.
  if (sub === 'telegram' && method === 'POST') return send(await handleTelegramUpdate(req, HOST))
  if (sub === 'telegram-info' && method === 'GET') return res.status(200).json(telegramInfo())

  // Dashboard actions: a signed-in person, never an API key.
  if ((sub === 'authorize' || sub === 'telegram-link') && method === 'POST') {
    if (isMachineToken(req)) return res.status(403).json({ error: 'Sign in to the dashboard to approve connections.' })
    const user = await getUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Sign in to approve this connection.' })
    if (sub === 'authorize') return send(await approveAuthorization(user.id, req.body))
    return send(await approveTelegramLink(user.id, req.body?.code))
  }

  return res.status(404).json({ error: 'Not found.' })
}
