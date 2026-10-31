import { getUserFromRequest } from './_lib/auth'
import { getUsage, PLAN_LIMITS, listTeams } from './_lib/db'

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const user = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: please sign in to view usage stats.' })
  }

  try {
    const plan = user.plan_tier || 'free_personal'
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free_personal

    // Get user personal usage for today
    const personalUsage = await getUsage('user', user.id)

    // Get team usages for teams user belongs to
    const teams = await listTeams(user.id)
    const teamUsages = await Promise.all(
      teams.map(async (t: any) => {
        const usage = await getUsage('team', t.id)
        const teamPlan = t.plan_tier || 'free_team'
        const teamLimits = PLAN_LIMITS[teamPlan] || PLAN_LIMITS.free_team
        return {
          teamId: t.id,
          teamName: t.name,
          plan: teamPlan,
          saves: usage.saves_count,
          dailyLimit: teamLimits.dailySaves,
          recalls: usage.recalls_count,
          maxMembers: teamLimits.maxTeamMembers,
        }
      })
    )

    return res.status(200).json({
      ok: true,
      plan,
      personal: {
        saves: personalUsage.saves_count,
        dailyLimit: limits.dailySaves,
        recalls: personalUsage.recalls_count,
        maxMemories: limits.maxMemories,
      },
      teams: teamUsages,
    })
  } catch (err: any) {
    console.error('[api/usage] error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to fetch usage stats.' })
  }
}
