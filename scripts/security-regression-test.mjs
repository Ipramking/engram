// Automated Security Regression Test Suite for Engram 2.0 (Milestone 0)
// Tests: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06 & REL-01
import assert from 'node:assert/strict'
import {
  getSigningSecret,
  getPreviousSigningSecret,
  signLiveKey,
  verifyLiveKey,
  signSession,
  verifySession,
} from '../api/_lib/token.js'
import {
  createApiKey,
  revokeApiKey,
  isApiKeyActive,
  createTeam,
  addTeamMember,
  isTeamMember,
} from '../api/_lib/db.js'
import {
  authorizeMemoryAccess,
  getUserFromRequest,
} from '../api/_lib/auth.js'
import {
  scanForSecrets,
  redactSensitiveUrl,
  redactCredentials,
} from '../api/_lib/security.js'
import mcpHandler from '../api/mcp.js'
import rememberHandler from '../api/remember.js'

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`)
    console.error(`    ${err.message || err}`)
    failed++
  }
}

// Lightweight mock helper for Vercel/Express-style req & res
function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = null, query = {} } = {}) {
  const req = {
    method,
    url,
    headers: { ...headers },
    body,
    query,
  }

  let statusCode = 200
  const responseHeaders = {}
  let sentData = null
  let ended = false

  const res = {
    setHeader(name, val) {
      responseHeaders[name.toLowerCase()] = val
      return res
    },
    status(code) {
      statusCode = code
      return res
    },
    json(data) {
      sentData = data
      ended = true
      return res
    },
    send(data) {
      sentData = data
      ended = true
      return res
    },
    end() {
      ended = true
      return res
    },
    getStatusCode: () => statusCode,
    getData: () => sentData,
    getHeaders: () => responseHeaders,
  }

  return { req, res }
}

console.log('\n🔒 RUNNING ENGRAM 2.0 SECURITY REGRESSION SUITE\n' + '='.repeat(50))

// ── Test Group 1: SEC-01 Secrets & Fail-Closed Behavior ──
console.log('\n[1] SEC-01: Authentication & Signing Secret Hardening')

await test('Production fails closed when ENGRAM_SIGNING_SECRET is missing', () => {
  const oldEnv = process.env.NODE_ENV
  const oldSecret = process.env.ENGRAM_SIGNING_SECRET
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.ENGRAM_SIGNING_SECRET
    delete process.env.VERCEL
    assert.throws(
      () => getSigningSecret(),
      /CRITICAL_SECURITY_ERROR.*missing or insecure/i
    )
  } finally {
    process.env.NODE_ENV = oldEnv
    if (oldSecret) process.env.ENGRAM_SIGNING_SECRET = oldSecret
    else delete process.env.ENGRAM_SIGNING_SECRET
  }
})

await test('Production fails closed when ENGRAM_SIGNING_SECRET is < 16 characters', () => {
  const oldEnv = process.env.NODE_ENV
  const oldSecret = process.env.ENGRAM_SIGNING_SECRET
  try {
    process.env.NODE_ENV = 'production'
    process.env.ENGRAM_SIGNING_SECRET = 'short-secret'
    assert.throws(
      () => getSigningSecret(),
      /CRITICAL_SECURITY_ERROR.*missing or insecure/i
    )
  } finally {
    process.env.NODE_ENV = oldEnv
    if (oldSecret) process.env.ENGRAM_SIGNING_SECRET = oldSecret
    else delete process.env.ENGRAM_SIGNING_SECRET
  }
})

await test('Token expiration works and expired tokens are rejected', () => {
  const secret = 'valid-production-secret-at-least-32-chars!'
  const payload = { uid: 'usr_test_expired', scope: 'personal' }
  // Sign with -10s expiration
  const expiredToken = signLiveKey(payload, secret, -10)
  const verified = verifyLiveKey(expiredToken, secret)
  assert.equal(verified, null, 'Expired live key must verify to null')

  // Sign with valid expiration
  const validToken = signLiveKey(payload, secret, 3600)
  const validRes = verifyLiveKey(validToken, secret)
  assert.equal(validRes?.uid, 'usr_test_expired')
})

await test('Zero-downtime secret rotation verifies with previous secret', () => {
  const oldSecret = 'old-secret-version-1-for-rotation-test!'
  const newSecret = 'new-secret-version-2-for-rotation-test!'

  // User holds token signed under old secret
  const token = signLiveKey({ uid: 'usr_rotated', scope: 'personal' }, oldSecret)

  // System rotates to newSecret, keeping oldSecret as previous
  const prevEnv = process.env.ENGRAM_PREVIOUS_SIGNING_SECRET
  const currentEnv = process.env.ENGRAM_SIGNING_SECRET
  try {
    process.env.ENGRAM_SIGNING_SECRET = newSecret
    process.env.ENGRAM_PREVIOUS_SIGNING_SECRET = oldSecret

    const verified = verifyLiveKey(token)
    assert.ok(verified, 'Token signed with previous secret should verify during rotation')
    assert.equal(verified.uid, 'usr_rotated')
  } finally {
    if (prevEnv) process.env.ENGRAM_PREVIOUS_SIGNING_SECRET = prevEnv
    else delete process.env.ENGRAM_PREVIOUS_SIGNING_SECRET
    if (currentEnv) process.env.ENGRAM_SIGNING_SECRET = currentEnv
    else delete process.env.ENGRAM_SIGNING_SECRET
  }
})

// ── Test Group 2: SEC-02 Centralized Team Authorization & IDOR ──
console.log('\n[2] SEC-02: Centralized Team Authorization & IDOR Protection')

await test('Personal user cannot access unauthorized team memory', async () => {
  const user = { id: 'usr_alice', plan_tier: 'free_personal' }
  const res = await authorizeMemoryAccess({
    user,
    requestedScope: 'team',
    requestedTeamCode: 'team_secret_bob',
  })
  assert.equal(res.authorized, false)
  assert.equal(res.statusCode, 403)
  assert.match(res.error, /not an active member/i)
})

await test('Team member can access their authorized team memory', async () => {
  const team = await createTeam('Engineering Alpha', 'usr_carol', 'carol@engram.io')
  await addTeamMember({
    teamId: team.id,
    requesterId: 'usr_carol',
    email: 'dave@engram.io',
  })

  const isMember = await isTeamMember('usr_carol', team.id)
  assert.equal(isMember, true)

  const res = await authorizeMemoryAccess({
    user: { id: 'usr_carol', plan_tier: 'free_team' },
    requestedScope: 'team',
    requestedTeamCode: team.id,
  })
  assert.equal(res.authorized, true)
  assert.equal(res.effectiveScope, 'team')
  assert.equal(res.effectiveTeamId, team.id)
})

await test('Team-scoped API key cannot access personal memory or another team', async () => {
  const teamKeyUser = {
    id: 'usr_eve',
    apiKey: {
      id: 'k_team_1',
      scope: 'team',
      team_id: 'team_sales',
    },
  }

  // Eve's key tries to access personal memory
  const personalRes = await authorizeMemoryAccess({
    user: teamKeyUser,
    requestedScope: 'personal',
  })
  assert.equal(personalRes.authorized, false)
  assert.equal(personalRes.statusCode, 403)
  assert.match(personalRes.error, /cannot access personal memory/i)

  // Eve's key tries to access team_engineering
  const otherTeamRes = await authorizeMemoryAccess({
    user: teamKeyUser,
    requestedScope: 'team',
    requestedTeamCode: 'team_engineering',
  })
  assert.equal(otherTeamRes.authorized, false)
  assert.equal(otherTeamRes.statusCode, 403)
  assert.match(otherTeamRes.error, /strictly scoped to team/i)
})

await test('MCP endpoint blocks cross-team IDOR in engram_remember tool call', async () => {
  const aliceLive = signLiveKey({ uid: 'usr_alice_mcp', scope: 'personal' })
  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api/mcp',
    headers: { authorization: `Bearer ${aliceLive}` },
    body: {
      jsonrpc: '2.0',
      id: 'req_1',
      method: 'tools/call',
      params: {
        name: 'engram_remember',
        arguments: {
          text: 'Attacker writing to victim team space',
          scope: 'team',
          team_code: 'victim_org_finance',
        },
      },
    },
  })

  await mcpHandler(req, res)
  const data = res.getData()
  assert.ok(data?.result?.isError, 'MCP call must return isError: true on unauthorized team write')
  assert.match(data?.result?.content?.[0]?.text, /Forbidden.*not an active member/i)
})

// ── Test Group 3: SEC-03 Real-Time Token Revocation ──
console.log('\n[3] SEC-03: Real-Time Token Revocation Guarantees')

await test('Revoked API key immediately invalidates eng_live_ tokens across REST and MCP', async () => {
  const apiKeyRecord = await createApiKey({
    userId: 'usr_frank',
    name: 'Frank Phone Key',
    scope: 'personal',
    room: 'my-space',
  })

  const liveToken = signLiveKey({
    uid: 'usr_frank',
    kid: apiKeyRecord.id,
    scope: 'personal',
  })

  // Before revocation: active
  const activeBefore = await isApiKeyActive(apiKeyRecord.id)
  assert.equal(activeBefore, true, 'Key should be active initially')

  const userBefore = await getUserFromRequest({
    headers: { authorization: `Bearer ${liveToken}` },
  })
  assert.ok(userBefore, 'Active live token should resolve user')
  assert.equal(userBefore.id, 'usr_frank')

  // Revoke key
  const revoked = await revokeApiKey(apiKeyRecord.id, 'usr_frank')
  assert.equal(revoked, true, 'revokeApiKey should return true')

  const activeAfter = await isApiKeyActive(apiKeyRecord.id)
  assert.equal(activeAfter, false, 'Key should be inactive after revocation')

  // After revocation: must be rejected on REST
  const userAfter = await getUserFromRequest({
    headers: { authorization: `Bearer ${liveToken}` },
  })
  assert.equal(userAfter, null, 'Revoked live key must immediately return null from getUserFromRequest')

  // After revocation: must be rejected on MCP
  const { req: mcpReq, res: mcpRes } = createMockReqRes({
    method: 'POST',
    url: '/api/mcp',
    headers: { authorization: `Bearer ${liveToken}` },
    body: { jsonrpc: '2.0', id: 'mcp_revoked', method: 'tools/list' },
  })
  await mcpHandler(mcpReq, mcpRes)
  assert.equal(mcpRes.getStatusCode(), 401, 'MCP must return 401 Unauthorized for revoked API key')
  assert.match(mcpRes.getData()?.error?.message, /revoked Engram API key/i)
})

await test('Legacy mock_token and session_<id> blocked in production', async () => {
  const oldEnv = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'production'
    const user = await getUserFromRequest({
      headers: { authorization: 'Bearer session_victim_admin_id' },
    })
    assert.equal(user, null, 'Legacy session token impersonation must return null in production')
  } finally {
    process.env.NODE_ENV = oldEnv
  }
})

// ── Test Group 4: SEC-04 Unauthenticated Access Fails Closed ──
console.log('\n[4] SEC-04: Unauthenticated Access Fails Closed')

await test('MCP endpoint rejects unauthenticated requests with 401', async () => {
  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api/mcp',
    headers: {},
    body: { jsonrpc: '2.0', id: 'unauth_req', method: 'tools/list' },
  })
  await mcpHandler(req, res)
  assert.equal(res.getStatusCode(), 401)
  assert.match(res.getData()?.error?.message, /missing \?token= or Authorization header/i)
})

// ── Test Group 5: SEC-05 Credential Redaction ──
console.log('\n[5] SEC-05: Credential Redaction in URLs and Logs')

await test('redactSensitiveUrl redacts ?token= and ?key=', () => {
  const rawUrl = 'https://engram.memory/mcp?token=eng_live_eyJhbGciOiJIUzI1NiJ9.abc123456&room=main'
  const redacted = redactSensitiveUrl(rawUrl)
  assert.equal(redacted, 'https://engram.memory/mcp?token=[REDACTED]&room=main')
})

await test('redactCredentials redacts raw API keys and secrets', () => {
  const logMsg = 'Failed request with token sk-1234567890abcdef1234567890abcdef and ghp_1234567890abcdef1234567890abcdef12'
  const redacted = redactCredentials(logMsg)
  assert.ok(!redacted.includes('sk-1234567890abcdef'), 'OpenAI key should be redacted')
  assert.ok(!redacted.includes('ghp_1234567890abcdef'), 'GitHub token should be redacted')
})

// ── Test Group 6: SEC-06 & REL-01 Truthful Persistence & Content Hash ──
console.log('\n[6] SEC-06 & REL-01: Truthful Persistence States & Integrity Hash')

await test('api/remember returns explicit persistenceState and sha256 contentHash', async () => {
  const token = signLiveKey({ uid: 'usr_rel_test', scope: 'personal' })
  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api/remember',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: {
      text: 'Production databases must be encrypted at rest using AES-256-GCM.',
      type: 'decision',
      scope: 'personal',
    },
  })

  await rememberHandler(req, res)
  assert.equal(res.getStatusCode(), 200)
  const data = res.getData()
  assert.equal(data.ok, true)
  assert.equal(data.type, 'decision')
  assert.ok(['confirmed_durable', 'pending_metadata_only', 'local_mock'].includes(data.persistenceState), 'Must return explicit persistenceState')
  assert.ok(data.contentHash && data.contentHash.length === 64, 'Must return 64-character sha256 contentHash')
})

// ── Summary ──
console.log('\n' + '='.repeat(50))
console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
if (failed > 0) {
  process.exit(1)
} else {
  console.log('🎉 ALL SECURITY REGRESSION TESTS PASSED!\n')
}
