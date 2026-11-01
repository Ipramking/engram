import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdirSync } from 'node:fs'

const require = createRequire(import.meta.url)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lqscyshajhvzkusougpy.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

let adminClient = null
export function getSupabaseAdmin() {
  if (!SUPABASE_SERVICE_ROLE_KEY) return null
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return adminClient
}

export const PLAN_LIMITS = {
  free_personal: {
    dailySaves: 50,
    maxTeamMembers: 1,
    maxRooms: 1,
    maxMemories: 5000,
  },
  free_team: {
    dailySaves: 150,
    maxTeamMembers: 3, // Strict 3 members rule
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

export function hashKey(secret) {
  const salt = process.env.ENGRAM_SIGNING_SECRET || 'engram-key-salt-default'
  return createHmac('sha256', salt).update(secret).digest('hex')
}

export function generateApiKey(scope = 'personal') {
  const randomPart = randomBytes(24).toString('base64url')
  const rawKey = `eng_${scope === 'personal' ? 'usr' : 'team'}_${randomPart}`
  const keyPrefix = rawKey.slice(0, 14) // e.g. "eng_usr_abc123"
  const keyHash = hashKey(rawKey)
  return { rawKey, keyPrefix, keyHash }
}

export function getTodayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ── SQLite fallback (shared across processes) ──
let fallbackDb = null
function getFallbackDb() {
  if (!fallbackDb) {
    try {
      const { DatabaseSync } = require('node:sqlite')
      const dbDir = join(homedir(), '.engram')
      mkdirSync(dbDir, { recursive: true })
      const dbPath = process.env.ENGRAM_DB_PATH || join(dbDir, 'engram-local.db')
      fallbackDb = new DatabaseSync(dbPath)
      fallbackDb.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          name TEXT,
          plan_tier TEXT NOT NULL DEFAULT 'free_personal',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          team_id TEXT,
          name TEXT NOT NULL,
          key_prefix TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          scope TEXT NOT NULL,
          room TEXT NOT NULL DEFAULT 'my-space',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_used_at TEXT
        );
        CREATE TABLE IF NOT EXISTS teams (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          plan_tier TEXT NOT NULL DEFAULT 'free_team',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS team_members (
          id TEXT PRIMARY KEY,
          team_id TEXT NOT NULL,
          user_id TEXT,
          email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          status TEXT NOT NULL DEFAULT 'active',
          joined_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS usage_daily (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          date TEXT NOT NULL,
          saves_count INTEGER NOT NULL DEFAULT 0,
          recalls_count INTEGER NOT NULL DEFAULT 0,
          UNIQUE(entity_type, entity_id, date)
        );
      `)
    } catch {}
  }
  return fallbackDb
}

export async function getProfile(userId) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) return data
  }
  const db = getFallbackDb()
  if (db) return db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId) || null
  return null
}

export async function createProfile(id, email, name, planTier = 'free_personal') {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase.from('profiles').upsert({
      id,
      email,
      name: name || email.split('@')[0],
      plan_tier: planTier,
    }).select().single()
    if (data) return data
  }
  const db = getFallbackDb()
  if (db) {
    db.prepare('INSERT OR REPLACE INTO profiles (id, email, name, plan_tier) VALUES (?, ?, ?, ?)').run(
      id, email, name || email.split('@')[0], planTier
    )
  }
  return { id, email, name: name || email.split('@')[0], plan_tier: planTier }
}

export async function createApiKey(opts) {
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

  const db = getFallbackDb()
  if (db) {
    db.prepare(`
      INSERT INTO api_keys (id, user_id, team_id, name, key_prefix, key_hash, scope, room, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, opts.userId, opts.teamId || null, opts.name, keyPrefix, keyHash, opts.scope, room)
    return { id, user_id: opts.userId, team_id: opts.teamId, name: opts.name, key_prefix: keyPrefix, scope: opts.scope, room, is_active: true, rawKey }
  }

  return { id, rawKey, ...opts }
}

export async function listApiKeys(userId) {
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
  const db = getFallbackDb()
  if (db) {
    return db.prepare(`
      SELECT id, name, key_prefix, scope, room, is_active, created_at, last_used_at, team_id
      FROM api_keys WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC
    `).all(userId)
  }
  return []
}

export async function validateApiKey(rawKey) {
  const hash = hashKey(rawKey)
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', hash)
      .eq('is_active', true)
      .single()
    if (data) {
      supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then()
      return data
    }
  }
  const db = getFallbackDb()
  if (db) {
    const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1').get(hash)
    if (row) {
      db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.id)
      return row
    }
  }
  return null
}

export async function revokeApiKey(keyId, userId) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('user_id', userId)
    if (!error) return true
  }
  const db = getFallbackDb()
  if (db) {
    db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?').run(keyId, userId)
    return true
  }
  return false
}

