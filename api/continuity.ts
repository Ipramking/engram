// Engram 2.0 Continuity & Cross-Agent Handoff REST Endpoint
import { getUserFromRequest, authorizeMemoryAccess } from './_lib/auth.js'
import { getSupabaseAdmin } from './_lib/supabase.js'
import { isTeamMember } from './_lib/db.js'
import {
  getOrCreateProjectContext,
  recordAgentHandoff,
  getLatestHandoff,
  listProjectHandoffs,
  updateProjectContext,
  generateContinuitySnapshot,
  restoreContinuitySnapshot,
  formatQuickResumeBrief,
} from './_lib/continuity.js'

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized: please provide a valid Authorization Bearer token to access continuity engine.',
    })
  }

  const supabase = getSupabaseAdmin()

  // ── GET: Project Context, Quick-Resume Brief, or Handoff History ──
  if (req.method === 'GET') {
    const projectId = req.query.projectId || req.query.project || `proj_${user.id.slice(0, 8)}`
    const action = req.query.action || 'context'
    const format = req.query.format || 'json'

    const context = getOrCreateProjectContext({
      projectId,
      userId: user.id,
      scope: req.query.scope === 'team' ? 'team' : 'personal',
      teamId: req.query.teamId || null,
    })

    // IDOR / Team Authorization Check
    if (context.scope === 'team' && context.teamId) {
      const authorized = await isTeamMember(user.id, context.teamId)
      if (!authorized) {
        return res.status(403).json({ error: 'Forbidden: you are not a member of this project team.' })
      }
    }

    const latestHandoff = getLatestHandoff(projectId)

    if (action === 'resume' || format === 'markdown') {
      const snapshot = generateContinuitySnapshot({
        projectId,
        projectName: context.name,
        userId: user.id,
        scope: context.scope,
        teamId: context.teamId,
      })
      const brief = formatQuickResumeBrief(snapshot)
      if (format === 'markdown') {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
        return res.status(200).send(brief)
      }
      return res.status(200).json({ ok: true, brief, snapshotId: snapshot.snapshotId, checksum: snapshot.checksum })
    }

    if (action === 'history') {
      const handoffs = listProjectHandoffs(projectId)
      return res.status(200).json({ ok: true, projectId, handoffs })
    }

    return res.status(200).json({
      ok: true,
      context,
      latestHandoff,
    })
  }

  // ── POST: Record Handoff, Create Snapshot, Restore Snapshot, or Update Context ──
  if (req.method === 'POST') {
    const body = req.body || {}
    const action = body.action || req.query.action || 'handoff'
    const projectId = body.projectId || req.query.projectId || `proj_${user.id.slice(0, 8)}`

    // Authorization check
    if (body.teamId || req.query.teamId) {
      const tId = body.teamId || req.query.teamId
      const authorized = await isTeamMember(user.id, tId)
      if (!authorized) {
        return res.status(403).json({ error: 'Forbidden: unauthorized access to team continuity.' })
      }
    }

    // 1. Record Agent Handoff
    if (action === 'handoff') {
      const {
        fromAgent = 'Agent',
        toAgent = 'Next Agent',
        taskState = 'in_progress',
        handoffNotes = '',
        supportingReferences = [],
        unresolvedQuestions = [],
        nextActions = [],
      } = body

      if (!handoffNotes.trim()) {
        return res.status(400).json({ error: 'handoffNotes is required to record a continuity handoff.' })
      }

      const handoff = recordAgentHandoff({
        projectId,
        fromAgent,
        toAgent,
        taskState,
        handoffNotes,
        supportingReferences,
        unresolvedQuestions,
        nextActions,
      })

      return res.status(200).json({
        ok: true,
        message: 'Continuity handoff recorded successfully.',
        handoff,
      })
    }

    // 2. Export / Create Verifiable Snapshot
    if (action === 'snapshot') {
      const { projectName, scope = 'personal', teamId = null } = body

      let activeMemories: Array<{ type: string; text: string; blobId?: string | null }> = []
      if (supabase) {
        let q = supabase
          .from('memories_meta')
          .select('type, text, blob_id')
          .order('created_at', { ascending: false })
          .limit(20)

        if (scope === 'team' && teamId) {
          q = q.eq('team_id', teamId)
        } else {
          q = q.eq('user_id', user.id).is('team_id', null)
        }

        const { data } = await q
        if (data) {
          activeMemories = data.map((d: any) => ({
            type: d.type || 'decision',
            text: d.text,
            blobId: d.blob_id,
          }))
        }
      }

      const snapshot = generateContinuitySnapshot({
        projectId,
        projectName,
        userId: user.id,
        scope,
        teamId,
        activeMemories,
      })

      const brief = formatQuickResumeBrief(snapshot)

      return res.status(200).json({
        ok: true,
        snapshot,
        brief,
        checksum: snapshot.checksum,
      })
    }

    // 3. Restore and Verify Snapshot
    if (action === 'restore') {
      const { snapshot } = body
      if (!snapshot) {
        return res.status(400).json({ error: 'snapshot payload is required for restoration.' })
      }

      const outcome = restoreContinuitySnapshot(snapshot)
      if (!outcome.verified || !outcome.snapshot) {
        return res.status(400).json({
          ok: false,
          verified: false,
          error: outcome.error || 'Snapshot checksum verification failed.',
        })
      }

      return res.status(200).json({
        ok: true,
        verified: true,
        snapshot: outcome.snapshot,
        message: 'Continuity snapshot restored and integrity verified.',
      })
    }

    // 4. Update Context
    if (action === 'update_context' || action === 'update') {
      const updated = updateProjectContext({
        projectId,
        name: body.name,
        architecture: body.architecture,
        activeTasks: body.activeTasks,
        blockers: body.blockers,
        preferences: body.preferences,
        keyTerms: body.keyTerms,
      })

      return res.status(200).json({
        ok: true,
        context: updated,
      })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  }

  return res.status(405).json({ error: 'Method Not Allowed' })
}
