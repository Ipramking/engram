import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'

export interface PlanLimits {
  dailySaves: number
  maxTeamMembers: number
  maxRooms: number
  maxMemories: number
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free_personal: {
    dailySaves: 50,
    maxTeamMembers: 1,
    maxRooms: 1,
    maxMemories: 5000,
  },
  free_team: {
    dailySaves: 150,
    maxTeamMembers: 3,
    maxRooms: 3,
    maxMemories: 15000,
  },
  pro: {
    dailySaves: 5000,
    maxTeamMembers: 1000,
    maxRooms: 100,
    maxMemories: 100000,
  },
}

export function hashKey(secret: string): string {
  const salt = process.env.ENGRAM_SIGNING_SECRET || 'engram-key-salt-default'
  return createHmac('sha256', salt).update(secret).digest('hex')
}

export function generateApiKey(scope: string = 'personal') {
  const randomPart = randomBytes(24).toString('base64url')
  const rawKey = `eng_${scope === 'personal' ? 'usr' : 'team'}_${randomPart}`
  const keyPrefix = rawKey.slice(0, 14)
  const keyHash = hashKey(rawKey)
  return { rawKey, keyPrefix, keyHash }
}

export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// In-memory fallback for serverless environments when Supabase is unavailable
const memProfiles = new Map<string, any>()
const memApiKeys = new Map<string, any>()
const memTeams = new Map<string, any>()
const memTeamMembers = new Map<string, any[]>()
const memUsage = new Map<string, any>()

export async function getProfile(userId: string) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) return data
  }
  return memProfiles.get(userId) || null
}

export async function createProfile(id: string, email: string, name?: string, planTier: string = 'free_personal') {
  const supabase = getSupabaseAdmin()
  const displayName = name || email.split('@')[0]
  if (supabase) {
    const { data } = await supabase.from('profiles').upsert({
      id,
      email,
      name: displayName,
      plan_tier: planTier,
    }).select().single()
    if (data) return data
  }
  const profile = { id, email, name: displayName, plan_tier: planTier }
  memProfiles.set(id, profile)
  return profile
}

export async function createApiKey(opts: {
  userId: string
  name: string
  scope: string
  teamId?: string
  room?: string
}) {
  if (opts.scope === 'team') {
    if (!opts.teamId) throw new Error('teamId is required for team scope keys.')
    const isMember = await isTeamMember(opts.userId, opts.teamId)
    if (!isMember) {
      throw new Error('Forbidden: you must be an active member of this team to generate a team key.')
    }
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKey(opts.scope)
  const room = opts.room || 'my-space'
  const id = randomUUID()

  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data, error } = await supabase.from('api_keys').insert({
      id,
      user_id: opts.userId,
      team_id: opts.teamId || null,
      name: opts.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scope: opts.scope,
      room,
      is_active: true,
    }).select().single()
    if (!error && data) return { ...data, rawKey }
  }

  const record = {
    id,
    user_id: opts.userId,
    team_id: opts.teamId || null,
    name: opts.name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scope: opts.scope,
    room,
    is_active: true,
    created_at: new Date().toISOString(),
  }
  memApiKeys.set(keyHash, record)
  return { ...record, rawKey }
}

export async function listApiKeys(userId: string) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scope, room, is_active, created_at, last_used_at, team_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (data) return data
  }
  return Array.from(memApiKeys.values()).filter((k) => k.user_id === userId && k.is_active)
}

export async function validateApiKey(rawKey: string) {
  const hash = hashKey(rawKey)
  const fallbackHash = createHmac('sha256', 'engram-key-salt-default').update(rawKey).digest('hex')
  const hashes = hash === fallbackHash ? [hash] : [hash, fallbackHash]
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data: rows } = await supabase
      .from('api_keys')
      .select('*')
      .in('key_hash', hashes)
      .eq('is_active', true)
      .limit(1)
    const data = rows?.[0]
    if (data) {
      supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then()
      return data
    }
  }
  const row = memApiKeys.get(hash) || memApiKeys.get(fallbackHash)
  if (row && row.is_active) {
    row.last_used_at = new Date().toISOString()
    return row
  }
  return null
}

export async function revokeApiKey(keyId: string, userId: string) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('user_id', userId)
    if (!error) return true
  }
  for (const [, v] of memApiKeys) {
    if (v.id === keyId && v.user_id === userId) {
      v.is_active = false
      return true
    }
  }
  return false
}

export async function createTeam(name: string, ownerId: string, ownerEmail: string) {
  const teamId = randomUUID()
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data: team, error } = await supabase
      .from('teams')
      .insert({ id: teamId, name, owner_id: ownerId, plan_tier: 'free_team' })
      .select().single()
    if (!error && team) {
      await supabase.from('team_members').insert({
        id: randomUUID(),
        team_id: teamId,
        user_id: ownerId,
        email: ownerEmail,
        role: 'owner',
        status: 'active',
      })
      return team
    }
  }
  const team = { id: teamId, name, owner_id: ownerId, plan_tier: 'free_team', created_at: new Date().toISOString() }
  memTeams.set(teamId, team)
  memTeamMembers.set(teamId, [
    { id: randomUUID(), team_id: teamId, user_id: ownerId, email: ownerEmail, role: 'owner', status: 'active' },
  ])
  return team
}