export async function createTeam(name, ownerId, ownerEmail) {
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
  const db = getFallbackDb()
  if (db) {
    db.prepare('INSERT INTO teams (id, name, owner_id, plan_tier) VALUES (?, ?, ?, ?)').run(teamId, name, ownerId, 'free_team')
    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, email, role, status) VALUES (?, ?, ?, ?, 'owner', 'active')
    `).run(randomUUID(), teamId, ownerId, ownerEmail)
    return { id: teamId, name, owner_id: ownerId, plan_tier: 'free_team' }
  }
  return { id: teamId, name, owner_id: ownerId, plan_tier: 'free_team' }
}

export async function listTeams(userId) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase
      .from('team_members')
      .select('team_id, role, teams(id, name, owner_id, plan_tier, created_at)')
      .eq('user_id', userId)
    if (data) return data.map((d) => ({ ...d.teams, role: d.role }))
  }
  const db = getFallbackDb()
  if (db) {
    return db.prepare(`
      SELECT t.id, t.name, t.owner_id, t.plan_tier, t.created_at, tm.role
      FROM teams t JOIN team_members tm ON t.id = tm.team_id WHERE tm.user_id = ?
    `).all(userId)
  }
  return []
}

export async function listTeamMembers(teamId) {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase.from('team_members').select('*').eq('team_id', teamId)
    if (data) return data
  }
  const db = getFallbackDb()
  if (db) return db.prepare('SELECT * FROM team_members WHERE team_id = ?').all(teamId)
  return []
}

export async function isTeamMember(userId, teamId) {
  if (!userId || !teamId) return false
  const members = await listTeamMembers(teamId)
  return members.some((m) => m.user_id === userId && m.status === 'active')
}

export async function addTeamMember(opts) {
  const members = await listTeamMembers(opts.teamId)
  const requester = members.find((m) => m.user_id === opts.requesterId)
  if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
    throw new Error('Only team owners or admins can invite new members.')
  }
  if (members.some((m) => m.email.toLowerCase() === opts.email.toLowerCase())) {
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
  const db = getFallbackDb()
  if (db) {
    db.prepare(`
      INSERT INTO team_members (id, team_id, email, role, status) VALUES (?, ?, ?, ?, 'active')
    `).run(memberId, opts.teamId, opts.email.toLowerCase(), opts.role || 'member')
    return { id: memberId, team_id: opts.teamId, email: opts.email.toLowerCase(), role: opts.role || 'member' }
  }
  return { id: memberId, ...opts }
}

export async function getUsage(entityType, entityId, dateStr = getTodayStr()) {
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
  const db = getFallbackDb()
  if (db) {
    const row = db.prepare('SELECT * FROM usage_daily WHERE entity_type = ? AND entity_id = ? AND date = ?').get(
      entityType, entityId, dateStr
    )
    if (row) return row
  }
  return { entity_type: entityType, entity_id: entityId, date: dateStr, saves_count: 0, recalls_count: 0 }
}

export function getQuotaResetMetadata() {
  const now = new Date()
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  const resetAt = Math.floor(midnight.getTime() / 1000)
  const secondsUntilReset = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000))
  return { resetAt, secondsUntilReset }
}

export async function checkAndIncrementUsage(opts) {
  const tier = opts.planTier || (opts.entityType === 'user' ? 'free_personal' : 'free_team')
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free_personal
  const dateStr = getTodayStr()
  const current = await getUsage(opts.entityType, opts.entityId, dateStr)
  const { resetAt, secondsUntilReset } = getQuotaResetMetadata()

  if (opts.operation === 'save' && current.saves_count >= limits.dailySaves) {
    const err = new Error(
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
  }
  const db = getFallbackDb()
  if (db) {
    db.prepare(`
      INSERT INTO usage_daily (id, entity_type, entity_id, date, saves_count, recalls_count)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_type, entity_id, date) DO UPDATE SET
        saves_count = excluded.saves_count,
        recalls_count = excluded.recalls_count
    `).run(randomUUID(), opts.entityType, opts.entityId, dateStr, newSaves, newRecalls)
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
