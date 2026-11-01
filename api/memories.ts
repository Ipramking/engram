import { getUserFromRequest } from './_lib/auth'
import { getSupabaseAdmin } from './_lib/supabase'
import { memwalFor, normalizeRecall, decodeMemory, recallMaxDistance, type Scope } from './_lib/memwal'
import { calculateWalrusEpochMetadata } from './_lib/epochs'

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: please sign in to access memory explorer.' })
  }

  const supabase = getSupabaseAdmin()

  // ── DELETE: Remove memory record ──
  if (req.method === 'DELETE') {
    const { id, blobId } = req.query || {}
    if (!id && !blobId) {
      return res.status(400).json({ error: 'id or blobId required for deletion' })
    }

    if (supabase) {
      let query = supabase.from('memories_meta').delete()
      if (id) query = query.eq('id', id)
      else if (blobId) query = query.eq('blob_id', blobId)

      const { error } = await query
      if (error) {
        return res.status(500).json({ error: error.message })
      }
    }
    return res.status(200).json({ ok: true, message: 'Memory deleted' })
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

  let items: any[] = []

  // 1. Query Supabase memories_meta first
  if (supabase) {
    let q = supabase
      .from('memories_meta')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (scope === 'team') {
      if (teamCode !== 'default') {
        q = q.eq('team_id', teamCode)
      }
    } else {
      q = q.eq('user_id', user.id)
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
    const ns = user ? (scope === 'team' ? teamCode : `usr_${user.id}`) : teamCode
    const mem = memwalFor(scope, ns)
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
