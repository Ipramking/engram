// Engram 2.1 Unified Shared Memory Lifecycle Service
// Ensures 100% parity across REST (/api/remember), MCP (engram_remember), and SDK interfaces.
import {
  memwalFor,
  encodeMemory,
  decodeMemory,
  MEMORY_TYPES,
  type Scope,
  type MemoryType,
} from './memwal.js'
import { authorizeMemoryAccess } from './auth.js'
import { checkAndIncrementUsage } from './db.js'
import { getSupabaseAdmin } from './supabase.js'
import { detectAndResolveConflicts } from './conflicts.js'
import { scanForSecrets, sanitizeMemoryText } from './security.js'
import { writeMemoryWithRetry, type StorageState, type StorageProvider } from './storage.js'
import {
  executeLifecyclePipeline,
  mapSubtypeToCategory,
  type MemoryCategory,
  type MemorySensitivity,
  type MemorySource,
} from './intelligence.js'

export interface CreateMemoryParams {
  user: any
  text: string
  type?: string
  scope?: 'personal' | 'team' | string
  teamCode?: string
  source?: MemorySource
  confidence?: number
  importance?: number
}

export const MAX_MEMORY_CHARS = 4000
// How long a save waits for the Walrus copy before leaving it to the recovery worker.
const WALRUS_WAIT_MS = 3500

export interface LifecycleExecutionResult {
  ok: boolean
  statusCode: number
  error?: string
  code?: string
  /** Database id of the saved memory (null only when running without a database). */
  id?: string | null
  type: string
  cleanText: string
  category: MemoryCategory
  subtype: string
  entities: string[]
  confidence: number
  importance: number
  sensitivity: MemorySensitivity
  blobId: string | null
  storageState: StorageState
  persistenceState: StorageState
  contentHash: string
  idempotencyKey: string
  storageProvider: StorageProvider
  isDuplicate: boolean
  superseded: any[]
}

/**
 * Shared, unified memory creation lifecycle executed identically across REST, MCP, and SDK.
 */
