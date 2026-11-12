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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([work, new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), ms)))])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// Errors a retry can't fix: the relayer rejected our credentials or the request itself.
const PERMANENT_ERROR = /AUTH_REJECTED|unauthori[sz]ed|forbidden|\b40[139]\b/i

/**
 * Submit one memory to Walrus Memory and wait briefly for its blob id.
 * The idempotency key (plus content dedupe) makes every retry, including the recovery
 * worker's, collapse onto the relayer's original job instead of paying for a second blob.
 */
export async function submitToWalrus(
  mem: MemwalClient,
  encodedText: string,
  idempotencyKey: string,
  budgetMs: number,
): Promise<{ blobId?: string; error?: string; permanent?: boolean }> {
  const options = { idempotencyKey, dedupe: true }
  const started = Date.now()
  try {
    if (typeof mem.waitForRememberJob === 'function') {
      const accepted: any = await withTimeout(Promise.resolve(mem.remember(encodedText, options)), budgetMs)
      if (!accepted) return { error: 'The Walrus relayer did not accept the write in time.' }
      const direct = blobIdOf(accepted)
      if (direct) return { blobId: direct }
      const jobId = accepted.job_id ?? accepted.jobId
      if (!jobId) return { error: 'The Walrus relayer returned no job id.' }
      const left = Math.max(300, budgetMs - (Date.now() - started))
      const done = await withTimeout(Promise.resolve(mem.waitForRememberJob(jobId, { timeoutMs: left })), left + 250)
      const blobId = blobIdOf(done)
      return blobId ? { blobId } : { error: 'The Walrus write is still in progress.' }
    }
    const res = await withTimeout(Promise.resolve(mem.rememberAndWait(encodedText, options, { timeoutMs: budgetMs })), budgetMs)
    const blobId = blobIdOf(res)
    return blobId ? { blobId } : { error: 'The Walrus write is still in progress.' }
  } catch (err: any) {
    const message = err?.message || String(err)
    const status = Number(err?.status ?? err?.statusCode)
    return { error: message, permanent: [401, 403, 409].includes(status) || PERMANENT_ERROR.test(message) }
  }
}

/**
 * Copy a memory to Walrus with a bounded wait. Transient failures are queued for the recovery
 * worker (same idempotency key, so no duplicate blobs); credential or request errors are
 * reported as failed instead of being retried forever.
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
    maxRetries = 1,
    initialBackoffMs = 300,
    timeoutMs = 4000,
  } = opts

  const contentHash = computeContentHash(type, cleanText)
  const idempotencyKey = computeIdempotencyKey(userId, scope, teamId, type, cleanText)
  const provider = getStorageProvider()
  const base = { storageProvider: provider, contentHash, idempotencyKey }
  const confirmed = (blobId: string, attempts: number, isDuplicate = false): WriteResult => ({
    ...base,
    blobId,
    storageState: provider === 'local_mock' ? 'local_mock' : 'confirmed_durable',
    attempts,
    ...(isDuplicate ? { isDuplicate: true } : {}),
  })

  // 1. Already copied: reuse the blob (recent cache first, then the database).
  const cached = memConfirmedWrites.get(idempotencyKey)
  if (cached && Date.now() - cached.timestamp < 300_000) return confirmed(cached.blobId, 0, true)

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
      q = scope === 'team' && teamId ? q.eq('team_id', teamId) : q.is('team_id', null)
      const { data } = await q
      const existing = data?.[0]?.blob_id
      if (existing) {
        memConfirmedWrites.set(idempotencyKey, { blobId: existing, timestamp: Date.now() })
        return confirmed(existing, 0, true)
      }
    } catch {
      /* fall through to a fresh write */
    }
  }

  // 2. Submit. Retries reuse the idempotency key, so they never create a second blob.
  let lastError = ''
  let attempts = 0
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++
    const r = await submitToWalrus(mem, encodedText, idempotencyKey, timeoutMs)
    if (r.blobId) {
      memConfirmedWrites.set(idempotencyKey, { blobId: r.blobId, timestamp: Date.now() })
      return confirmed(r.blobId, attempts)
    }
    lastError = r.error || 'Walrus write failed'
    if (r.permanent) return { ...base, storageState: 'failed', attempts, error: lastError }
    if (attempt < maxRetries) await sleep(initialBackoffMs * 2 ** attempt + Math.floor(Math.random() * 100))
  }

  // 3. Queue it for the recovery worker.
  const recoveryJob: RecoveryJob = {
    id: randomUUID(),
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
    lastError,
    createdAt: new Date().toISOString(),
    nextRetryAt: Date.now() + 60_000,
  }
  memRecoveryQueue.set(recoveryJob.id, recoveryJob)

  const queueFailed = (error: string): WriteResult => ({ ...base, storageState: 'failed', attempts, error })
  if (supabase) {
    try {
      const { error: dbError } = await supabase.from('storage_recovery_jobs').insert({
        id: recoveryJob.id,
        user_id: userId,
        team_id: recoveryJob.teamId,
        scope,
        type,
        text: cleanText,
        content_hash: contentHash,
        idempotency_key: idempotencyKey,
        encoded_text: encodedText,
        attempts,
        max_attempts: recoveryJob.maxAttempts,
        status: 'pending',
        next_retry_at: new Date(recoveryJob.nextRetryAt).toISOString(),
        last_error: lastError,
        created_at: recoveryJob.createdAt,
      })
      if (dbError) return queueFailed(`Could not queue the Walrus copy for a retry: ${dbError.message}`)
    } catch (err: any) {
      return queueFailed(`Could not queue the Walrus copy for a retry: ${err?.message || err}`)
    }
  } else if (provider !== 'local_mock') {
    return queueFailed('Walrus write failed and no database is configured to retry it.')
  }

  return { ...base, storageState: 'recovery_required', attempts, error: lastError }
}

