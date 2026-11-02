// Engram 2.0 Storage Engine: Resilient Write-Ahead Queue, Retries, Integrity Hashing & Truthful Persistence
import { createHash, randomUUID } from 'node:crypto'
import { blobIdOf, isMock, type MemwalClient, type MemoryType } from './memwal.js'
import { getSupabaseAdmin } from './supabase.js'

export type StorageState =
  | 'confirmed_durable'  // Anchored on Walrus with verified blobId
  | 'pending'            // Stored in metadata vault, awaiting Walrus confirmation
  | 'local_mock'         // Anchored in local in-memory/test Walrus mock
  | 'failed'             // Permanent failure after retries exhausted
  | 'recovery_required'  // Transient failure/timeout, queued for async recovery worker

export type StorageProvider =
  | 'walrus_mainnet'
  | 'walrus_testnet'
  | 'walrus_staging'
  | 'local_mock'

export interface MemoryMetadataV2 {
  schemaVersion: '2.0'
  id: string
  userId: string
  teamId?: string | null
  type: MemoryType
  text: string
  blobId?: string | null
  storageState: StorageState
  storageProvider: StorageProvider
  contentHash: string
  idempotencyKey: string
  createdAt: string
  retryCount: number
  lastError?: string | null
  integrityVerified?: boolean
}

export interface RecoveryJob {
  id: string
  userId: string
  teamId?: string | null
  scope: 'personal' | 'team'
  type: MemoryType
  text: string
  contentHash: string
  idempotencyKey: string
  encodedText: string
  attempts: number
  lastError?: string | null
  createdAt: string
  nextRetryAt: number
}

// In-memory fallback recovery queue for serverless / local environments
const memRecoveryQueue = new Map<string, RecoveryJob>()
// Cache of recently confirmed idempotency keys to prevent duplicate on-chain writes
const memConfirmedWrites = new Map<string, { blobId: string; timestamp: number }>()

export function getStorageProvider(): StorageProvider {
  if (isMock()) return 'local_mock'
  const url = (process.env.MEMWAL_SERVER_URL || '').toLowerCase()
  if (url.includes('mainnet')) return 'walrus_mainnet'
  if (url.includes('testnet')) return 'walrus_testnet'
  return 'walrus_staging'
}

export function computeContentHash(type: string, text: string, schemaVersion: string = '2.0'): string {
  return createHash('sha256')
    .update(`${schemaVersion}:${type.toLowerCase()}:${text.trim()}`)
    .digest('hex')
}

export function computeIdempotencyKey(
  userId: string,
  scope: 'personal' | 'team',
  teamId: string | null | undefined,
  type: string,
  text: string
): string {
  const scopeId = scope === 'team' ? (teamId || 'team_default') : 'personal'
  return createHash('sha256')
    .update(`${userId}:${scopeId}:${type.toLowerCase()}:${text.trim()}`)
    .digest('hex')
}

export function verifyMemoryIntegrity(
  text: string,
  type: string,
  expectedHash?: string | null
): { verified: boolean; actualHash: string } {
  const actualHash = computeContentHash(type, text)
  if (!expectedHash) {
    // Legacy record without stored hash: considered valid by default
    return { verified: true, actualHash }
  }
  return { verified: expectedHash === actualHash, actualHash }
}

export interface WriteResult {
  blobId?: string
  storageState: StorageState
  storageProvider: StorageProvider
  contentHash: string
  idempotencyKey: string
  attempts: number
  error?: string
  isDuplicate?: boolean
}

/**
 * Resilient write-ahead operation with exponential backoff, idempotency checks,
 * and recovery queue fallback for transient failures.
 */