export async function executeMemoryCreationLifecycle(
  params: CreateMemoryParams
): Promise<LifecycleExecutionResult> {
  const {
    user,
    text,
    type,
    scope = 'personal',
    teamCode = 'default',
    source = 'explicit_user',
    confidence,
    importance,
  } = params

  // 1. Text & Schema Validation
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      ok: false,
      statusCode: 400,
      error: 'text required',
      code: 'INVALID_INPUT',
    } as LifecycleExecutionResult
  }
  // Memories are single facts; a cap keeps recall fast and stops one call from storing a whole document.
  if (text.length > MAX_MEMORY_CHARS) {
    return {
      ok: false,
      statusCode: 413,
      error: `Memory too long (${text.length} characters, max ${MAX_MEMORY_CHARS}). Save one fact at a time.`,
      code: 'TOO_LONG',
    } as LifecycleExecutionResult
  }

  // 2. Secret Scanning (Zero-leakage boundary)
  const secretCheck = scanForSecrets(text)
  if (secretCheck.hasSecret) {
    return {
      ok: false,
      statusCode: 400,
      error: secretCheck.reason || 'Secret detected in memory content',
      code: 'SECRET_DETECTED',
    } as LifecycleExecutionResult
  }

  // 3. Centralized Authorization Enforcement
  if (!user || !user.id) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Unauthorized: authentication required to access memory.',
      code: 'UNAUTHORIZED',
    } as LifecycleExecutionResult
  }

  const authRes = await authorizeMemoryAccess({
    user,
    requestedScope: scope,
    requestedTeamCode: teamCode,
  })

  if (!authRes.authorized) {
    return {
      ok: false,
      statusCode: authRes.statusCode || 403,
      error: authRes.error || 'Forbidden: unauthorized memory scope access.',
      code: 'FORBIDDEN',
    } as LifecycleExecutionResult
  }

  const effectiveScope = authRes.effectiveScope
  const effectiveTeamId = authRes.effectiveTeamId
  const ns = effectiveScope === 'team' ? effectiveTeamId! : `usr_${user.id}`

  // 4. Normalization & Category Mapping
  const decoded = decodeMemory(sanitizeMemoryText(text))
  const cleanText = decoded.text
  const t = type && (MEMORY_TYPES as readonly string[]).includes(type)
    ? (type as MemoryType)
    : (decoded.type !== 'note' ? (decoded.type as MemoryType) : 'decision')

  // 5. Daily Usage & Quotas
  try {
    await checkAndIncrementUsage({
      entityType: effectiveScope === 'team' ? 'team' : 'user',
      entityId: effectiveScope === 'team' ? effectiveTeamId! : user.id,
      operation: 'save',
      // Team saves draw on the team's pool, not the saver's personal plan.
      planTier: effectiveScope === 'team' ? 'free_team' : user.plan_tier,
    })
  } catch (quotaErr: any) {
    return {
      ok: false,
      statusCode: 429,
      error: quotaErr.message || 'Daily quota exceeded.',
      code: 'DAILY_QUOTA_EXCEEDED',
    } as LifecycleExecutionResult
  }

  const teamId = effectiveScope === 'team' ? effectiveTeamId : null
  const supabase = getSupabaseAdmin()

  // 6. Save to the database first: it is what recall searches, so a save only succeeds if it lands there.
  let memoryId: string | null = null
  if (supabase) {
    try {
      const { data: inserted, error: metaErr } = await supabase
        .from('memories_meta')
        .insert({ user_id: user.id, team_id: teamId, room: 'my-space', type: t, text: cleanText })
        .select('id')
        .single()
      if (metaErr || !inserted) throw new Error(metaErr?.message || 'no row returned')
      memoryId = inserted.id
    } catch (err: any) {
      console.error('[lifecycle] saving the memory failed:', err?.message || err)
      return {
        ok: false,
        statusCode: 503,
        error: "Couldn't save the memory right now. Please try again in a moment.",
        code: 'STORAGE_UNAVAILABLE',
      } as LifecycleExecutionResult
    }
  }

  // 7. Copy to Walrus with a short wait. Slow or failed copies are retried later by the recovery
  // worker under the same idempotency key, so a retry never creates a second blob.
  const writeRes = await writeMemoryWithRetry({
    mem: memwalFor(effectiveScope as Scope, ns),
    encodedText: encodeMemory(t, cleanText),
    type: t,
    cleanText,
    userId: user.id,
    scope: effectiveScope as 'personal' | 'team',
    teamId: effectiveTeamId,
    maxRetries: 0,
    timeoutMs: WALRUS_WAIT_MS,
  })
  if (writeRes.error) console.warn('[lifecycle] Walrus copy:', writeRes.storageState, writeRes.error)

  const blobId = writeRes.blobId ?? null
  const storageState = writeRes.storageState
  const contentHash = writeRes.contentHash
  const idempotencyKey = writeRes.idempotencyKey
  const storageProvider = writeRes.storageProvider
  if (supabase && memoryId && blobId) {
    const { error } = await supabase.from('memories_meta').update({ blob_id: blobId }).eq('id', memoryId)
    if (error) console.warn('[lifecycle] could not record the blob id:', error.message)
  }

  // 8. A new memory can replace older ones it contradicts.
  let superseded: any[] = []
  if (supabase && memoryId) {
    try {
      const conflictRes = await detectAndResolveConflicts({
        userId: user.id,
        teamId,
        scope: effectiveScope as 'personal' | 'team',
        newText: cleanText,
        newType: t,
        newBlobId: blobId || undefined,
        newMemoryId: memoryId,
        excludeId: memoryId,
      })
      superseded = conflictRes.supersededList
    } catch (err: any) {
      console.error('[lifecycle] conflict check failed:', err?.message || err)
    }
  }

  // 9. Intelligence Enrichment (Entities, Importance, Categorization)
  const pipelineResult = executeLifecyclePipeline({
    userId: user.id,
    scope: effectiveScope as 'personal' | 'team',
    teamId: effectiveTeamId,
    text: cleanText,
    type: t,
    source,
    confidence,
    importance,
    blobId,
  })
  const structured = pipelineResult.memory

  return {
    ok: true,
    statusCode: 200,
    id: memoryId,
    type: t,
    cleanText,
    category: structured.category,
    subtype: structured.subtype,
    entities: structured.entities,
    confidence: structured.confidence,
    importance: structured.importance,
    sensitivity: structured.sensitivity,
    blobId,
    storageState,
    persistenceState: storageState,
    contentHash,
    idempotencyKey,
    storageProvider,
    isDuplicate: writeRes.isDuplicate ?? false,
    superseded,
  }
}
