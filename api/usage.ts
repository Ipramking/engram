import { getUserFromRequest } from './_lib/auth.js'
import { getUsage, PLAN_LIMITS, listTeams, getQuotaResetMetadata } from './_lib/db.js'

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
    const { resetAt, secondsUntilReset } = getQuotaResetMetadata()

    // Get user personal usage for today
    const personalUsage = await getUsage('user', user.id)
    const personalRemaining = Math.max(0, limits.dailySaves - personalUsage.saves_count)
    const personalPercent = Math.min(100, Math.round((personalUsage.saves_count / limits.dailySaves) * 100))

    // Set standard rate limit headers
    res.setHeader('X-RateLimit-Limit', String(limits.dailySaves))
    res.setHeader('X-RateLimit-Remaining', String(personalRemaining))
    res.setHeader('X-RateLimit-Reset', String(resetAt))

    // Get team usages for teams user belongs to
    const teams = await listTeams(user.id)
    const teamUsages = await Promise.all(
      teams.map(async (t: any) => {
        const usage = await getUsage('team', t.id)
        const teamPlan = t.plan_tier || 'free_team'
        const teamLimits = PLAN_LIMITS[teamPlan] || PLAN_LIMITS.free_team
        const teamRemaining = Math.max(0, teamLimits.dailySaves - usage.saves_count)
        const teamPercent = Math.min(100, Math.round((usage.saves_count / teamLimits.dailySaves) * 100))
        return {
          teamId: t.id,
          teamName: t.name,
          plan: teamPlan,
          saves: usage.saves_count,
          dailyLimit: teamLimits.dailySaves,
          remaining: teamRemaining,
          percentUsed: teamPercent,
          recalls: usage.recalls_count,
          maxMembers: teamLimits.maxTeamMembers,
          resetAt,
          secondsUntilReset,
        }
      })
    )

    return res.status(200).json({
      ok: true,
      plan,
      personal: {
        saves: personalUsage.saves_count,
        dailyLimit: limits.dailySaves,
        remaining: personalRemaining,
        percentUsed: personalPercent,
        recalls: personalUsage.recalls_count,
        maxMemories: limits.maxMemories,
        resetAt,
        secondsUntilReset,
      },
      teams: teamUsages,
    })
  } catch (err: any) {
    console.error('[api/usage] error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to fetch usage stats.' })
  }
}
