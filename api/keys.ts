import { getUserFromRequest, isMachineToken } from './_lib/auth.js'
import { createApiKey, listApiKeys, revokeApiKey } from './_lib/db.js'
import { signLiveKey } from './_lib/token.js'
import { startDeviceLogin, pollDeviceLogin, describeDeviceLogin, decideDeviceLogin } from './_lib/device.js'

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

  // CLI device login: start and poll run before the CLI has any key.
  if (method === 'POST' && path.endsWith('/device/start')) {
    const r = await startDeviceLogin(req.body, HOST)
    return res.status(r.status).json(r.body)
  }
  if (method === 'POST' && path.endsWith('/device/poll')) {
    const r = await pollDeviceLogin(req.body)
    return res.status(r.status).json(r.body)
  }

  if (isMachineToken(req)) {
    return res.status(403).json({ error: 'API keys cannot manage keys. Sign in to the dashboard instead.' })
  }
  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: please sign in to manage API keys.' })
  }

  // Dashboard side of device login (signed-in session only, enforced above).
  if (method === 'GET' && path.endsWith('/device')) {
    const r = await describeDeviceLogin(String(req.query?.code || searchParams.get('code') || ''))
    return res.status(r.status).json(r.body)
  }
  // Connection links are minted one key at a time, only when the dashboard asks for one.
  if (method === 'POST' && path.endsWith('/link')) {
    const keyId = String(req.body?.keyId || '')
    const k = (await listApiKeys(user.id)).find((x: any) => x.id === keyId && x.is_active !== false)
    if (!k) return res.status(404).json({ error: 'Key not found.' })
    const liveKey = signLiveKey({ uid: user.id, kid: k.id, scope: k.scope || 'personal', tid: k.team_id || undefined, room: k.room || 'my-space' })
    return res.status(200).json({
      ok: true,
      liveKey,
      connectorUrl: `${HOST}/mcp?token=${encodeURIComponent(liveKey)}&room=${encodeURIComponent(k.room || 'my-space')}`,
    })
  }
  if (method === 'POST' && path.endsWith('/device/approve')) {
    const r = await decideDeviceLogin(user.id, req.body)
    return res.status(r.status).json(r.body)
  }

  try {
    // ── Create Key ──
    if (method === 'POST' && req.body?.action !== 'revoke' && (path.endsWith('/create') || !path.includes('/revoke'))) {
      const { name, scope = 'personal', teamId, room = 'my-space', permissions = 'read_write' } = req.body || {}
      if (!['read_write', 'read', 'save'].includes(permissions)) {
        return res.status(400).json({ error: 'permissions must be read_write, read or save.' })
      }
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
        permissions,
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
      let keys = await listApiKeys(user.id)
      // Auto-provision a default personal key if the user has 0 keys so mobile/desktop setup is 1-tap ready
      if (!keys || keys.length === 0) {
        try {
          await createApiKey({
            userId: user.id,
            name: 'Default Mobile & Desktop Key',
            scope: 'personal',
            room: 'my-space',
          })
          keys = await listApiKeys(user.id)
        } catch {}
      }
      // No secrets in the list: links come from POST /api/keys/link on demand.
      return res.status(200).json({ ok: true, keys })
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