type MemFactory = (scope: 'personal' | 'team', teamCode?: string) => MemwalClient

/** Namespace a queued job writes to: the saver's personal space, or the team's. */
const jobNamespace = (scope: string, userId: string, teamId?: string | null) =>
  scope === 'team' && teamId ? teamId : `usr_${userId}`

type Attempt =
  | { state: 'completed'; blobId: string; attempts: number }
  | { state: 'dead_letter'; attempts: number; error?: string }
  | { state: 'pending'; attempts: number; error?: string; nextRetryAt: number }

/**
 * Recovery worker: retries queued Walrus copies with worker leases, bounded backoff and a
 * dead-letter state. Runs from the operator-only /api/storage endpoint (daily cron).
 */
export async function processRecoveryQueue(
  memFactory: MemFactory,
  opts?: { maxJobs?: number; force?: boolean; budgetMs?: number },
): Promise<{ processed: number; succeeded: number; failed: number; deadLetter: number }> {
  const maxJobs = opts?.maxJobs ?? 10
  const force = opts?.force ?? false
  const deadline = Date.now() + (opts?.budgetMs ?? 20_000)
  const workerLeaseId = `worker_${randomUUID().slice(0, 8)}`
  const leaseDurationMs = 30_000
  const tally = { processed: 0, succeeded: 0, failed: 0, deadLetter: 0 }
  const outOfTime = () => tally.processed >= maxJobs || Date.now() > deadline - 1000

  const attempt = async (job: {
    scope: 'personal' | 'team'
    userId: string
    teamId?: string | null
    encodedText: string
    idempotencyKey: string
    attempts: number
    maxAttempts: number
  }): Promise<Attempt> => {
    const mem = memFactory(job.scope, jobNamespace(job.scope, job.userId, job.teamId))
    const budget = Math.max(1000, Math.min(8000, deadline - Date.now()))
    const r = await submitToWalrus(mem, job.encodedText, job.idempotencyKey, budget)
    const attempts = job.attempts + 1
    if (r.blobId) return { state: 'completed', blobId: r.blobId, attempts }
    if (r.permanent || attempts >= job.maxAttempts) return { state: 'dead_letter', attempts, error: r.error }
    const backoff = Math.min(6 * 3_600_000, 60_000 * 2 ** attempts) + Math.floor(Math.random() * 5000)
    return { state: 'pending', attempts, error: r.error, nextRetryAt: Date.now() + backoff }
  }

  // 1. Jobs stored in Postgres (shared by every serverless instance).
  const supabase = getSupabaseAdmin()
  if (supabase) {
    try {
      const nowIso = new Date().toISOString()
      const available = `status.eq.pending,and(status.eq.leased,leased_until.lt.${nowIso})`
      let query = supabase
        .from('storage_recovery_jobs')
        .select('*')
        .or(available)
        .order('created_at', { ascending: true })
        .limit(maxJobs)
      if (!force) query = query.lte('next_retry_at', nowIso)

      const { data: dbJobs, error: selectErr } = await query
      if (!selectErr && dbJobs && dbJobs.length > 0) {
        for (const raw of dbJobs) {
          if (outOfTime()) break
          // Conditional update = atomic lease: only one worker can claim a job.
          const { data: claimedRows, error: claimErr } = await supabase
            .from('storage_recovery_jobs')
            .update({
              status: 'leased',
              lease_id: workerLeaseId,
              leased_until: new Date(Date.now() + leaseDurationMs).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', raw.id)
            .or(available)
            .select()
          const job = claimedRows?.[0]
          if (claimErr || !job) continue

          tally.processed++
          const out = await attempt({
            scope: job.scope,
            userId: job.user_id,
            teamId: job.team_id,
            encodedText: job.encoded_text,
            idempotencyKey: job.idempotency_key,
            attempts: job.attempts || 0,
            maxAttempts: job.max_attempts || 5,
          })
          const released = { lease_id: null, leased_until: null, attempts: out.attempts, updated_at: new Date().toISOString() }
          if (out.state === 'completed') {
            tally.succeeded++
            memConfirmedWrites.set(job.idempotency_key, { blobId: out.blobId, timestamp: Date.now() })
            let rows = supabase
              .from('memories_meta')
              .update({ blob_id: out.blobId })
              .eq('user_id', job.user_id)
              .eq('text', job.text)
              .eq('type', job.type)
              .is('blob_id', null)
            rows = job.team_id ? rows.eq('team_id', job.team_id) : rows.is('team_id', null)
            await rows
            await supabase.from('storage_recovery_jobs').update({ ...released, status: 'completed' }).eq('id', job.id)
          } else if (out.state === 'dead_letter') {
            tally.deadLetter++
            await supabase
              .from('storage_recovery_jobs')
              .update({ ...released, status: 'dead_letter', last_error: out.error ?? null })
              .eq('id', job.id)
          } else {
            tally.failed++
            await supabase
              .from('storage_recovery_jobs')
              .update({
                ...released,
                status: 'pending',
                last_error: out.error ?? null,
                next_retry_at: new Date(out.nextRetryAt).toISOString(),
              })
              .eq('id', job.id)
          }
        }
        if (tally.processed > 0) return tally
      }
    } catch (dbErr) {
      console.error('[storage:processRecoveryQueue] database worker error:', dbErr)
    }
  }

  // 2. In-memory queue (local development and tests).
  for (const job of memRecoveryQueue.values()) {
    if (outOfTime()) break
    if (job.status === 'completed' || job.status === 'dead_letter') continue
    const now = Date.now()
    const leaseExpired = job.status === 'leased' && (job.leasedUntil ?? 0) < now
    const due = job.status === 'pending' && (force || job.nextRetryAt <= now)
    if (!due && !leaseExpired) continue

    job.status = 'leased'
    job.leaseId = workerLeaseId
    job.leasedUntil = now + leaseDurationMs
    tally.processed++

    const out = await attempt(job)
    job.attempts = out.attempts
    job.leaseId = null
    job.leasedUntil = null
    if (out.state === 'completed') {
      tally.succeeded++
      job.status = 'completed'
      memConfirmedWrites.set(job.idempotencyKey, { blobId: out.blobId, timestamp: Date.now() })
    } else if (out.state === 'dead_letter') {
      tally.deadLetter++
      job.status = 'dead_letter'
      job.lastError = out.error ?? null
    } else {
      tally.failed++
      job.status = 'pending'
      job.lastError = out.error ?? null
      job.nextRetryAt = out.nextRetryAt
    }
  }

  return tally
}

/** Operator view of storage health, read from the database (counts only, no content). */
export async function getStorageStats() {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { database: false, queue: getRecoveryQueueStats() }
  const count = async (q: any): Promise<number | null> => {
    const { count: n, error } = await q
    return error ? null : (n ?? 0)
  }
  const head = { count: 'exact' as const, head: true }
  const [memories, onWalrus, pending, deadLetter] = await Promise.all([
    count(supabase.from('memories_meta').select('id', head)),
    count(supabase.from('memories_meta').select('id', head).not('blob_id', 'is', null)),
    count(supabase.from('storage_recovery_jobs').select('id', head).in('status', ['pending', 'leased'])),
    count(supabase.from('storage_recovery_jobs').select('id', head).eq('status', 'dead_letter')),
  ])
  const { data: last } = await supabase
    .from('storage_recovery_jobs')
    .select('last_error, updated_at')
    .not('last_error', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
  return {
    database: true,
    provider: getStorageProvider(),
    memories,
    onWalrus,
    recoveryPending: pending,
    recoveryDeadLetter: deadLetter,
    lastError: last?.[0]?.last_error ?? null,
    lastErrorAt: last?.[0]?.updated_at ?? null,
  }
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
      ? 'Engram no longer uses the Walrus copy; it expires naturally at the end of its storage period.'
      : 'No Walrus copy existed; the memory is completely removed.',
    blobId: blobId ?? null,
  }
}

export function _resetStorageTestState() {
  memRecoveryQueue.clear()
  memConfirmedWrites.clear()
}
