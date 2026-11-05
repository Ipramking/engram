// Engram 2.1 Durable Continuity & Cross-Agent Handoff Engine
import { createHash, randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'
import { isTeamMember } from './db.js'

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'

export interface ProjectTask {
  id: string
  title: string
  status: TaskStatus
  assignedTo?: string | null
  blockerReason?: string | null
  updatedAt: string
}

export interface ProjectContext {
  id: string
  slug: string
  name: string
  userId: string
  teamId?: string | null
  scope: 'personal' | 'team'
  architecture: {
    framework: string
    database: string
    storage: string
    hosting: string
    keyDecisions: string[]
  }
  activeTasks: ProjectTask[]
  blockers: string[]
  preferences: string[]
  keyTerms: Record<string, string>
  updatedAt: string
}

export interface AgentHandoff {
  id: string
  projectId: string
  userId: string
  teamId?: string | null
  fromAgent: string
  toAgent: string
  taskState: string
  handoffNotes: string
  supportingReferences: string[]
  unresolvedQuestions: string[]
  nextActions: string[]
  createdAt: string
}

export interface ContinuitySnapshot {
  schemaVersion: '2.0'
  snapshotId: string
  projectId: string
  projectName: string
  createdAt: string
  checksum: string
  context: ProjectContext
  latestHandoff?: AgentHandoff | null
  activeMemoriesCount: number
  activeMemoriesSample: Array<{ type: string; text: string; blobId?: string | null }>
}

// In-memory cache for fast lookups & offline/mock fallback
const memContexts = new Map<string, ProjectContext>()
const memHandoffs = new Map<string, AgentHandoff[]>()
const memSnapshots = new Map<string, ContinuitySnapshot>()

/**
 * Deterministic canonical JSON serialization.
 * Recursively sorts object keys so hashing is invariant to key order across platforms.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']'
  }
  const keys = Object.keys(obj).sort()
  const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalJsonStringify(obj[k]))
  return '{' + parts.join(',') + '}'
}

/**
 * Full snapshot integrity checksum calculation.
 * Covers ALL integrity-relevant fields: version, IDs, context, handoff, and sample memories.
 */
export function computeSnapshotChecksum(payload: Omit<ContinuitySnapshot, 'checksum'>): string {
  const normalized = {
    schemaVersion: payload.schemaVersion,
    snapshotId: payload.snapshotId,
    projectId: payload.projectId,
    projectName: payload.projectName,
    createdAt: payload.createdAt,
    context: payload.context,
    latestHandoff: payload.latestHandoff ?? null,
    activeMemoriesCount: payload.activeMemoriesCount ?? 0,
    activeMemoriesSample: payload.activeMemoriesSample ?? [],
  }
  return createHash('sha256').update(canonicalJsonStringify(normalized)).digest('hex')
}

/**
 * Validates whether an actor (userId) has permission to read or modify a project context.
 */
export async function authorizeProjectAccess(opts: {
  userId: string
  context: ProjectContext
}): Promise<{ authorized: boolean; reason?: string }> {
  const { userId, context } = opts
  if (context.scope === 'team' && context.teamId) {
    const isMember = await isTeamMember(userId, context.teamId)
    if (!isMember) {
      return { authorized: false, reason: 'Forbidden: caller is not a member of the project team' }
    }
    return { authorized: true }
  }

  // Personal scope: strictly owner only
  if (context.userId !== userId) {
    return { authorized: false, reason: 'Forbidden: caller does not own this personal project' }
  }
  return { authorized: true }
}

/**
 * Retrieves an existing project context from durable Supabase storage (or in-memory fallback),
 * or creates a new one bound to the authenticated actor.
 */
export async function getOrCreateProjectContext(opts: {
  projectId?: string
  projectName?: string
  userId: string
  scope?: 'personal' | 'team'
  teamId?: string | null
}): Promise<ProjectContext> {
  const { projectId, projectName = 'Engram Project', userId, scope = 'personal', teamId = null } = opts
  const id = projectId || `proj_${userId.slice(0, 8)}`

  // 1. Check authoritative Supabase Postgres store
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data, error } = await supabase
      .from('continuity_contexts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      // Distinguish genuine NOT FOUND (PGRST116) from database failures
      if (error.code !== 'PGRST116') {
        throw new Error(`Database error retrieving project context "${id}": ${error.message}`)
      }
      // If code is PGRST116, row genuinely does not exist in database yet
    } else if (data) {
      const loaded: ProjectContext = {
        id: data.id,
        slug: data.slug,
        name: data.name,
        userId: data.user_id,
        teamId: data.team_id,
        scope: data.scope,
        architecture: data.architecture || {},
        activeTasks: data.active_tasks || [],
        blockers: data.blockers || [],
        preferences: data.preferences || [],
        keyTerms: data.key_terms || {},
        updatedAt: data.updated_at || data.created_at,
      }
      memContexts.set(id, loaded)
      return loaded
    }
  }

  // 2. Check local memory cache (offline / test mock mode)
  const cached = memContexts.get(id)
  if (cached) return cached

  // 3. Create default new context bound to authenticated caller
  const defaultContext: ProjectContext = {
    id,
    slug: id.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
    name: projectName,
    userId,
    teamId,
    scope,
    architecture: {
      framework: 'TypeScript + Express / Vite',
      database: 'Supabase Postgres',
      storage: 'Walrus Decentralized Memory (Sui)',
      hosting: 'Vercel + Render',
      keyDecisions: [
        'Portable cross-agent memory via Model Context Protocol (MCP)',
        'Fail-closed security guarantees for secrets and tokens',
      ],
    },
    activeTasks: [],
    blockers: [],
    preferences: ['Keep UI strictly consistent with Aubergine and Rose-Gold palette'],
    keyTerms: {
      MemWal: 'Decentralized Walrus memory client and relayer SDK',
      MCP: 'Model Context Protocol for cross-agent tool communication',
    },
    updatedAt: new Date().toISOString(),
  }

  memContexts.set(id, defaultContext)

  // Persist to Supabase if connected
  if (supabase) {
    const { error: insertErr } = await supabase.from('continuity_contexts').insert({
      id: defaultContext.id,
      slug: defaultContext.slug,
      name: defaultContext.name,
      user_id: defaultContext.userId,
      team_id: defaultContext.teamId,
      scope: defaultContext.scope,
      architecture: defaultContext.architecture,
      active_tasks: defaultContext.activeTasks,
      blockers: defaultContext.blockers,
      preferences: defaultContext.preferences,
      key_terms: defaultContext.keyTerms,
      updated_at: defaultContext.updatedAt,
    })
    if (insertErr) {
      throw new Error(`Failed to durably persist new project context "${id}": ${insertErr.message}`)
    }
  }

  return defaultContext
}

