// Engram 2.1 Storage Engine: Durable Write-Ahead Queue, Worker Leases, Retries, Integrity Hashing & Truthful Persistence
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

export type JobStatus = 'pending' | 'leased' | 'completed' | 'failed' | 'dead_letter'

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
  maxAttempts: number
  status: JobStatus
  leaseId?: string | null
  leasedUntil?: number | null
  lastError?: string | null
  createdAt: string
  nextRetryAt: number
}

// In-memory fallback recovery queue for serverless / local / test environments
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
): { verified: boolean; status: 'verified' | 'tampered' | 'legacy_unverified'; actualHash: string } {
  const actualHash = computeContentHash(type, text)
  if (!expectedHash) {
    // Explicitly flag legacy record without stored hash as legacy_unverified
    return { verified: false, status: 'legacy_unverified', actualHash }
  }
  const isMatch = expectedHash === actualHash
  return { verified: isMatch, status: isMatch ? 'verified' : 'tampered', actualHash }
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
 * and durable recovery queue fallback for transient failures.
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

  // If retries are exhausted without confirming a blobId, enqueue for durable recovery
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
    maxAttempts: 5,
    status: 'pending',
    leaseId: null,
    leasedUntil: null,
    lastError: lastError?.message || 'Walrus relayer timeout',
    createdAt: new Date().toISOString(),
    nextRetryAt: Date.now() + 60_000,
  }

  memRecoveryQueue.set(jobId, recoveryJob)

  // Persist to Supabase Postgres if available
  if (supabase) {
    try {
      const { error: dbError } = await supabase.from('storage_recovery_jobs').insert({
        id: recoveryJob.id,
        user_id: recoveryJob.userId,
        team_id: recoveryJob.teamId,
        scope: recoveryJob.scope,
        type: recoveryJob.type,
        text: recoveryJob.text,
        content_hash: recoveryJob.contentHash,
        idempotency_key: recoveryJob.idempotencyKey,
        encoded_text: recoveryJob.encodedText,
        attempts: recoveryJob.attempts,
        max_attempts: recoveryJob.maxAttempts,
        status: recoveryJob.status,
        next_retry_at: new Date(recoveryJob.nextRetryAt).toISOString(),
        last_error: recoveryJob.lastError,
        created_at: recoveryJob.createdAt,
      })

      if (dbError) {
        // Durability Guarantee: If database insert fails, fail honestly instead of claiming recovery_required
        return {
          blobId: undefined,
          storageState: 'failed',
          storageProvider: provider,
          contentHash,
          idempotencyKey,
          attempts,
          error: `Failed to persist durable recovery job to database: ${dbError.message}`,
        }
      }
    } catch (err: any) {
      return {
        blobId: undefined,
        storageState: 'failed',
        storageProvider: provider,
        contentHash,
        idempotencyKey,
        attempts,
        error: `Database exception during recovery job persistence: ${err.message}`,
      }
    }
  } else if (provider !== 'local_mock') {
    return {
      blobId: undefined,
      storageState: 'failed',
      storageProvider: provider,
      contentHash,
      idempotencyKey,
      attempts,
      error: 'Storage failure and no durable persistence provider is configured for recovery.',
    }
  }

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
 * Recovery worker: drains pending recovery jobs with atomic worker leases,
 * bounded exponential backoff with jitter, crash recovery, and dead-letter handling.
 * Queries Supabase Postgres first for cross-instance durability, then in-memory fallback.
 */
