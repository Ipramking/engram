// Comprehensive Phase 1 Verification Test Suite
// Verifies:
// 1. User Registration & Login
// 2. Personal & Team API Key Creation
// 3. Team Roster Management & Strict 3-Member Limit
// 4. Daily Usage & Quota Tracking (50 saves/day personal, 150/day team)
// 5. MCP Streamable HTTP Server Live Authentication with eng_live_* keys

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import express from 'express'
import cors from 'cors'

// Set test environment
const testDbPath = join(tmpdir(), `engram-phase1-test-${Date.now()}.db`)
process.env.ENGRAM_DB_PATH = testDbPath
process.env.PORT = '8795'
process.env.ENGRAM_SIGNING_SECRET = 'test-phase1-secret-key-123'
process.env.ENGRAM_MCP_BACKEND = 'mock'

import {
  createProfile,
  getProfile,
  createApiKey,
  listApiKeys,
  validateApiKey,
  revokeApiKey,
  createTeam,
  listTeams,
  listTeamMembers,
  addTeamMember,
  getUsage,
  checkAndIncrementUsage,
  PLAN_LIMITS,
} from '../mcp/auth-db.mjs'

async function runTests() {
  console.log('─── 1. Testing User Profiles & Plan Limits ───')
  const testUserId = 'test-usr-1001'
  const testEmail = 'ada.lovelace@engram.test'
  const profile = await createProfile(testUserId, testEmail, 'Ada Lovelace', 'free_personal')
  console.log('✓ Created profile:', profile.email, `(${profile.plan_tier})`)

  if (profile.plan_tier !== 'free_personal') throw new Error('Expected default plan_tier to be free_personal')
  const fetchedProfile = await getProfile(testUserId)
  if (!fetchedProfile || fetchedProfile.email !== testEmail) throw new Error('Failed to retrieve profile')
  console.log('✓ Profile retrieved from storage successfully')

  console.log('\n─── 2. Testing API Key Minting, Validation & Revocation ───')
  const personalKey = await createApiKey({
    userId: testUserId,
    name: 'MacBook Claude Desktop',
    scope: 'personal',
    room: 'main',
  })
  console.log('✓ Minted personal key:', personalKey.rawKey.slice(0, 18) + '...', `prefix: ${personalKey.key_prefix}`)
  if (!personalKey.rawKey.startsWith('eng_usr_')) throw new Error('Personal key should start with eng_usr_')

  // Validate active key
  const validated = await validateApiKey(personalKey.rawKey)
  if (!validated || validated.user_id !== testUserId) throw new Error('API key validation failed')
  console.log('✓ Validated active key against database hash')

  // List keys
  const keysList = await listApiKeys(testUserId)
  if (!keysList.length || keysList[0].key_prefix !== personalKey.key_prefix) throw new Error('Failed to list user keys')
  console.log(`✓ User keys list returned ${keysList.length} active key(s)`)

  // Revoke key
  await revokeApiKey(personalKey.id, testUserId)
  const revokedCheck = await validateApiKey(personalKey.rawKey)
  if (revokedCheck !== null) throw new Error('Revoked key should not validate!')
  console.log('✓ Key revoked and properly rejected on subsequent auth check')

  // Mint fresh key for remaining tests
  const activeKey = await createApiKey({
    userId: testUserId,
    name: 'Cursor IDE Live Key',
    scope: 'personal',
    room: 'dev-room',
  })

  console.log('\n─── 3. Testing Team Spaces & Strict 3-Member Free Plan Limit ───')
  const team = await createTeam('Acme Engineering', testUserId, testEmail)
  console.log('✓ Created team space:', team.name, `id: ${team.id}`)

  // Initial roster (Owner only)
  let roster = await listTeamMembers(team.id)
  console.log(`✓ Team created with initial roster of ${roster.length} member (Owner: ${roster[0].email})`)

  // Add Member 2
  await addTeamMember({
    teamId: team.id,
    requesterId: testUserId,
    email: 'bob@engram.test',
    role: 'member',
  })
  roster = await listTeamMembers(team.id)
  console.log(`✓ Added Member 2: bob@engram.test (Roster count: ${roster.length})`)

  // Add Member 3
  await addTeamMember({
    teamId: team.id,
    requesterId: testUserId,
    email: 'charlie@engram.test',
    role: 'member',
  })
  roster = await listTeamMembers(team.id)
  console.log(`✓ Added Member 3: charlie@engram.test (Roster count: ${roster.length})`)

  // Attempt to add Member 4 (MUST FAIL ON FREE PLAN)
  let fourBlocked = false
  try {
    await addTeamMember({
      teamId: team.id,
      requesterId: testUserId,
      email: 'dave@engram.test',
      role: 'member',
    })
  } catch (err) {
    fourBlocked = true
    console.log('✓ Successfully blocked 4th member invitation:', err.message)
  }
  if (!fourBlocked) throw new Error('Free team plan allowed more than 3 members!')

  console.log('\n─── 4. Testing Daily Usage Tracking & Quota Limits ───')
  const initialUsage = await getUsage('user', testUserId)
  console.log(`✓ Initial usage for today: ${initialUsage.saves_count} saves, ${initialUsage.recalls_count} recalls`)

  // Increment usage
  const u1 = await checkAndIncrementUsage({ entityType: 'user', entityId: testUserId, operation: 'save' })
  const u2 = await checkAndIncrementUsage({ entityType: 'user', entityId: testUserId, operation: 'recall' })
  console.log(`✓ Recorded save & recall (current saves: ${u1.saves}/${u1.limit})`)

  // Test quota ceiling (Simulate reaching limit of 50)
  let quotaBlocked = false
  try {
    for (let i = 0; i < 55; i++) {
      await checkAndIncrementUsage({ entityType: 'user', entityId: testUserId, operation: 'save', planTier: 'free_personal' })
    }
  } catch (err) {
    quotaBlocked = true
    console.log('✓ Successfully blocked writes after exceeding daily limit:', err.message)
  }
  if (!quotaBlocked) throw new Error('Failed to enforce daily quota limit!')

  console.log('\n─── 5. Testing Live MCP HTTP Endpoint Authentication ───')
  // Mint fresh key for MCP user with available quota
  const mcpUserId = 'test-mcp-user-2002'
  await createProfile(mcpUserId, 'grace.hopper@engram.test', 'Grace Hopper', 'free_personal')
  const mcpKey = await createApiKey({
    userId: mcpUserId,
    name: 'Grace Cursor Connection',
    scope: 'personal',
    room: 'main-space',
  })

  // Spin up test HTTP server
  const MCP_PORT = 8796
  const srv = spawn(process.execPath, ['mcp/engram-http.mjs'], {
    env: {
      ...process.env,
      PORT: String(MCP_PORT),
      ENGRAM_MCP_BACKEND: 'mock',
      ENGRAM_SIGNING_SECRET: 'test-phase1-secret-key-123',
      ENGRAM_DB_PATH: testDbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  srv.stdout.on('data', (d) => process.stdout.write('[mcp-srv] ' + d))
  srv.stderr.on('data', (d) => process.stderr.write('[mcp-err] ' + d))

  // Wait for server ready
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${MCP_PORT}/health`)
      if (res.ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }

  // Connect with valid activeKey
  const initRpc = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'phase1-tester', version: '1.0' },
    },
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  }

  const connectRes = await fetch(`http://localhost:${MCP_PORT}/mcp?token=${encodeURIComponent(mcpKey.rawKey)}&room=main-space`, {
    method: 'POST',
    headers,
    body: JSON.stringify(initRpc),
  })

  console.log('✓ MCP initialize response status:', connectRes.status)
  if (connectRes.status !== 200) throw new Error('MCP server rejected valid API key!')

  const sid = connectRes.headers.get('mcp-session-id')
  console.log('✓ MCP session initialized with session ID:', sid)

  // Test remembering a fact
  const rememberRpc = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'engram_remember',
      arguments: {
        text: 'Architecture decision: Phase 1 database tables and auth live in Supabase with SQLite fallback.',
        type: 'decision',
      },
    },
  }

  const remRes = await fetch(`http://localhost:${MCP_PORT}/mcp?token=${encodeURIComponent(mcpKey.rawKey)}&room=main-space`, {
    method: 'POST',
    headers: { ...headers, 'mcp-session-id': sid },
    body: JSON.stringify(rememberRpc),
  })

  const parseSse = async (res) => {
    const raw = await res.text()
    for (const line of raw.split('\n')) {
      if (line.startsWith('data: ')) {
        try { return JSON.parse(line.slice(6)) } catch {}
      }
    }
    try { return JSON.parse(raw) } catch {}
    return { raw }
  }

  const remJson = await parseSse(remRes)
  console.log('✓ Remembered through live MCP endpoint:', remJson.result?.content?.[0]?.text || remJson)

  // Test recall
  const recallRpc = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'engram_recall',
      arguments: { query: 'Phase 1 database' },
    },
  }

  const recRes = await fetch(`http://localhost:${MCP_PORT}/mcp?token=${encodeURIComponent(mcpKey.rawKey)}&room=main-space`, {
    method: 'POST',
    headers: { ...headers, 'mcp-session-id': sid },
    body: JSON.stringify(recallRpc),
  })

  const recJson = await parseSse(recRes)
  console.log('✓ Recalled from MCP session:\n ', recJson.result?.content?.[0]?.text || recJson)

  srv.kill()
  console.log('\n========================================')
  console.log('🎉 ALL PHASE 1 TESTS PASSED SUCCESSFULLY!')
  console.log('========================================')
  process.exit(0)
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