/**
 * Records an agent handoff with verified ownership and persists durably.
 */
export async function recordAgentHandoff(opts: {
  projectId: string
  userId: string
  teamId?: string | null
  fromAgent: string
  toAgent: string
  taskState: string
  handoffNotes: string
  supportingReferences?: string[]
  unresolvedQuestions?: string[]
  nextActions?: string[]
}): Promise<AgentHandoff> {
  const {
    projectId,
    userId,
    teamId = null,
    fromAgent,
    toAgent,
    taskState,
    handoffNotes,
    supportingReferences = [],
    unresolvedQuestions = [],
    nextActions = [],
  } = opts

  const handoff: AgentHandoff = {
    id: `handoff_${randomUUID()}`,
    projectId,
    userId,
    teamId,
    // Caps keep one handoff from storing a whole transcript.
    fromAgent: fromAgent.trim().slice(0, 100),
    toAgent: toAgent.trim().slice(0, 100),
    taskState: taskState.trim().slice(0, 2000),
    handoffNotes: handoffNotes.trim().slice(0, 8000),
    supportingReferences,
    unresolvedQuestions,
    nextActions,
    createdAt: new Date().toISOString(),
  }

  // Update in-memory cache
  const list = memHandoffs.get(projectId) || []
  list.unshift(handoff)
  memHandoffs.set(projectId, list)

  // Persist to Supabase Postgres
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { error: handoffErr } = await supabase.from('continuity_handoffs').insert({
      id: handoff.id,
      project_id: handoff.projectId,
      user_id: handoff.userId,
      team_id: handoff.teamId,
      from_agent: handoff.fromAgent,
      to_agent: handoff.toAgent,
      task_state: handoff.taskState,
      handoff_notes: handoff.handoffNotes,
      supporting_references: handoff.supportingReferences,
      unresolved_questions: handoff.unresolvedQuestions,
      next_actions: handoff.nextActions,
      created_at: handoff.createdAt,
    })
    if (handoffErr) {
      throw new Error(`Failed to durably persist agent handoff: ${handoffErr.message}`)
    }
  }

  return handoff
}

