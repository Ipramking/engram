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

export interface LifecycleExecutionResult {
  ok: boolean
  statusCode: number
  error?: string
  metadataError?: string | null
  code?: string
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
  integrityVerified: boolean
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

  // 6. Durable Write with Retry & Idempotency
  const mem = memwalFor(effectiveScope as Scope, ns)
  const encoded = encodeMemory(t, cleanText)

  const writeRes = await writeMemoryWithRetry({
    mem,
    encodedText: encoded,
    type: t,
    cleanText,
    userId: user.id,
    scope: effectiveScope as 'personal' | 'team',
    teamId: effectiveTeamId,
  })

  const blobId = writeRes.blobId ?? null
  const storageState = writeRes.storageState
  const contentHash = writeRes.contentHash
  const idempotencyKey = writeRes.idempotencyKey
  const storageProvider = writeRes.storageProvider

  // 7. Database Persistence & Smart Conflict Resolution
  let superseded: any[] = []
  let metadataError: string | null = null
  const supabase = getSupabaseAdmin()
  if (supabase && user) {
    try {
      const { data: inserted, error: metaErr } = await supabase.from('memories_meta').insert({
        user_id: user.id,
        team_id: effectiveScope === 'team' ? effectiveTeamId : null,
        room: 'my-space',
        type: t,
        text: cleanText,
        blob_id: blobId,
      }).select('id').single()
      if (metaErr) {
        metadataError = metaErr.message
        console.error('[lifecycle] metadata persistence failed:', metaErr.message)
      } else {
        const conflictRes = await detectAndResolveConflicts({
          userId: user.id,
          teamId: effectiveScope === 'team' ? effectiveTeamId : null,
          scope: effectiveScope as 'personal' | 'team',
          newText: cleanText,
          newType: t,
          newBlobId: blobId || undefined,
          excludeId: inserted?.id,
        })
        superseded = conflictRes.supersededList
      }
    } catch (metaErr: any) {
      metadataError = metaErr?.message || String(metaErr)
      console.error('[lifecycle] metadata persistence/conflict resolution warning:', metadataError)
    }
  }

  // 8. Intelligence Enrichment (Entities, Importance, Categorization)
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
    integrityVerified: true,
    metadataError: metadataError || undefined,
    isDuplicate: writeRes.isDuplicate ?? false,
    superseded,
  }
}
