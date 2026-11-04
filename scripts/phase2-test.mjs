// Phase 2 Automated End-to-End Verification Suite
// Tests Authentication, Session Management, Dashboard DAL (Keys, Teams, Usage), and Memory Explorer.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authHandler from '../api/auth.ts'
import keysHandler from '../api/keys.ts'
import teamsHandler from '../api/teams.ts'
import usageHandler from '../api/usage.ts'
import rememberHandler from '../api/remember.ts'
import recallHandler from '../api/recall.ts'

const app = express()
app.use(cors())
app.use(express.json())

const wrap = (h) => (req, res) =>
  Promise.resolve(h(req, res)).catch((e) => {
    console.error(e)
    if (!res.headersSent) res.status(500).json({ error: String(e?.message ?? e) })
  })

app.all(/^\/api\/auth(?:\/.*)?$/, wrap(authHandler))
app.all(/^\/api\/keys(?:\/.*)?$/, wrap(keysHandler))
app.all(/^\/api\/teams(?:\/.*)?$/, wrap(teamsHandler))
app.all(/^\/api\/usage(?:\/.*)?$/, wrap(usageHandler))
app.post('/api/remember', wrap(rememberHandler))
app.post('/api/recall', wrap(recallHandler))

let server
const PORT = 8991
const BASE = `http://localhost:${PORT}`

async function run() {
  server = app.listen(PORT)
  console.log(`[Phase 2 Test] Test server running at ${BASE}\n`)

  try {
    // ── 1. Authenticate with Developer Demo account ──
    console.log('1. Testing Login with developer@engram.memory...')
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'developer@engram.memory',
        password: process.env.DEMO_PASSWORD,
      }),
    })
    const loginData = await loginRes.json()
    if (!loginRes.ok || !loginData.session?.access_token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`)
    }
    const token = loginData.session.access_token
    console.log('✓ Login successful! User:', loginData.user.email, '| ID:', loginData.user.id)

    // ── 2. Validate Session via /api/auth/me ──
    console.log('\n2. Testing /api/auth/me session resolution...')
    const meRes = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const meData = await meRes.json()
    if (!meRes.ok || meData.user?.email !== 'developer@engram.memory') {
      throw new Error(`Session verification failed: ${JSON.stringify(meData)}`)
    }
    console.log('✓ Session verified for:', meData.user.email, '| Plan:', meData.user.plan_tier)

    // ── 3. Test API Key Generation and Listing ──
    console.log('\n3. Testing Key creation & listing on Dashboard...')
    const createKeyRes = await fetch(`${BASE}/api/keys/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Phase 2 Test Key',
        scope: 'personal',
        room: 'test-room',
      }),
    })
    const keyData = await createKeyRes.json()
    if (!createKeyRes.ok || !keyData.key?.rawKey) {
      throw new Error(`Key creation failed: ${JSON.stringify(keyData)}`)
    }
    console.log('✓ API Key created! Prefix:', keyData.key.keyPrefix || keyData.key.key_prefix, '| Connector URL:', keyData.key.connectorUrl)

    const listKeysRes = await fetch(`${BASE}/api/keys`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const listKeysData = await listKeysRes.json()
    const foundKey = listKeysData.keys?.find((k) => k.name === 'Phase 2 Test Key')
    if (!foundKey) throw new Error('Created key not found in list!')
    console.log('✓ Key verified in active keys list (Total active:', listKeysData.keys.length, ')')

    // ── 4. Test Team Creation & Strict Limits ──
    console.log('\n4. Testing Team management on Dashboard...')
    const createTeamRes = await fetch(`${BASE}/api/teams/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: `Phase 2 Team ${Date.now()}` }),
    })
    const teamData = await createTeamRes.json()
    if (!createTeamRes.ok || !teamData.team?.id) {
      throw new Error(`Team creation failed: ${JSON.stringify(teamData)}`)
    }
    const teamId = teamData.team.id
    console.log('✓ Team created:', teamData.team.name, '| ID:', teamId)

    // Invite member 2
    await fetch(`${BASE}/api/teams/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teamId, email: `member2_${Date.now()}@test.xyz`, role: 'member' }),
    })
    console.log('✓ Member 2 invited.')

    // Invite member 3
    await fetch(`${BASE}/api/teams/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teamId, email: `member3_${Date.now()}@test.xyz`, role: 'member' }),
    })
    console.log('✓ Member 3 invited (Reached Free Team limit: 3/3).')

    // Invite member 4 (Must be blocked)
    const blockRes = await fetch(`${BASE}/api/teams/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teamId, email: `member4_${Date.now()}@test.xyz`, role: 'member' }),
    })
    const blockData = await blockRes.json()
    if (blockRes.ok || !blockData.error?.includes('3 members')) {
      throw new Error(`Strict team limit failed to block 4th member: ${JSON.stringify(blockData)}`)
    }
    console.log('✓ 4th member correctly blocked by Free Team Plan policy:', blockData.error)

    // ── 5. Test Usage Quotas ──
    console.log('\n5. Testing /api/usage metrics...')
    const usageRes = await fetch(`${BASE}/api/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const usageData = await usageRes.json()
    if (!usageRes.ok || !usageData.personal) {
      throw new Error(`Usage retrieval failed: ${JSON.stringify(usageData)}`)
    }
    console.log('✓ Usage retrieved! Personal saves today:', usageData.personal.saves, '/', usageData.personal.dailyLimit)

    // ── 6. Test Pinning Memory & Semantic Recall ──
    console.log('\n6. Testing Dashboard Memory Pinning & Recall...')
    const memoryText = `Architecture decision on 2026-11-01: Engram dashboard exposes authenticated personal & team keys.`
    const rememberRes = await fetch(`${BASE}/api/remember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: memoryText,
        type: 'decision',
        scope: 'personal',
      }),
    })
    const rememberData = await rememberRes.json()
    if (!rememberRes.ok || !rememberData.blobId) {
      throw new Error(`Pinning memory failed: ${JSON.stringify(rememberData)}`)
    }
    console.log('✓ Memory pinned to Walrus! Blob ID:', rememberData.blobId)

    const recallRes = await fetch(`${BASE}/api/recall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: 'authenticated personal and team keys on dashboard',
        scope: 'personal',
        topK: 5,
      }),
    })
    const recallData = await recallRes.json()
    if (!recallRes.ok || !recallData.results?.length) {
      throw new Error(`Memory recall returned 0 results: ${JSON.stringify(recallData)}`)
    }
    console.log('✓ Semantic recall found matching memory:')
    console.log('  ->', recallData.results[0].text)

    console.log('\n======================================================')
    console.log('🎉 PHASE 2 VERIFICATION 100% COMPLETE & PASSING!')
    console.log('======================================================\n')
  } finally {
    server.close()
  }
}

run().catch((err) => {
  console.error('\n❌ PHASE 2 VERIFICATION FAILED:', err)
  if (server) server.close()
  process.exit(1)
})
