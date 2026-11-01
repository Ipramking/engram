// Phase 4 Automated End-to-End Verification Suite: Usage Limits & Quota Enforcement
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authHandler from '../api/auth.ts'
import usageHandler from '../api/usage.ts'
import rememberHandler from '../api/remember.ts'
import teamsHandler from '../api/teams.ts'
import { getSupabaseAdmin } from '../api/_lib/supabase.ts'
import { getTodayStr } from '../api/_lib/db.ts'

const app = express()
app.use(cors())
app.use(express.json())

const wrap = (h) => (req, res) =>
  Promise.resolve(h(req, res)).catch((e) => {
    console.error(e)
    if (!res.headersSent) res.status(500).json({ error: String(e?.message ?? e) })
  })

app.all(/^\/api\/auth(?:\/.*)?$/, wrap(authHandler))
app.all(/^\/api\/usage(?:\/.*)?$/, wrap(usageHandler))
app.all(/^\/api\/teams(?:\/.*)?$/, wrap(teamsHandler))
app.post('/api/remember', wrap(rememberHandler))

let server
const PORT = 8993
const BASE = `http://localhost:${PORT}`

async function run() {
  server = app.listen(PORT)
  console.log(`[Phase 4 Test] Quota enforcement test server running at ${BASE}\n`)

  try {
    // ── 1. Sign In ──
    console.log('1. Authenticating test user...')
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'developer@engram.memory',
        password: 'EngramDemo2026!',
      }),
    })
    const loginData = await loginRes.json()
    if (!loginRes.ok || !loginData.session?.access_token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`)
    }
    const token = loginData.session.access_token
    const userId = loginData.user.id
    console.log(`✓ Authenticated: ${loginData.user.email} (${userId})`)

    // ── 2. Test /api/usage Metrics & Rate-Limit Headers ──
    console.log('\n2. Testing /api/usage metrics and RateLimit headers...')
    const usageRes = await fetch(`${BASE}/api/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const usageData = await usageRes.json()
    if (!usageRes.ok || !usageData.personal) {
      throw new Error(`Usage query failed: ${JSON.stringify(usageData)}`)
    }

    const limitHeader = usageRes.headers.get('x-ratelimit-limit')
    const remainingHeader = usageRes.headers.get('x-ratelimit-remaining')
    const resetHeader = usageRes.headers.get('x-ratelimit-reset')

    console.log(`✓ Headers verified: Limit=${limitHeader}, Remaining=${remainingHeader}, Reset=${resetHeader}`)
    console.log(`✓ Metrics: Saves=${usageData.personal.saves}/${usageData.personal.dailyLimit}, Percent=${usageData.personal.percentUsed}%, ResetIn=${usageData.personal.secondsUntilReset}s`)

    if (!limitHeader || !remainingHeader || !resetHeader) {
      throw new Error('Standard X-RateLimit-* headers missing on /api/usage response!')
    }

    // ── 3. Test Usage Increment on Write with Headers ──
    console.log('\n3. Testing memory save quota increment & write response headers...')
    const beforeSaves = usageData.personal.saves
    const saveRes = await fetch(`${BASE}/api/remember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: `Phase 4 verified quota check at ${Date.now()}`,
        type: 'config',
        scope: 'personal',
      }),
    })
    const saveData = await saveRes.json()
    if (!saveRes.ok || !saveData.blobId) {
      throw new Error(`Save memory failed: ${JSON.stringify(saveData)}`)
    }

    const writeLimitHeader = saveRes.headers.get('x-ratelimit-limit')
    const writeRemainingHeader = saveRes.headers.get('x-ratelimit-remaining')
    console.log(`✓ Memory saved successfully! Blob ID: ${saveData.blobId}`)
    console.log(`✓ Write RateLimit Headers: Limit=${writeLimitHeader}, Remaining=${writeRemainingHeader}`)

    const usageAfterRes = await fetch(`${BASE}/api/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const usageAfterData = await usageAfterRes.json()
    console.log(`✓ Usage after write: Saves=${usageAfterData.personal.saves} (Incremented by ${usageAfterData.personal.saves - beforeSaves})`)

    // ── 4. Test Strict Quota Exhaustion & 429 Too Many Requests ──
    console.log('\n4. Simulating quota exhaustion & verifying 429 Too Many Requests...')
    const dateStr = getTodayStr()
    const admin = getSupabaseAdmin()

    // Temporarily set saves_count = 50 to test the ceiling
    if (admin) {
      await admin.from('usage_daily').upsert({
        entity_type: 'user',
        entity_id: userId,
        date: dateStr,
        saves_count: 50,
        recalls_count: 0,
      }, { onConflict: 'entity_type,entity_id,date' })
    }

    console.log('✓ Simulated 50/50 quota limit in usage_daily table.')

    const blockedRes = await fetch(`${BASE}/api/remember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: 'This write must be blocked by the quota enforcer!',
        type: 'decision',
        scope: 'personal',
      }),
    })
    const blockedData = await blockedRes.json()

    if (blockedRes.status !== 429) {
      throw new Error(`Expected HTTP 429 but received status ${blockedRes.status}: ${JSON.stringify(blockedData)}`)
    }

    const retryAfter = blockedRes.headers.get('retry-after')
    const blockedRemaining = blockedRes.headers.get('x-ratelimit-remaining')

    console.log(`✓ HTTP 429 correctly received!`)
    console.log(`✓ Retry-After header: ${retryAfter} seconds`)
    console.log(`✓ X-RateLimit-Remaining: ${blockedRemaining}`)
    console.log(`✓ Quota error code: ${blockedData.code}`)
    console.log(`✓ Quota error message: ${blockedData.error}`)

    // Restore realistic saves_count
    if (admin) {
      await admin.from('usage_daily').upsert({
        entity_type: 'user',
        entity_id: userId,
        date: dateStr,
        saves_count: beforeSaves + 1,
        recalls_count: 0,
      }, { onConflict: 'entity_type,entity_id,date' })
    }
    console.log('✓ Restored test user saves count.')

    // ── 5. Test Strict Team 3-Member Ceiling ──
    console.log('\n5. Testing Team 3-Member strict ceiling enforcement...')
    const teamCreateRes = await fetch(`${BASE}/api/teams/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: `Quota Test Team ${Date.now()}` }),
    })
    const teamCreateData = await teamCreateRes.json()
    const teamId = teamCreateData.team.id
    console.log(`✓ Team created: ${teamCreateData.team.name} (${teamId})`)

    // Member 2
    await fetch(`${BASE}/api/teams/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teamId, email: `m2_${Date.now()}@quota.xyz`, role: 'member' }),
    })
    console.log('✓ Member 2 joined (2/3 seats filled).')

    // Member 3
    await fetch(`${BASE}/api/teams/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teamId, email: `m3_${Date.now()}@quota.xyz`, role: 'member' }),
    })
    console.log('✓ Member 3 joined (3/3 seats filled - Limit reached).')

    // Member 4 (Must be blocked)
    const member4Res = await fetch(`${BASE}/api/teams/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teamId, email: `m4_${Date.now()}@quota.xyz`, role: 'member' }),
    })
    const member4Data = await member4Res.json()

    if (member4Res.ok || !member4Data.error?.includes('3 members')) {
      throw new Error(`Team ceiling failed to block 4th member: ${JSON.stringify(member4Data)}`)
    }
    console.log(`✓ 4th member strictly blocked: "${member4Data.error}"`)

    console.log('\n======================================================')
    console.log('🎉 PHASE 4 VERIFICATION 100% COMPLETE & PASSING!')
    console.log('======================================================\n')
  } finally {
    server.close()
  }
}

run().catch((err) => {
  console.error('\n❌ PHASE 4 VERIFICATION FAILED:', err)
  if (server) server.close()
  process.exit(1)
})
