import { getUserFromRequest } from './_lib/auth'
import { createTeam, listTeams, listTeamMembers, isTeamMember, addTeamMember } from './_lib/db'

export default async function handler(req: any, res: any) {
  const method = req.method
  const rawUrl = req.url || ''
  const urlPath = rawUrl.split('?')[0] || ''
  const querySubpath = req.query?.subpath || new URLSearchParams(rawUrl.split('?')[1] || '').get('subpath') || ''
  const path = querySubpath && !urlPath.endsWith('/' + querySubpath) ? `${urlPath}/${querySubpath}` : urlPath

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (method === 'OPTIONS') return res.status(200).end()

  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: please sign in to manage teams.' })
  }

  try {
    // ── Create Team ──
    if (method === 'POST' && req.body?.action !== 'invite' && (path.endsWith('/create') || !path.includes('/invite'))) {
      const { name } = req.body || {}
      if (!name) {
        return res.status(400).json({ error: 'Team name is required.' })
      }

      const team = await createTeam(name.trim(), user.id, user.email)
      return res.status(200).json({ ok: true, team })
    }

    // ── List User Teams ──
    if (method === 'GET' && !path.includes('/members')) {
      const teams = await listTeams(user.id)
      return res.status(200).json({ ok: true, teams })
    }

    // ── List Team Members ──
    if (method === 'GET' && path.includes('/members')) {
      const teamId = req.query?.teamId
      if (!teamId) return res.status(400).json({ error: 'teamId is required.' })
      const isMember = await isTeamMember(user.id, teamId)
      if (!isMember) {
        return res.status(403).json({ error: 'Forbidden: you are not an active member of this team.' })
      }
      const members = await listTeamMembers(teamId)
      return res.status(200).json({ ok: true, members })
    }

    // ── Invite Member (Enforces max 3 members on Free Team Plan) ──
    if (method === 'POST' && (path.endsWith('/invite') || req.body?.action === 'invite')) {
      const { teamId, email, role = 'member' } = req.body || {}
      if (!teamId || !email) {
        return res.status(400).json({ error: 'teamId and email are required to invite a member.' })
      }

      try {
        const member = await addTeamMember({
          teamId,
          requesterId: user.id,
          email: email.trim(),
          role,
        })
        return res.status(200).json({ ok: true, member, message: `Invited ${email} to the team.` })
      } catch (limitErr: any) {
        return res.status(403).json({ error: limitErr.message })
      }
    }

    return res.status(404).json({ error: 'Team endpoint not found.' })
  } catch (err: any) {
    console.error('[api/teams] error:', err)
    return res.status(500).json({ error: err?.message || 'Team management error.' })
  }
}