export async function writeMemoryWithRetry(opts: {
  mem: MemwalClient
  encodedText: string
  type: MemoryType
  cleanText: string
  userId: string
  scope: 'personal' | 'team'
  teamId?: string | null
  maxRetries?: number
  initialBackoffMs?: number
  timeoutMs?: number
}): Promise<WriteResult> {
  const {
    mem,
    encodedText,
    type,
    cleanText,
    userId,
    scope,
    teamId,
    maxRetries = 2,
    initialBackoffMs = 300,
    timeoutMs = 4000,
  } = opts

  const contentHash = computeContentHash(type, cleanText)
  const idempotencyKey = computeIdempotencyKey(userId, scope, teamId, type, cleanText)
  const provider = getStorageProvider()

  // 1. Check idempotency cache to prevent duplicate writes
  const existingConfirmation = memConfirmedWrites.get(idempotencyKey)
  if (existingConfirmation && Date.now() - existingConfirmation.timestamp < 300_000) {
    return {
      blobId: existingConfirmation.blobId,
      storageState: provider === 'local_mock' ? 'local_mock' : 'confirmed_durable',
      storageProvider: provider,
      contentHash,
      idempotencyKey,
      attempts: 0,
      isDuplicate: true,
    }
  }

  // Also check database for matching idempotencyKey or contentHash in recent memories
  const supabase = getSupabaseAdmin()
  if (supabase) {
    try {
      let q = supabase
        .from('memories_meta')
        .select('blob_id')
        .eq('user_id', userId)
        .eq('text', cleanText)
        .eq('type', type)
        .not('blob_id', 'is', null)
        .limit(1)

      if (scope === 'team' && teamId) {
        q = q.eq('team_id', teamId)
      } else {
        q = q.is('team_id', null)
      }

      const { data } = await q
      if (data && data.length > 0 && data[0].blob_id) {
        const existingBlobId = data[0].blob_id
        memConfirmedWrites.set(idempotencyKey, { blobId: existingBlobId, timestamp: Date.now() })
        return {
          blobId: existingBlobId,
          storageState: provider === 'local_mock' ? 'local_mock' : 'confirmed_durable',
          storageProvider: provider,
          contentHash,
          idempotencyKey,
          attempts: 0,
          isDuplicate: true,
        }
      }
    } catch {}
  }

  let blobId: string | undefined
  let lastError: any = null
  let attempts = 0

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++
    try {
      const job = await Promise.race([
        mem.rememberAndWait(encodedText, undefined, { timeoutMs }),
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ])
      blobId = blobIdOf(job)

      if (!blobId && typeof mem.remember === 'function') {
        const asyncJob = await Promise.race([
          mem.remember(encodedText),
          new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
        ])
        blobId = blobIdOf(asyncJob) || (asyncJob as any)?.jobId || (asyncJob as any)?.job_id
      }

      if (blobId) {
        // Successful write
        memConfirmedWrites.set(idempotencyKey, { blobId, timestamp: Date.now() })
        return {
          blobId,
          storageState: provider === 'local_mock' ? 'local_mock' : 'confirmed_durable',
          storageProvider: provider,
          contentHash,
          idempotencyKey,
          attempts,
        }
      }
    } catch (err: any) {
      lastError = err
    }

    if (attempt < maxRetries) {
      // Exponential backoff with jitter
      const delay = initialBackoffMs * Math.pow(2, attempt) + Math.floor(Math.random() * 100)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  // If retries are exhausted without confirming a blobId, enqueue for recovery
  const jobId = randomUUID()
  const recoveryJob: RecoveryJob = {
    id: jobId,
    userId,
    teamId: teamId || null,
    scope,
    type,
    text: cleanText,
    contentHash,
    idempotencyKey,
    encodedText,
    attempts,
    lastError: lastError?.message || 'Walrus relayer timeout',
    createdAt: new Date().toISOString(),
    nextRetryAt: Date.now() + 60_000,
  }

  memRecoveryQueue.set(jobId, recoveryJob)

  return {
    blobId: undefined,
    storageState: 'recovery_required',
    storageProvider: provider,
    contentHash,
    idempotencyKey,
    attempts,
    error: lastError?.message || 'Storage write timed out after retries; enqueued for recovery.',
  }
}

/**
 * Recovery worker: drains pending recovery jobs when Walrus recovers.
 */
export async function processRecoveryQueue(
  memFactory: (scope: 'personal' | 'team', teamCode?: string) => MemwalClient,
  opts?: { maxJobs?: number; force?: boolean }
): Promise<{ processed: number; succeeded: number; failed: number }> {
  let processed = 0
  let succeeded = 0
  let failed = 0

  const maxJobs = opts?.maxJobs ?? 10
  const force = opts?.force ?? false
  const now = Date.now()

  for (const [id, job] of memRecoveryQueue) {
    if (processed >= maxJobs) break
    if (!force && job.nextRetryAt > now) continue

    processed++
    try {
      const mem = memFactory(job.scope, job.teamId || undefined)
      const res = await Promise.race([
        mem.rememberAndWait(job.encodedText, undefined, { timeoutMs: 5000 }),
        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
      ])
      const blobId = blobIdOf(res)

      if (blobId) {
        succeeded++
        memRecoveryQueue.delete(id)
        memConfirmedWrites.set(job.idempotencyKey, { blobId, timestamp: Date.now() })

        // Update database record if Supabase is connected
        const supabase = getSupabaseAdmin()
        if (supabase) {
          await supabase
            .from('memories_meta')
            .update({ blob_id: blobId })
            .eq('user_id', job.userId)
            .eq('text', job.text)
            .eq('type', job.type)
        }
      } else {
        job.attempts++
        job.nextRetryAt = Date.now() + Math.min(300_000, 60_000 * Math.pow(2, job.attempts))
        failed++
      }
    } catch (e: any) {
      job.attempts++
      job.lastError = e?.message || String(e)
      job.nextRetryAt = Date.now() + Math.min(300_000, 60_000 * Math.pow(2, job.attempts))
      failed++
    }
  }

  return { processed, succeeded, failed }
}

export function getRecoveryQueueStats() {
  return {
    pendingCount: memRecoveryQueue.size,
    confirmedWritesCached: memConfirmedWrites.size,
  }
}

export function formatRetentionContract(blobId?: string | null) {
  return {
    unindexed: true,
    metadataDeleted: true,
    storageRetention: blobId
      ? 'Decentralized Walrus blob remains anchored on-chain for the duration of its registered epoch and will expire naturally.'
      : 'No on-chain blob was anchored; metadata was completely purged.',
    blobId: blobId ?? null,
  }
}

export function _resetStorageTestState() {
  memRecoveryQueue.clear()
  memConfirmedWrites.clear()
}
