import { getUserFromRequest } from './_lib/auth.js'
import { createApiKey, listApiKeys, revokeApiKey } from './_lib/db.js'

const HOST = process.env.ENGRAM_MCP_HOST || 'https://engram-pearl.vercel.app'

export default async function handler(req: any, res: any) {
  const method = req.method
  const rawUrl = req.url || ''
  const urlPath = rawUrl.split('?')[0] || ''
  const searchParams = new URLSearchParams(rawUrl.split('?')[1] || '')
  const querySubpath = req.query?.subpath || req.query?.action || searchParams.get('subpath') || searchParams.get('action') || ''
  const path = querySubpath && !urlPath.endsWith('/' + querySubpath) ? `${urlPath}/${querySubpath}` : urlPath
  const action = req.body?.action || querySubpath

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (method === 'OPTIONS') return res.status(200).end()

  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: please sign in to manage API keys.' })
  }

  try {
    // ── Create Key ──
    if (method === 'POST' && req.body?.action !== 'revoke' && (path.endsWith('/create') || !path.includes('/revoke'))) {
      const { name, scope = 'personal', teamId, room = 'my-space' } = req.body || {}
      if (!name) {
        return res.status(400).json({ error: 'Key name is required (e.g. "Work Laptop Cursor", "iPhone Claude").' })
      }

      if (scope === 'team' && !teamId) {
        return res.status(400).json({ error: 'teamId is required for team scope keys.' })
      }

      const key = await createApiKey({
        userId: user.id,
        name: name.trim(),
        scope,
        teamId,
        room: room.trim() || 'my-space',
      })

      // Generate pre-formatted connector URLs
      const connectorUrl = `${HOST}/mcp?token=${encodeURIComponent(key.rawKey)}&room=${encodeURIComponent(key.room)}`

      return res.status(200).json({
        ok: true,
        key: {
          id: key.id,
          name: key.name,
          keyPrefix: key.key_prefix || key.keyPrefix,
          scope: key.scope,
          room: key.room,
          teamId: key.teamId,
          rawKey: key.rawKey, // returned ONLY once on creation!
          connectorUrl,
          createdAt: new Date().toISOString(),
        },
      })
    }

    // ── List Keys ──
    if (method === 'GET' || path.endsWith('/list')) {
      const keys = await listApiKeys(user.id)
      return res.status(200).json({
        ok: true,
        keys: keys.map((k: any) => ({
          ...k,
          connectorUrl: `${HOST}/mcp?token=${encodeURIComponent(k.key_prefix)}...&room=${encodeURIComponent(k.room)}`,
        })),
      })
    }

    // ── Revoke Key ──
    if (method === 'DELETE' || path.endsWith('/revoke') || req.body?.action === 'revoke') {
      const keyId = req.body?.keyId || req.query?.keyId
      if (!keyId) {
        return res.status(400).json({ error: 'keyId is required to revoke an API key.' })
      }

      const revoked = await revokeApiKey(keyId, user.id)
      return res.status(200).json({ ok: revoked, message: revoked ? 'Key revoked successfully.' : 'Key not found.' })
    }

    return res.status(404).json({ error: 'Not found.' })
  } catch (err: any) {
    console.error('[api/keys] error:', err)
    return res.status(500).json({ error: err?.message || 'Key management error.' })
  }
}
