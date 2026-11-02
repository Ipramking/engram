import { getUserFromRequest } from './_lib/auth.js'
import {
  getStorageProvider,
  getRecoveryQueueStats,
  processRecoveryQueue,
} from './_lib/storage.js'
import { memwalFor } from './_lib/memwal.js'

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: please sign in to inspect storage status.' })
  }

  const method = req.method
  const rawUrl = req.url || ''
  const path = rawUrl.split('?')[0] || ''

  try {
    if (method === 'GET') {
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

    if (method === 'POST') {
      const result = await processRecoveryQueue((scope, teamCode) => memwalFor(scope, teamCode))
      return res.status(200).json({
        ok: true,
        recoveryResult: result,
        queueStats: getRecoveryQueueStats(),
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[api/storage] error:', err)
    return res.status(500).json({ error: err?.message || 'Storage engine error' })
  }
}