/**
 * Retrieves the latest handoff for a project.
 */
export async function getLatestHandoff(projectId: string): Promise<AgentHandoff | null> {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('continuity_handoffs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0) {
        const row = data[0]
        return {
          id: row.id,
          projectId: row.project_id,
          userId: row.user_id,
          teamId: row.team_id,
          fromAgent: row.from_agent,
          toAgent: row.to_agent,
          taskState: row.task_state,
          handoffNotes: row.handoff_notes,
          supportingReferences: row.supporting_references || [],
          unresolvedQuestions: row.unresolved_questions || [],
          nextActions: row.next_actions || [],
          createdAt: row.created_at,
        }
      }
    } catch {}
  }

  const list = memHandoffs.get(projectId)
  return list && list.length > 0 ? list[0] : null
}

/**
 * Lists all handoffs for a project.
 */
export async function listProjectHandoffs(projectId: string): Promise<AgentHandoff[]> {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('continuity_handoffs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          projectId: row.project_id,
          userId: row.user_id,
          teamId: row.team_id,
          fromAgent: row.from_agent,
          toAgent: row.to_agent,
          taskState: row.task_state,
          handoffNotes: row.handoff_notes,
          supportingReferences: row.supporting_references || [],
          unresolvedQuestions: row.unresolved_questions || [],
          nextActions: row.next_actions || [],
          createdAt: row.created_at,
        }))
      }
    } catch {}
  }

  return memHandoffs.get(projectId) || []
}

/**
 * Updates a project context with verified actor authorization.
 * Removes synthetic 'system' ownership shortcut.
 */
export async function updateProjectContext(opts: {
  projectId: string
  userId: string
  name?: string
  architecture?: Partial<ProjectContext['architecture']>
  activeTasks?: ProjectTask[]
  blockers?: string[]
  preferences?: string[]
  keyTerms?: Record<string, string>
}): Promise<ProjectContext> {
  const ctx = await getOrCreateProjectContext({ projectId: opts.projectId, userId: opts.userId })
  const authCheck = await authorizeProjectAccess({ userId: opts.userId, context: ctx })
  if (!authCheck.authorized) {
    throw new Error(authCheck.reason || 'Forbidden: unauthorized project update')
  }

  if (opts.name) ctx.name = opts.name
  if (opts.architecture) {
    ctx.architecture = { ...ctx.architecture, ...opts.architecture }
  }
  if (opts.activeTasks) ctx.activeTasks = opts.activeTasks
  if (opts.blockers) ctx.blockers = opts.blockers
  if (opts.preferences) ctx.preferences = opts.preferences
  if (opts.keyTerms) ctx.keyTerms = { ...ctx.keyTerms, ...opts.keyTerms }
  ctx.updatedAt = new Date().toISOString()

  memContexts.set(opts.projectId, ctx)

  const supabase = getSupabaseAdmin()
  if (supabase) {
    let updateQuery = supabase
      .from('continuity_contexts')
      .update({
        name: ctx.name,
        architecture: ctx.architecture,
        active_tasks: ctx.activeTasks,
        blockers: ctx.blockers,
        preferences: ctx.preferences,
        key_terms: ctx.keyTerms,
        updated_at: ctx.updatedAt,
      })
      .eq('id', ctx.id)

    // Enforce ownership directly in persistent update query
    if (ctx.scope === 'team' && ctx.teamId) {
      updateQuery = updateQuery.eq('team_id', ctx.teamId)
    } else {
      updateQuery = updateQuery.eq('user_id', ctx.userId)
    }

    const { error: updateErr } = await updateQuery
    if (updateErr) {
      throw new Error(`Failed to durably update project context: ${updateErr.message}`)
    }
  }

  return ctx
}

