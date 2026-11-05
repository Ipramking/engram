import { useCallback, useEffect, useMemo, useState } from 'react'
import { safeJson } from '../../lib/api'
import type { ActiveCredential, ApiKey, Memory, MemoryStats, Scope, Team, TeamMember, UsageData } from './types'

type Result<T = any> = { ok: boolean; status: number; data: T }

export const MEMORY_TYPES = ['decision', 'config', 'gotcha', 'person', 'preference', 'plan'] as const

/** Reads the `exp` claim out of an `eng_live_<payload>.<mac>` token without verifying it. */
export function liveKeyExpiry(token?: string): Date | null {
  if (!token || !token.startsWith('eng_live_')) return null
  try {
    const encoded = token.slice('eng_live_'.length).split('.')[0]
    const json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    const exp = JSON.parse(json)?.exp
    return typeof exp === 'number' ? new Date(exp * 1000) : null
  } catch {
    return null
  }
}

/** Real Walrus blob ids are 43-char base64url; Engram's cloud store uses UUIDs. */
export function isWalrusBlobId(id?: string | null) {
  return Boolean(id && /^[A-Za-z0-9_-]{43}$/.test(id))
}

export function maskSecret(s: string, keep = 12) {
  return s.length <= keep ? s : `${s.slice(0, keep)}••••••`
}

export function maskUrl(url: string) {
  return url.replace(/(token=)([^&]+)/, (_, p, t: string) => `${p}${maskSecret(decodeURIComponent(t), 12)}`)
}