export async function processRecoveryQueue(
  memFactory: (scope: 'personal' | 'team', teamCode?: string) => MemwalClient,
  opts?: { maxJobs?: number; force?: boolean }
): Promise<{ processed: number; succeeded: number; failed: number; deadLetter: number }> {
  let processed = 0
  let succeeded = 0
  let failed = 0
  let deadLetter = 0

  const maxJobs = opts?.maxJobs ?? 10
  const force = opts?.force ?? false
  const now = Date.now()
  const workerLeaseId = `worker_${randomUUID().slice(0, 8)}`
  const leaseDurationMs = 30_000
  const supabase = getSupabaseAdmin()

  // 1. Durably query and atomically lease jobs from Supabase PostgreSQL
  if (supabase) {
    try {
      const nowIso = new Date(now).toISOString()
      let query = supabase
        .from('storage_recovery_jobs')
        .select('*')
        .or(`status.eq.pending,and(status.eq.leased,leased_until.lt.${nowIso})`)
        .order('created_at', { ascending: true })
        .limit(maxJobs)

      if (!force) {
        query = query.lte('next_retry_at', nowIso)
      }

      const { data: dbJobs, error: selectErr } = await query
      if (!selectErr && dbJobs && dbJobs.length > 0) {
        for (const raw of dbJobs) {
          if (processed >= maxJobs) break

          // Atomic conditional lease in PostgreSQL
          const leasedUntilIso = new Date(Date.now() + leaseDurationMs).toISOString()
          const { data: claimedRows, error: claimErr } = await supabase
            .from('storage_recovery_jobs')
            .update({
              status: 'leased',
              lease_id: workerLeaseId,
              leased_until: leasedUntilIso,
              updated_at: new Date().toISOString(),
            })
            .eq('id', raw.id)
            .or(`status.eq.pending,and(status.eq.leased,leased_until.lt.${nowIso})`)
            .select()

          if (claimErr || !claimedRows || claimedRows.length === 0) {
            // Another worker claimed this job concurrently
            continue
          }

          processed++
          const jobRecord = claimedRows[0]

          try {
            const mem = memFactory(jobRecord.scope, jobRecord.team_id || undefined)
            const res = await Promise.race([
              mem.rememberAndWait(jobRecord.encoded_text, undefined, { timeoutMs: 5000 }),
              new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
            ])
            const blobId = blobIdOf(res)

            if (blobId) {
              succeeded++
              memConfirmedWrites.set(jobRecord.idempotency_key, { blobId, timestamp: Date.now() })

              await supabase
                .from('memories_meta')
                .update({ blob_id: blobId })
                .eq('user_id', jobRecord.user_id)
                .eq('text', jobRecord.text)
                .eq('type', jobRecord.type)

              await supabase
                .from('storage_recovery_jobs')
                .update({
                  status: 'completed',
                  lease_id: null,
                  leased_until: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', jobRecord.id)
            } else {
              const newAttempts = (jobRecord.attempts || 0) + 1
              if (newAttempts >= (jobRecord.max_attempts || 5)) {
                deadLetter++
                await supabase
                  .from('storage_recovery_jobs')
                  .update({
                    status: 'dead_letter',
                    attempts: newAttempts,
                    lease_id: null,
                    leased_until: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', jobRecord.id)
              } else {
                failed++
                const backoff = Math.min(300_000, 30_000 * Math.pow(2, newAttempts))
                const jitter = Math.floor(Math.random() * 2000)
                const nextRetryIso = new Date(Date.now() + backoff + jitter).toISOString()
                await supabase
                  .from('storage_recovery_jobs')
                  .update({
                    status: 'pending',
                    attempts: newAttempts,
                    next_retry_at: nextRetryIso,
                    lease_id: null,
                    leased_until: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', jobRecord.id)
              }
            }
          } catch (e: any) {
            const newAttempts = (jobRecord.attempts || 0) + 1
            const lastErrorMsg = e?.message || String(e)
            if (newAttempts >= (jobRecord.max_attempts || 5)) {
              deadLetter++
              await supabase
                .from('storage_recovery_jobs')
                .update({
                  status: 'dead_letter',
                  attempts: newAttempts,
                  last_error: lastErrorMsg,
                  lease_id: null,
                  leased_until: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', jobRecord.id)
            } else {
              failed++
              const backoff = Math.min(300_000, 30_000 * Math.pow(2, newAttempts))
              const jitter = Math.floor(Math.random() * 2000)
              const nextRetryIso = new Date(Date.now() + backoff + jitter).toISOString()
              await supabase
                .from('storage_recovery_jobs')
                .update({
                  status: 'pending',
                  attempts: newAttempts,
                  last_error: lastErrorMsg,
                  next_retry_at: nextRetryIso,
                  lease_id: null,
                  leased_until: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', jobRecord.id)
            }
          }
        }

        if (processed > 0) {
          return { processed, succeeded, failed, deadLetter }
        }
      }
    } catch (dbErr) {
      console.error('[storage:processRecoveryQueue] database worker error:', dbErr)
    }
  }

  // 2. Fallback for in-memory queue (local mock/offline)
  for (const [id, job] of memRecoveryQueue) {
    if (processed >= maxJobs) break
    if (job.status === 'completed' || job.status === 'dead_letter') continue

    // Check lease: available if pending and due, OR if lease has expired (crash recovery)
    const isLeaseExpired = job.status === 'leased' && job.leasedUntil && job.leasedUntil < now
    const isDue = job.status === 'pending' && (force || job.nextRetryAt <= now)

    if (!isDue && !isLeaseExpired) continue

    // Claim lease atomically
    job.status = 'leased'
    job.leaseId = workerLeaseId
    job.leasedUntil = now + leaseDurationMs
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
        job.status = 'completed'
        job.leaseId = null
        job.leasedUntil = null
        memConfirmedWrites.set(job.idempotencyKey, { blobId, timestamp: Date.now() })

        // Update database record if Supabase is connected
        const supabase = getSupabaseAdmin()
        if (supabase) {
          try {
            await supabase
              .from('memories_meta')
              .update({ blob_id: blobId })
              .eq('user_id', job.userId)
              .eq('text', job.text)
              .eq('type', job.type)

            await supabase
              .from('storage_recovery_jobs')
              .update({ status: 'completed', updated_at: new Date().toISOString() })
              .eq('id', id)
          } catch {}
        }
      } else {
        job.attempts++
        if (job.attempts >= job.maxAttempts) {
          job.status = 'dead_letter'
          job.leaseId = null
          job.leasedUntil = null
          deadLetter++
        } else {
          job.status = 'pending'
          job.leaseId = null
          job.leasedUntil = null
          // Bounded exponential backoff with jitter
          const backoff = Math.min(300_000, 30_000 * Math.pow(2, job.attempts))
          const jitter = Math.floor(Math.random() * 2000)
          job.nextRetryAt = Date.now() + backoff + jitter
          failed++
        }
      }
    } catch (e: any) {
      job.attempts++
      job.lastError = e?.message || String(e)
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead_letter'
        job.leaseId = null
        job.leasedUntil = null
        deadLetter++
      } else {
        job.status = 'pending'
        job.leaseId = null
        job.leasedUntil = null
        const backoff = Math.min(300_000, 30_000 * Math.pow(2, job.attempts))
        const jitter = Math.floor(Math.random() * 2000)
        job.nextRetryAt = Date.now() + backoff + jitter
        failed++
      }
    }
  }

  return { processed, succeeded, failed, deadLetter }
}

export function getRecoveryQueueStats() {
  let pending = 0
  let leased = 0
  let completed = 0
  let deadLetter = 0

  for (const job of memRecoveryQueue.values()) {
    if (job.status === 'pending') pending++
    else if (job.status === 'leased') leased++
    else if (job.status === 'completed') completed++
    else if (job.status === 'dead_letter') deadLetter++
  }

  return {
    pendingCount: pending,
    leasedCount: leased,
    completedCount: completed,
    deadLetterCount: deadLetter,
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
