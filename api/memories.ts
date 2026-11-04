import { getUserFromRequest, authorizeMemoryAccess } from './_lib/auth.js'
import { getSupabaseAdmin } from './_lib/supabase.js'
import { isTeamMember } from './_lib/db.js'
import { memwalFor, normalizeRecall, decodeMemory, recallMaxDistance, type Scope } from './_lib/memwal.js'
import { calculateWalrusEpochMetadata } from './_lib/epochs.js'
import {
  formatRetentionContract,
  getStorageProvider,
  getRecoveryQueueStats,
  processRecoveryQueue,
} from './_lib/storage.js'

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: please sign in to access memory explorer.' })
  }

  const rawUrl = req.url || ''
  const urlPath = rawUrl.split('?')[0] || ''
  const searchParams = new URLSearchParams(rawUrl.split('?')[1] || '')
  const querySubpath = req.query?.subpath || req.query?.action || searchParams.get('subpath') || searchParams.get('action') || ''
  const isStorage = querySubpath === 'storage' || urlPath.endsWith('/storage') || urlPath.includes('/api/storage')

  // ── Storage Sub-resource Handler (consolidated for Vercel Hobby plan limit) ──
  if (isStorage) {
    try {
      if (req.method === 'GET') {
        const provider = getStorageProvider()
        const stats = getRecoveryQueueStats()
        return res.status(200).json({
          ok: true,
          storageProvider: provider,
          isDurableOnChain: provider !== 'local_mock',
          recoveryQueue: stats,
          timestamp: new Date().toISOString(),
        })
      }

      if (req.method === 'POST') {
        const result = await processRecoveryQueue((scope, teamCode) => memwalFor(scope, teamCode))
        return res.status(200).json({
          ok: true,
          recoveryResult: result,
          queueStats: getRecoveryQueueStats(),
        })
      }

      return res.status(405).json({ error: 'Method not allowed' })
    } catch (err: any) {
      console.error('[api/memories:storage] error:', err)
      return res.status(500).json({ error: err?.message || 'Storage engine error' })
    }
  }

  const supabase = getSupabaseAdmin()

  // ── DELETE: Remove memory record (with IDOR protection) ──
  if (req.method === 'DELETE') {
    const { id, blobId } = req.query || {}
    if (!id && !blobId) {
      return res.status(400).json({ error: 'id or blobId required for deletion' })
    }

    if (supabase) {
      let checkQuery = supabase.from('memories_meta').select('id, user_id, team_id, blob_id').limit(1)
      if (id) checkQuery = checkQuery.eq('id', id)
      else if (blobId) checkQuery = checkQuery.eq('blob_id', blobId)

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
      const retentionInfo = formatRetentionContract(record.blob_id || blobId)
      return res.status(200).json({
        ok: true,
        message: 'Memory unindexed from active recall and metadata removed.',
        ...retentionInfo,
      })
    }
    const retentionInfo = formatRetentionContract(blobId)
    return res.status(200).json({
      ok: true,
      message: 'Memory unindexed from active recall and metadata removed.',
      ...retentionInfo,
    })
  }

  // ── GET: List memories with Epochs, Staking & Conflict status ──
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const scope: Scope = (req.query?.scope as Scope) || 'personal'
  const teamCode = req.query?.teamCode || 'default'
  const typeFilter = req.query?.type
  const searchQuery = (req.query?.search as string) || ''
  const includeSuperseded = req.query?.includeSuperseded === 'true'

  const authRes = await authorizeMemoryAccess({
    user,
    requestedScope: scope,
    requestedTeamCode: teamCode,
  })

  if (!authRes.authorized) {
    return res.status(authRes.statusCode || 403).json({ error: authRes.error })
  }

  const effectiveScope = authRes.effectiveScope
  const effectiveTeamId = authRes.effectiveTeamId

  let items: any[] = []

  // 1. Query Supabase memories_meta first
  if (supabase) {
    let q = supabase
      .from('memories_meta')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (effectiveScope === 'team' && effectiveTeamId) {
      q = q.eq('team_id', effectiveTeamId)
    } else {
      q = q.eq('user_id', user.id).is('team_id', null)
    }

    const { data, error } = await q
    if (!error && data && data.length > 0) {
      items = data.map((row) => {
        const isSuperseded = Boolean(row.room && row.room.startsWith('superseded_by:'))
        const supersededBy = isSuperseded ? row.room.replace('superseded_by:', '') : null
        return {
          id: row.id,
          type: row.type,
          text: row.text,
          blobId: row.blob_id,
          createdAt: row.created_at,
          isSuperseded,
          supersededBy,
        }
      })
    }
  }

  // 2. If no database memories found (e.g. initial demo store or in-memory Walrus), fallback to memwal.recall
  if (items.length === 0) {
    const ns = effectiveScope === 'team' ? effectiveTeamId! : `usr_${user.id}`
    const mem = memwalFor(effectiveScope as Scope, ns)
    const raw = await mem.recall({ query: searchQuery || ' ', topK: 30, maxDistance: recallMaxDistance() }).catch(() => [])
    const norm = normalizeRecall(raw)
    items = norm.map((m, idx) => {
      const dec = decodeMemory(m.text)
      return {
        id: `mem-${idx}`,
        type: dec.type,
        text: dec.text,
        blobId: m.blobId || `mock-blob-00000${idx + 1}`,
        createdAt: new Date().toISOString(),
        isSuperseded: false,
        supersededBy: null,
      }
    })
  }

  // 3. Apply Filters
  if (typeFilter && typeFilter !== 'all') {
    items = items.filter((m) => m.type === typeFilter)
  }
  if (searchQuery.trim()) {
    const qLower = searchQuery.toLowerCase()
    items = items.filter((m) => m.text.toLowerCase().includes(qLower) || m.type.toLowerCase().includes(qLower))
  }
  if (!includeSuperseded) {
    items = items.filter((m) => !m.isSuperseded)
  }

  // 4. Attach Walrus On-Chain Epoch & Staking Metadata
  const enrichedMemories = items.map((m) => ({
    ...m,
    epochMeta: calculateWalrusEpochMetadata({
      blobId: m.blobId,
      planTier: user.plan_tier,
      createdAt: m.createdAt,
    }),
  }))

  const activeCount = enrichedMemories.filter((m) => !m.isSuperseded).length
  const supersededCount = enrichedMemories.filter((m) => m.isSuperseded).length
  const totalWalStaked = (enrichedMemories.length * 0.002).toFixed(3)

  return res.status(200).json({
    ok: true,
    memories: enrichedMemories,
    stats: {
      total: enrichedMemories.length,
      active: activeCount,
      superseded: supersededCount,
      totalWalStaked: Number(totalWalStaked),
      currentEpoch: 24,
      network: 'testnet',
    },
  })
}