/**
 * Generates an exportable verifiable continuity snapshot with complete checksum coverage.
 */
export async function generateContinuitySnapshot(opts: {
  projectId: string
  projectName?: string
  userId: string
  scope?: 'personal' | 'team'
  teamId?: string | null
  activeMemories?: Array<{ type: string; text: string; blobId?: string | null }>
}): Promise<ContinuitySnapshot> {
  const { projectId, projectName, userId, scope, teamId, activeMemories = [] } = opts
  const context = await getOrCreateProjectContext({ projectId, projectName, userId, scope, teamId })
  const access = await authorizeProjectAccess({ userId, context })
  if (!access.authorized) throw new Error(access.reason || 'Forbidden: no access to this project')
  const latestHandoff = await getLatestHandoff(projectId)

  const now = new Date().toISOString()
  const rawPayload: Omit<ContinuitySnapshot, 'checksum'> = {
    schemaVersion: '2.0',
    snapshotId: `snap_${randomUUID()}`,
    projectId,
    projectName: context.name,
    createdAt: now,
    context,
    latestHandoff: latestHandoff || null,
    activeMemoriesCount: activeMemories.length,
    activeMemoriesSample: activeMemories.slice(0, 10),
  }

  const checksum = computeSnapshotChecksum(rawPayload)
  const fullSnapshot: ContinuitySnapshot = {
    ...rawPayload,
    checksum,
  }

  memSnapshots.set(fullSnapshot.snapshotId, fullSnapshot)
  memSnapshots.set(projectId, fullSnapshot)

  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { error: snapErr } = await supabase.from('continuity_snapshots').insert({
      id: fullSnapshot.snapshotId,
      project_id: fullSnapshot.projectId,
      user_id: userId,
      team_id: teamId,
      project_name: fullSnapshot.projectName,
      schema_version: fullSnapshot.schemaVersion,
      checksum: fullSnapshot.checksum,
      context_payload: fullSnapshot.context,
      latest_handoff_payload: fullSnapshot.latestHandoff,
      active_memories_count: fullSnapshot.activeMemoriesCount,
      active_memories_sample: fullSnapshot.activeMemoriesSample,
      created_at: fullSnapshot.createdAt,
    })
    if (snapErr) {
      throw new Error(`Failed to durably persist continuity snapshot: ${snapErr.message}`)
    }
  }

  return fullSnapshot
}

/**
 * Restores and verifies a continuity snapshot.
 * Enforces canonical checksum verification across ALL fields and destination project authorization.
 */
