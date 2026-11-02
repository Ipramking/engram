// Engram 2.0 Continuity & Cross-Agent Handoff Engine
import { createHash, randomUUID } from 'node:crypto'

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

// In-memory store for continuity contexts and handoffs
const memContexts = new Map<string, ProjectContext>()
const memHandoffs = new Map<string, AgentHandoff[]>()
const memSnapshots = new Map<string, ContinuitySnapshot>()

export function computeSnapshotChecksum(payload: Omit<ContinuitySnapshot, 'checksum'>): string {
  const serialized = JSON.stringify({
    schemaVersion: payload.schemaVersion,
    projectId: payload.projectId,
    projectName: payload.projectName,
    createdAt: payload.createdAt,
    context: payload.context,
    latestHandoff: payload.latestHandoff,
  })
  return createHash('sha256').update(serialized).digest('hex')
}

export function getOrCreateProjectContext(opts: {
  projectId?: string
  projectName?: string
  userId: string
  scope?: 'personal' | 'team'
  teamId?: string | null
}): ProjectContext {
  const { projectId, projectName = 'Engram Project', userId, scope = 'personal', teamId = null } = opts
  const id = projectId || `proj_${userId.slice(0, 8)}`
  const existing = memContexts.get(id)
  if (existing) return existing

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
  return defaultContext
}

export function recordAgentHandoff(opts: {
  projectId: string
  fromAgent: string
  toAgent: string
  taskState: string
  handoffNotes: string
  supportingReferences?: string[]
  unresolvedQuestions?: string[]
  nextActions?: string[]
}): AgentHandoff {
  const {
    projectId,
    fromAgent,
    toAgent,
    taskState,
    handoffNotes,
    supportingReferences = [],
    unresolvedQuestions = [],
    nextActions = [],
  } = opts

  const handoff: AgentHandoff = {
    id: `handoff_${randomUUID().slice(0, 8)}`,
    projectId,
    fromAgent: fromAgent.trim(),
    toAgent: toAgent.trim(),
    taskState: taskState.trim(),
    handoffNotes: handoffNotes.trim(),
    supportingReferences,
    unresolvedQuestions,
    nextActions,
    createdAt: new Date().toISOString(),
  }

  const list = memHandoffs.get(projectId) || []
  list.unshift(handoff)
  memHandoffs.set(projectId, list)
  return handoff
}

export function getLatestHandoff(projectId: string): AgentHandoff | null {
  const list = memHandoffs.get(projectId)
  return list && list.length > 0 ? list[0] : null
}

export function listProjectHandoffs(projectId: string): AgentHandoff[] {
  return memHandoffs.get(projectId) || []
}

export function updateProjectContext(opts: {
  projectId: string
  name?: string
  architecture?: Partial<ProjectContext['architecture']>
  activeTasks?: ProjectTask[]
  blockers?: string[]
  preferences?: string[]
  keyTerms?: Record<string, string>
}): ProjectContext {
  const ctx = getOrCreateProjectContext({ projectId: opts.projectId, userId: 'system' })
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
  return ctx
}

export function generateContinuitySnapshot(opts: {
  projectId: string
  projectName?: string
  userId: string
  scope?: 'personal' | 'team'
  teamId?: string | null
  activeMemories?: Array<{ type: string; text: string; blobId?: string | null }>
}): ContinuitySnapshot {
  const { projectId, projectName, userId, scope, teamId, activeMemories = [] } = opts
  const context = getOrCreateProjectContext({ projectId, projectName, userId, scope, teamId })
  const latestHandoff = getLatestHandoff(projectId)

  const now = new Date().toISOString()
  const rawPayload: Omit<ContinuitySnapshot, 'checksum'> = {
    schemaVersion: '2.0',
    snapshotId: `snap_${randomUUID().slice(0, 8)}`,
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
  memSnapshots.set(projectId, fullSnapshot) // Latest for project
  return fullSnapshot
}

export function restoreContinuitySnapshot(snapshotJson: string | ContinuitySnapshot): {
  verified: boolean
  snapshot: ContinuitySnapshot | null
  error?: string
} {
  try {
    const parsed: ContinuitySnapshot =
      typeof snapshotJson === 'string' ? JSON.parse(snapshotJson) : snapshotJson

    if (!parsed || parsed.schemaVersion !== '2.0' || !parsed.checksum || !parsed.projectId) {
      return { verified: false, snapshot: null, error: 'Invalid snapshot format or missing schemaVersion 2.0' }
    }

    const { checksum, ...rest } = parsed
    const expectedChecksum = computeSnapshotChecksum(rest)
    if (checksum !== expectedChecksum) {
      return { verified: false, snapshot: null, error: 'Snapshot integrity checksum mismatch: data has been altered.' }
    }

    memContexts.set(parsed.projectId, parsed.context)
    if (parsed.latestHandoff) {
      const list = memHandoffs.get(parsed.projectId) || []
      list.unshift(parsed.latestHandoff)
      memHandoffs.set(parsed.projectId, list)
    }
    memSnapshots.set(parsed.snapshotId, parsed)

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