export async function listTeams(userId: string) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase
      .from('team_members')
      .select('team_id, role, teams(id, name, owner_id, plan_tier, created_at)')
      .eq('user_id', userId)
    if (data) return data.map((d: any) => ({ ...d.teams, role: d.role }))
  }
  const out: any[] = []
  for (const [tid, members] of memTeamMembers) {
    const m = members.find((x) => x.user_id === userId)
    if (m && memTeams.has(tid)) {
      out.push({ ...memTeams.get(tid), role: m.role })
    }
  }
  return out
}

export async function listTeamMembers(teamId: string) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase.from('team_members').select('*').eq('team_id', teamId)
    if (data) return data
  }
  return memTeamMembers.get(teamId) || []
}

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  if (!userId || !teamId) return false
  const members = await listTeamMembers(teamId)
  return members.some((m: any) => m.user_id === userId && m.status === 'active')
}

export async function addTeamMember(opts: {
  teamId: string
  requesterId: string
  email: string
  role?: string
}) {
  const members = await listTeamMembers(opts.teamId)
  const requester = members.find((m: any) => m.user_id === opts.requesterId)
  if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
    throw new Error('Only team owners or admins can invite new members.')
  }
  if (members.some((m: any) => m.email.toLowerCase() === opts.email.toLowerCase())) {
    throw new Error('This user is already a member of this team.')
  }
  if (members.length >= 3) {
    throw new Error('The Free Team Plan is limited to a maximum of 3 members. Please upgrade to Pro to add more members.')
  }

  const memberId = randomUUID()
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data, error } = await supabase.from('team_members').insert({
      id: memberId,
      team_id: opts.teamId,
      email: opts.email.toLowerCase(),
      role: opts.role || 'member',
      status: 'active',
    }).select().single()
    if (!error && data) return data
  }
  const newMember = {
    id: memberId,
    team_id: opts.teamId,
    email: opts.email.toLowerCase(),
    role: opts.role || 'member',
    status: 'active',
  }
  const list = memTeamMembers.get(opts.teamId) || []
  list.push(newMember)
  memTeamMembers.set(opts.teamId, list)
  return newMember
}

export async function getUsage(entityType: string, entityId: string, dateStr: string = getTodayStr()) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase
      .from('usage_daily')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('date', dateStr)
      .single()
    if (data) return data
  }
  const k = `${entityType}:${entityId}:${dateStr}`
  return memUsage.get(k) || { entity_type: entityType, entity_id: entityId, date: dateStr, saves_count: 0, recalls_count: 0 }
}

export function getQuotaResetMetadata() {
  const now = new Date()
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  const resetAt = Math.floor(midnight.getTime() / 1000)
  const secondsUntilReset = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000))
  return { resetAt, secondsUntilReset }
}

export async function checkAndIncrementUsage(opts: {
  entityType: string
  entityId: string
  operation: 'save' | 'recall'
  planTier?: string
}) {
  const tier = opts.planTier || (opts.entityType === 'user' ? 'free_personal' : 'free_team')
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free_personal
  const dateStr = getTodayStr()
  const current = await getUsage(opts.entityType, opts.entityId, dateStr)
  const { resetAt, secondsUntilReset } = getQuotaResetMetadata()

  if (opts.operation === 'save' && current.saves_count >= limits.dailySaves) {
    const err: any = new Error(
      `Daily memory save limit (${limits.dailySaves} saves/day) reached for this ${opts.entityType}. Quota resets at midnight UTC.`
    )
    err.code = 'DAILY_QUOTA_EXCEEDED'
    err.limit = limits.dailySaves
    err.current = current.saves_count
    err.resetAt = resetAt
    err.secondsUntilReset = secondsUntilReset
    throw err
  }

  const newSaves = current.saves_count + (opts.operation === 'save' ? 1 : 0)
  const newRecalls = current.recalls_count + (opts.operation === 'recall' ? 1 : 0)

  const supabase = getSupabaseAdmin()
  if (supabase) {
    await supabase.from('usage_daily').upsert({
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      date: dateStr,
      saves_count: newSaves,
      recalls_count: newRecalls,
    }, { onConflict: 'entity_type,entity_id,date' })
  } else {
    const k = `${opts.entityType}:${opts.entityId}:${dateStr}`
    memUsage.set(k, {
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      date: dateStr,
      saves_count: newSaves,
      recalls_count: newRecalls,
    })
  }

  return {
    saves: newSaves,
    recalls: newRecalls,
    limit: limits.dailySaves,
    remaining: Math.max(0, limits.dailySaves - newSaves),
    resetAt,
    secondsUntilReset,
  }
}
