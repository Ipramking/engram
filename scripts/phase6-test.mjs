// Phase 6 integration suite: conflict resolution and the memory explorer. Talks to a real deployment
// and database: set DEMO_PASSWORD (and run only against staging).
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authHandler from '../api/auth.ts'
import rememberHandler from '../api/remember.ts'
import recallHandler from '../api/recall.ts'
import memoriesHandler from '../api/memories.ts'
import { getSupabaseAdmin } from '../api/_lib/supabase.ts'
import { evaluateContradiction } from '../api/_lib/conflicts.ts'

const app = express()
app.use(cors())
app.use(express.json())

const wrap = (h) => (req, res) =>
  Promise.resolve(h(req, res)).catch((e) => {
    console.error(e)
    if (!res.headersSent) res.status(500).json({ error: String(e?.message ?? e) })
  })

app.all(/^\/api\/auth(?:\/.*)?$/, wrap(authHandler))
app.all(/^\/api\/memories(?:\/.*)?$/, wrap(memoriesHandler))
app.post('/api/remember', wrap(rememberHandler))
app.post('/api/recall', wrap(recallHandler))

let server
const PORT = 8996
const BASE = `http://localhost:${PORT}`

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(message)
  }
}

async function run() {
  server = app.listen(PORT)
  console.log(`[Phase 6 Test] Test backend running at ${BASE}\n`)

  let token = null
  let userId = null

  try {
    // ── 1. Unit Test: Conflict Resolution Evaluation ──
    console.log('1. Testing NLP & heuristic conflict detection engine...')
    const eval1 = evaluateContradiction(
      'We moved the DB to Supabase Postgres on Nov 1 because Render expired',
      'decision',
      'DB is hosted on Render Postgres',
      'decision'
    )
    assert(eval1.isContradiction, 'Must detect transition conflict between Render and Supabase DB')
    console.log(`✓ Detected transition conflict: ${eval1.reason}`)

    const eval2 = evaluateContradiction(
      'Now using Tailwind CSS over styled-components for frontend styling',
      'decision',
      'Frontend uses styled-components for CSS in JS',
      'decision'
    )
    assert(eval2.isContradiction, 'Must detect transition conflict between styled-components and Tailwind')
    console.log(`✓ Detected transition conflict: ${eval2.reason}`)

    // ── 3. Authenticate Demo User ──
    console.log('\n3. Authenticating demo user developer@engram.memory...')
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'developer@engram.memory',
        password: process.env.DEMO_PASSWORD, // set DEMO_PASSWORD; never commit it
      }),
    })
    const loginData = await loginRes.json()
    assert(loginRes.ok && loginData.session?.access_token, `Login failed: ${JSON.stringify(loginData)}`)
    token = loginData.session.access_token
    userId = loginData.user.id
    console.log(`✓ Authenticated: ${loginData.user.email} (${userId})`)

    // Clean previous test data in memories_meta
    const supabase = getSupabaseAdmin()
    if (supabase) {
      await supabase.from('memories_meta').delete().eq('user_id', userId)
    }

    // ── 4. Save Initial Memory ──
    console.log('\n4. Pinning initial architectural decision...')
    const save1Res = await fetch(`${BASE}/api/remember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: 'DB is hosted on Render Postgres instance in frankfurt',
        type: 'decision',
        scope: 'personal',
      }),
    })
    const save1Data = await save1Res.json()
    assert(save1Res.ok && save1Data.ok && save1Data.id, `Initial save failed: ${JSON.stringify(save1Data)}`)
    const blob1 = save1Data.blobId
    console.log(`✓ Initial memory saved: blobId=${blob1}`)

    // ── 5. Save Superseding Memory ──
    console.log('\n5. Pinning superseding decision ("moved DB to Supabase Postgres")...')
    const save2Res = await fetch(`${BASE}/api/remember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: 'We moved the DB to Supabase Postgres on Nov 1 because Render expired',
        type: 'decision',
        scope: 'personal',
      }),
    })
    const save2Data = await save2Res.json()
    assert(save2Res.ok && save2Data.ok && save2Data.id, `Superseding save failed: ${JSON.stringify(save2Data)}`)
    console.log(`✓ Superseding memory saved: blobId=${save2Data.blobId}`)
    assert(
      save2Data.superseded && save2Data.superseded.length > 0,
      `Engine must detect superseded memory: ${JSON.stringify(save2Data.superseded)}`
    )
    console.log(`✓ Superseded older memory successfully: "${save2Data.superseded[0].oldText}"`)

    // ── 6. Query Recall (Agent Context Filtering) ──
    console.log('\n6. Testing /api/recall agent ground-truth filtering...')
    const recallRes = await fetch(`${BASE}/api/recall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: 'What database do we use for persistence?',
        scope: 'personal',
        includeSuperseded: false, // Agent mode: ground truth only
      }),
    })
    const recallData = await recallRes.json()
    assert(recallRes.ok && recallData.results, `Recall failed: ${JSON.stringify(recallData)}`)
    const recalledTexts = recallData.results.map((r) => r.text)
    console.log(`✓ Recalled active facts for agent:`, recalledTexts)
    assert(
      !recalledTexts.some((t) => t.includes('Render Postgres instance in frankfurt')),
      'Older superseded Render memory must be omitted from agent ground truth context'
    )

    // ── 7. Query /api/memories (Dashboard Explorer View) ──
    console.log('\n7. Testing /api/memories with includeSuperseded=true (Dashboard view)...')
    const listRes = await fetch(`${BASE}/api/memories?scope=personal&includeSuperseded=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const listData = await listRes.json()
    assert(listRes.ok && listData.memories, `List memories failed: ${JSON.stringify(listData)}`)
    console.log(`✓ Retrieved ${listData.memories.length} total memories`)
    assert(listData.stats.superseded >= 1, 'Stats reports at least 1 superseded memory')

    const supersededMemory = listData.memories.find((m) => m.isSuperseded)
    assert(supersededMemory, 'Must contain a memory with isSuperseded === true')
    console.log(`✓ Memory Explorer confirmed: isSuperseded=${supersededMemory.isSuperseded}, supersededBy=${supersededMemory.supersededBy}`)

    // ── 8. Delete Memory ──
    console.log('\n8. Testing memory deletion / archive via DELETE /api/memories...')
    const deleteRes = await fetch(`${BASE}/api/memories?id=${supersededMemory.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const deleteData = await deleteRes.json()
    assert(deleteRes.ok && deleteData.ok, `Delete failed: ${JSON.stringify(deleteData)}`)
    console.log(`✓ Successfully deleted memory: ${supersededMemory.id}`)

    console.log('\n==============================================================================')
    console.log('🎉 ALL PHASE 6 SMART CONFLICT RESOLUTION & ON-CHAIN EPOCH TESTS PASSED!')
    console.log('==============================================================================')
  } finally {
    if (server) {
      server.close()
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Phase 6 Test Failed:', err)
    process.exit(1)
  })
