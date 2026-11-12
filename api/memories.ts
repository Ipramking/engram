import { timingSafeEqual } from 'node:crypto'
import { getUserFromRequest, authorizeMemoryAccess, keyCan, permissionError } from './_lib/auth.js'
import { getSupabaseAdmin } from './_lib/supabase.js'
import { isTeamMember } from './_lib/db.js'
import { memwalFor, type Scope } from './_lib/memwal.js'
import { formatRetentionContract, getStorageStats, processRecoveryQueue } from './_lib/storage.js'
import { fetchScopeRows, isSupersededRow, searchMemories, supersededByOf, type MemoryRow } from './_lib/search.js'

const PAGE_DEFAULT = 100
const PAGE_MAX = 500

/** The storage worker is for the operator only: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
function isOperator(req: any): boolean {
  const secret = process.env.CRON_SECRET || process.env.ENGRAM_CRON_SECRET || ''
  if (secret.length < 16) return false
  const header = String(req.headers?.authorization || '')
  const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '')
  const want = Buffer.from(secret)
  return given.length === want.length && timingSafeEqual(given, want)
}

function toItem(row: MemoryRow) {
  return {
    id: row.id,
    type: row.type,
    text: row.text,
    blobId: row.blob_id,
    createdAt: row.created_at,
    isSuperseded: isSupersededRow(row),
    supersededBy: supersededByOf(row),
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const rawUrl = req.url || ''
  const urlPath = rawUrl.split('?')[0] || ''
  const searchParams = new URLSearchParams(rawUrl.split('?')[1] || '')
  const querySubpath = req.query?.subpath || req.query?.action || searchParams.get('subpath') || searchParams.get('action') || ''
  const isStorage = querySubpath === 'storage' || urlPath.endsWith('/storage') || urlPath.includes('/api/storage')

  // ── Storage worker (operator only; consolidated here for the Vercel Hobby function limit) ──
  // Retries Walrus copies that didn't finish during a save, then reports storage health.
  if (isStorage) {
    if (!isOperator(req)) return res.status(403).json({ error: 'Forbidden.' })
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    try {
      const force = (req.query?.force || searchParams.get('force')) === '1'
      const recovery = await processRecoveryQueue((scope, ns) => memwalFor(scope, ns), { maxJobs: 25, force, budgetMs: 20_000 })
      const stats = await getStorageStats()
      return res.status(200).json({ ok: true, recovery, stats, timestamp: new Date().toISOString() })
    } catch (err: any) {
      console.error('[api/storage] worker error:', err?.message || err)
      return res.status(500).json({ error: 'Storage worker failed.' })
    }
  }

  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: please sign in to see your memories.' })
  }

  const supabase = getSupabaseAdmin()

  // ── DELETE: remove one memory (only the row the caller may manage) ──
  if (req.method === 'DELETE') {
    if (!keyCan(user, 'manage')) {
      return res.status(403).json({ error: permissionError('manage'), code: 'KEY_PERMISSION' })
    }
    const { id, blobId } = req.query || {}
    if (!id && !blobId) {
      return res.status(400).json({ error: 'id or blobId required for deletion' })
    }
    if (!supabase) return res.status(503).json({ error: 'Memory storage is not configured.' })

    let checkQuery = supabase.from('memories_meta').select('id, user_id, team_id, blob_id').limit(1)
    if (id) checkQuery = checkQuery.eq('id', id)
    else checkQuery = checkQuery.eq('blob_id', blobId)

    const { data: records, error: checkErr } = await checkQuery
    if (checkErr || !records || records.length === 0) {
      return res.status(404).json({ error: 'Memory not found' })
    }

    const record = records[0]
    const isOwner = record.user_id === user.id
    let isAuthorized = isOwner
    if (!isAuthorized && record.team_id) {
      isAuthorized = await isTeamMember(user.id, record.team_id)
    }

    // An API key may only delete inside its own scope: team keys their team, personal keys personal rows.
    const key = (user as any).apiKey
    if (isAuthorized && key) {
      isAuthorized = key.scope === 'team' ? Boolean(key.team_id) && record.team_id === key.team_id : !record.team_id && isOwner
    }
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: you do not have permission to delete this memory' })
    }

    // Delete exactly the row that was authorized, never every row sharing a blob id.
    const { error } = await supabase.from('memories_meta').delete().eq('id', record.id)
    if (error) {
      console.error('[api/memories] delete failed:', error.message)
      return res.status(500).json({ error: 'Could not delete the memory. Try again.' })
    }
    return res.status(200).json({
      ok: true,
      message: 'Memory deleted. It no longer appears in recall.',
      ...formatRetentionContract(record.blob_id),
    })
  }

  // ── GET: list memories (newest first, pageable) or search them ──
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!keyCan(user, 'read')) {
    return res.status(403).json({ error: permissionError('read'), code: 'KEY_PERMISSION' })
  }

  const q = (k: string) => (req.query?.[k] ?? searchParams.get(k) ?? '') as string
  const scope: Scope = q('scope') === 'team' ? 'team' : 'personal'
  const authRes = await authorizeMemoryAccess({ user, requestedScope: scope, requestedTeamCode: q('teamCode') || 'default' })
  if (!authRes.authorized) {
    return res.status(authRes.statusCode || 403).json({ error: authRes.error })
  }
  if (!supabase) return res.status(200).json({ ok: true, memories: [], nextBefore: null, stats: { total: 0, active: 0, superseded: 0 } })

  const effectiveScope = authRes.effectiveScope as Scope
  const teamId = effectiveScope === 'team' ? authRes.effectiveTeamId : null
  const typeFilter = q('type')
  const search = q('search').trim().slice(0, 300)
  const includeSuperseded = q('includeSuperseded') === 'true'
  const limit = Math.min(Math.max(Number(q('limit')) || PAGE_DEFAULT, 1), PAGE_MAX)
  const before = q('before') && !Number.isNaN(Date.parse(q('before'))) ? new Date(q('before')).toISOString() : undefined

  try {
    let rows: MemoryRow[]
    let nextBefore: string | null = null
    if (search && !includeSuperseded) {
      // Same ranking as recall: word forms, prefixes and typos.
      const found = await searchMemories(supabase, { scope: effectiveScope, userId: user.id, teamId, query: search, limit: 50 })
      rows = found.rows
    } else {
      rows = await fetchScopeRows(supabase, { scope: effectiveScope, userId: user.id, teamId, limit, before, type: typeFilter })
      if (rows.length === limit) nextBefore = rows[rows.length - 1].created_at
      if (search) {
        const needle = search.toLowerCase()
        rows = rows.filter((r) => r.text.toLowerCase().includes(needle) || r.type.toLowerCase().includes(needle))
      }
    }

    let items = rows.map(toItem)
    if (typeFilter && typeFilter !== 'all') items = items.filter((m) => m.type === typeFilter)
    if (!includeSuperseded) items = items.filter((m) => !m.isSuperseded)

    const superseded = items.filter((m) => m.isSuperseded).length
    return res.status(200).json({
      ok: true,
      memories: items,
      nextBefore,
      stats: { total: items.length, active: items.length - superseded, superseded },
    })
  } catch (err: any) {
    console.error('[api/memories] list failed:', err?.message || err)
    return res.status(500).json({ error: 'Could not load memories. Try again.' })
  }
}