export async function restoreContinuitySnapshot(opts: {
  snapshotJson: string | ContinuitySnapshot
  userId: string
  targetProjectId?: string
}): Promise<{
  verified: boolean
  snapshot: ContinuitySnapshot | null
  error?: string
}> {
  try {
    const { snapshotJson, userId, targetProjectId } = opts
    const parsed: ContinuitySnapshot =
      typeof snapshotJson === 'string' ? JSON.parse(snapshotJson) : snapshotJson

    if (!parsed || parsed.schemaVersion !== '2.0' || !parsed.checksum || !parsed.projectId) {
      return { verified: false, snapshot: null, error: 'Invalid snapshot format or missing supported schemaVersion 2.0' }
    }

    // Verify full checksum across all integrity-relevant fields
    const { checksum, ...rest } = parsed
    const expectedChecksum = computeSnapshotChecksum(rest)
    if (checksum !== expectedChecksum) {
      return { verified: false, snapshot: null, error: 'Snapshot integrity checksum mismatch: data has been altered.' }
    }

    const destinationProjectId = targetProjectId || parsed.projectId

    // Authorization check: Verify user is authorized to restore into destination project
    const existingCtx = await getOrCreateProjectContext({ projectId: destinationProjectId, userId })
    const authCheck = await authorizeProjectAccess({ userId, context: existingCtx })
    if (!authCheck.authorized) {
      return { verified: false, snapshot: null, error: `Forbidden: not authorized to restore into project "${destinationProjectId}"` }
    }

    // Idempotent restoration
    const restoredContext: ProjectContext = {
      ...parsed.context,
      id: destinationProjectId,
      userId: existingCtx.userId, // preserve existing ownership boundary
      teamId: existingCtx.teamId,
      scope: existingCtx.scope,
      updatedAt: new Date().toISOString(),
    }

    memContexts.set(destinationProjectId, restoredContext)

    if (parsed.latestHandoff) {
      const restoredHandoff: AgentHandoff = {
        ...parsed.latestHandoff,
        projectId: destinationProjectId,
        userId,
      }
      const list = memHandoffs.get(destinationProjectId) || []
      list.unshift(restoredHandoff)
      memHandoffs.set(destinationProjectId, list)
    }

    memSnapshots.set(parsed.snapshotId, parsed)

    // Persist to Supabase if connected
    const supabase = getSupabaseAdmin()
    if (supabase) {
      let updateQuery = supabase
        .from('continuity_contexts')
        .update({
          name: restoredContext.name,
          architecture: restoredContext.architecture,
          active_tasks: restoredContext.activeTasks,
          blockers: restoredContext.blockers,
          preferences: restoredContext.preferences,
          key_terms: restoredContext.keyTerms,
          updated_at: restoredContext.updatedAt,
        })
        .eq('id', destinationProjectId)

      if (existingCtx.scope === 'team' && existingCtx.teamId) {
        updateQuery = updateQuery.eq('team_id', existingCtx.teamId)
      } else {
        updateQuery = updateQuery.eq('user_id', existingCtx.userId)
      }

      const { error: restoreErr } = await updateQuery
      if (restoreErr) {
        return {
          verified: false,
          snapshot: null,
          error: `Database persistence failed during snapshot restore: ${restoreErr.message}`,
        }
      }
    }

    return { verified: true, snapshot: parsed }
  } catch (err: any) {
    return { verified: false, snapshot: null, error: `Failed to restore snapshot: ${err.message}` }
  }
}

/**
 * Formats a quick-resume markdown brief suitable for injecting directly into
 * any agent context (Claude, Cursor, Copilot, Antigravity) with 0 cold start loss.
 */
export function formatQuickResumeBrief(snapshot: ContinuitySnapshot): string {
  const ctx = snapshot.context
  const handoff = snapshot.latestHandoff

  const lines = [
    `# Project Context & Quick-Resume Brief: ${snapshot.projectName}`,
    `*Snapshot ID: ${snapshot.snapshotId} | Verified Checksum: ${snapshot.checksum.slice(0, 12)}... | Updated: ${snapshot.createdAt}*`,
    '',
    '## 1. System Architecture & Decisions',
    `- Framework: ${ctx.architecture.framework}`,
    `- Database: ${ctx.architecture.database}`,
    `- Storage: ${ctx.architecture.storage}`,
    `- Hosting: ${ctx.architecture.hosting}`,
    ...ctx.architecture.keyDecisions.map((d) => `- Decision: ${d}`),
    '',
    '## 2. Working Preferences',
    ...ctx.preferences.map((p) => `- ${p}`),
    '',
  ]

  if (handoff) {
    lines.push(
      '## 3. Latest Agent Handoff',
      `- From: **${handoff.fromAgent}** → To: **${handoff.toAgent}**`,
      `- Task State: *${handoff.taskState}*`,
      `- Notes: ${handoff.handoffNotes}`,
      ''
    )
    if (handoff.nextActions.length > 0) {
      lines.push('### Immediate Next Actions')
      for (const a of handoff.nextActions) lines.push(`- [ ] ${a}`)
      lines.push('')
    }
    if (handoff.unresolvedQuestions.length > 0) {
      lines.push('### Open / Unresolved Questions')
      for (const q of handoff.unresolvedQuestions) lines.push(`- ❓ ${q}`)
      lines.push('')
    }
  }

  if (snapshot.activeMemoriesSample.length > 0) {
    lines.push('## 4. Key Ground-Truth Facts')
    for (const m of snapshot.activeMemoriesSample) {
      lines.push(`- [${m.type}] ${m.text}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function _resetContinuityTestState() {
  memContexts.clear()
  memHandoffs.clear()
  memSnapshots.clear()
}