export function useDashboard(authToken: string | null) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [recent, setRecent] = useState<Memory[]>([])
  const [recentStats, setRecentStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  // Permanent secrets are returned once on creation; keep them in memory for this tab only.
  const [secrets, setSecrets] = useState<Record<string, { rawKey: string; connectorUrl: string }>>({})
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null)
  // 30-day connection links, fetched one key at a time and only when a page needs them.
  const [links, setLinks] = useState<Record<string, { token: string; url: string }>>({})

  const call = useCallback(
    async <T = any>(path: string, init: RequestInit = {}): Promise<Result<T>> => {
      if (!authToken) return { ok: false, status: 401, data: { error: 'Not signed in.' } as T }
      try {
        const res = await fetch(path, {
          ...init,
          headers: {
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${authToken}`,
            ...(init.headers || {}),
          },
        })
        return { ok: res.ok, status: res.status, data: await safeJson<T>(res) }
      } catch (err: any) {
        return { ok: false, status: 0, data: { error: err?.message || 'Network error. Check your connection.' } as T }
      }
    },
    [authToken],
  )

  const refresh = useCallback(async () => {
    if (!authToken) return
    setLoadError(null)
    const [k, t, u, m] = await Promise.all([
      call('/api/keys'),
      call('/api/teams'),
      call('/api/usage'),
      call('/api/memories?scope=personal&includeSuperseded=false'),
    ])
    if (k.ok) setKeys(k.data?.keys || [])
    if (t.ok) setTeams(t.data?.teams || [])
    if (u.ok) setUsage(u.data)
    if (m.ok && m.data?.ok) {
      setRecent(m.data.memories || [])
      setRecentStats(m.data.stats || null)
    }
    if (k.status === 401 && u.status === 401) setSessionExpired(true)
    else if (!k.ok && !t.ok && !u.ok) setLoadError(k.data?.error || 'Could not reach Engram. Try again in a moment.')
    setLoading(false)
  }, [authToken, call])

  useEffect(() => {
    refresh()
  }, [refresh])

  const credential: ActiveCredential | null = useMemo(() => {
    const key =
      keys.find((k) => k.id === activeKeyId) || keys.find((k) => k.scope === 'personal') || keys[0]
    if (!key) return null
    const secret = secrets[key.id]
    if (secret) {
      return { key, token: secret.rawKey, url: secret.connectorUrl, permanent: true, expiresAt: null }
    }
    const link = links[key.id]
    return { key, token: link?.token || '', url: link?.url || '', permanent: false, expiresAt: liveKeyExpiry(link?.token) }
  }, [keys, activeKeyId, secrets, links])

  const ensureLink = useCallback(
    async (keyId: string): Promise<{ token: string; url: string } | null> => {
      if (secrets[keyId]) return { token: secrets[keyId].rawKey, url: secrets[keyId].connectorUrl }
      if (links[keyId]) return links[keyId]
      const r = await call('/api/keys/link', { method: 'POST', body: JSON.stringify({ keyId }) })
      if (!r.ok || !r.data?.liveKey) return null
      const link = { token: r.data.liveKey as string, url: r.data.connectorUrl as string }
      setLinks((l) => ({ ...l, [keyId]: link }))
      return link
    },
    [call, secrets, links],
  )

  // Pages that show the active key's link fetch it on first render.
  const activeId = credential?.key.id
  useEffect(() => {
    if (activeId && !credential?.url) ensureLink(activeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const origin = useMemo(() => {
    try {
      return credential ? new URL(credential.url).origin : window.location.origin
    } catch {
      return window.location.origin
    }
  }, [credential])

  async function createKey(input: { name: string; scope: Scope; teamId?: string; room: string; permissions?: 'read_write' | 'read' | 'save' }) {
    const r = await call('/api/keys?action=create', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', ...input, teamId: input.scope === 'team' ? input.teamId : undefined }),
    })
    if (!r.ok || !r.data?.key) return { ok: false as const, error: r.data?.error || 'Could not create the key.' }
    const created = r.data.key
    setSecrets((s) => ({ ...s, [created.id]: { rawKey: created.rawKey, connectorUrl: created.connectorUrl } }))
    setActiveKeyId(created.id)
    await refresh()
    return { ok: true as const, rawKey: created.rawKey as string, connectorUrl: created.connectorUrl as string }
  }

  async function revokeKey(keyId: string) {
    const r = await call('/api/keys?action=revoke', { method: 'POST', body: JSON.stringify({ action: 'revoke', keyId }) })
    if (r.ok && r.data?.ok !== false) {
      setKeys((ks) => ks.filter((k) => k.id !== keyId))
      if (activeKeyId === keyId) setActiveKeyId(null)
      return { ok: true as const }
    }
    return { ok: false as const, error: r.data?.error || r.data?.message || 'Could not revoke the key.' }
  }

  async function createTeam(name: string) {
    const r = await call('/api/teams?action=create', { method: 'POST', body: JSON.stringify({ action: 'create', name }) })
    if (!r.ok || !r.data?.team) return { ok: false as const, error: r.data?.error || 'Could not create the team.' }
    await refresh()
    return { ok: true as const, team: r.data.team as Team }
  }

  async function loadMembers(teamId: string): Promise<TeamMember[]> {
    const r = await call(`/api/teams?action=members&teamId=${encodeURIComponent(teamId)}`)
    return r.ok && r.data?.ok ? r.data.members || [] : []
  }

  async function invite(teamId: string, email: string, role: string) {
    const r = await call('/api/teams?action=invite', {
      method: 'POST',
      body: JSON.stringify({ action: 'invite', teamId, email, role }),
    })
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.data?.error || 'Could not send the invite.' }
  }

  async function listMemories(params: { scope: Scope; teamId?: string; type: string; includeSuperseded: boolean; search: string }) {
    const qs = new URLSearchParams({
      scope: params.scope,
      teamCode: params.teamId || 'default',
      type: params.type,
      includeSuperseded: String(params.includeSuperseded),
      search: params.search.trim(),
    })
    const r = await call(`/api/memories?${qs}`)
    if (r.ok && r.data?.ok) return { ok: true as const, memories: (r.data.memories || []) as Memory[], stats: r.data.stats as MemoryStats }
    return { ok: false as const, error: r.data?.error || 'Could not load memories.' }
  }

  async function saveMemory(input: { text: string; type: string; scope: Scope; teamId?: string }) {
    const r = await call('/api/remember', {
      method: 'POST',
      body: JSON.stringify({ text: input.text, type: input.type, scope: input.scope, teamCode: input.teamId || 'default' }),
    })
    if (!r.ok || !r.data?.ok) return { ok: false as const, error: r.data?.error || 'Could not save the memory.' }
    refresh()
    return { ok: true as const, superseded: (r.data.superseded || []) as Array<{ oldText: string }> }
  }

  async function deleteMemory(id: string) {
    const r = await call(`/api/memories?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (r.ok && r.data?.ok) {
      setRecent((ms) => ms.filter((m) => m.id !== id))
      return { ok: true as const }
    }
    return { ok: false as const, error: r.data?.error || 'Could not delete the memory.' }
  }

  async function deviceInfo(code: string) {
    const r = await call(`/api/keys/device?code=${encodeURIComponent(code)}`)
    return r.ok ? { ok: true as const, deviceName: r.data.deviceName as string, status: r.data.status as string } : { ok: false as const, error: r.data?.error || 'Login request not found.' }
  }

  async function decideDevice(code: string, approve: boolean) {
    const r = await call('/api/keys/device/approve', { method: 'POST', body: JSON.stringify({ code, approve }) })
    if (r.ok) refresh()
    return r.ok ? { ok: true as const, keyName: r.data.keyName as string | undefined } : { ok: false as const, error: r.data?.error || 'Could not complete the request.' }
  }

  async function deleteAccount() {
    const r = await call('/api/auth/delete-account', { method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) })
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.data?.error || 'Could not delete the account.' }
  }

  async function approveTelegram(code: string) {
    const r = await call('/api/connect/telegram-link', { method: 'POST', body: JSON.stringify({ code }) })
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.data?.error || 'Could not connect the chat.' }
  }

  /** Calls the hosted MCP endpoint exactly like a client would, to prove the link works. */
  async function testConnection(url: string) {
    const started = performance.now()
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
      const data = await safeJson<any>(res)
      const ms = Math.round(performance.now() - started)
      if (res.ok && Array.isArray(data?.result?.tools)) {
        return { ok: true as const, ms, tools: data.result.tools.map((t: any) => t.name as string) }
      }
      return { ok: false as const, ms, error: data?.error?.message || data?.error || `HTTP ${res.status}` }
    } catch (err: any) {
      return { ok: false as const, ms: Math.round(performance.now() - started), error: err?.message || 'Network error' }
    }
  }

  return {
    keys,
    teams,
    usage,
    recent,
    recentStats,
    loading,
    loadError,
    sessionExpired,
    credential,
    ensureLink,
    origin,
    activeKeyId,
    setActiveKeyId,
    refresh,
    createKey,
    revokeKey,
    createTeam,
    loadMembers,
    invite,
    listMemories,
    saveMemory,
    deleteMemory,
    testConnection,
    deviceInfo,
    decideDevice,
    approveTelegram,
    deleteAccount,
  }
}

export type Dashboard = ReturnType<typeof useDashboard>
