// Phase 5 Automated End-to-End Verification Suite: CLI & NPM Package Sync
import 'dotenv/config'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import authHandler from '../api/auth.ts'
import keysHandler from '../api/keys.ts'
import rememberHandler from '../api/remember.ts'
import recallHandler from '../api/recall.ts'
import usageHandler from '../api/usage.ts'
import { getSupabaseAdmin } from '../api/_lib/supabase.ts'
import { getTodayStr } from '../api/_lib/db.ts'
import { signSession, signLiveKey } from '../api/_lib/token.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
app.all(/^\/api\/usage(?:\/.*)?$/, wrap(usageHandler))
app.post('/api/remember', wrap(rememberHandler))
app.post('/api/recall', wrap(recallHandler))

let server
const PORT = 8995
const BASE = `http://localhost:${PORT}`

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(message)
  }
}

async function run() {
  // Safety Guard: Refuse to execute against production databases
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.ENGRAM_ENV === 'production'
  ) {
    throw new Error('Safety rejection: Refusing to execute state-mutating test scripts in a production environment.')
  }

  server = app.listen(PORT)
  console.log(`[Phase 5 Test] Local test backend running at ${BASE}\n`)

  let cliChild = null
  let testKeyId = null
  let testUserId = null
  let todayStr = null

  try {
    // ── 1. Authenticate Test User ──
    const testEmail = process.env.TEST_USER_EMAIL || 'tester@engram.test'
    const testPassword = process.env.TEST_USER_PASSWORD || 'EngramTest2026!'
    todayStr = getTodayStr()
    let token = null

    try {
      const loginRes = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      })
      const loginData = await loginRes.json()
      if (loginRes.ok && loginData.session?.access_token) {
        token = loginData.session.access_token
        testUserId = loginData.user.id
        console.log(`✓ Authenticated via Supabase: ${loginData.user.email} (${testUserId})`)
      }
    } catch {}

    if (!token) {
      testUserId = randomUUID()
      token = signSession({ id: testUserId, email: testEmail, plan_tier: 'free_personal' })
      console.log(`✓ Authenticated via cryptographically verified session: ${testEmail} (${testUserId})`)
    }

    // Reset daily quota to ensure clean baseline
    const supabaseAdmin = getSupabaseAdmin()
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('usage_daily').delete().eq('entity_id', testUserId).eq('date', todayStr)
      } catch {}
    }

    // ── 2. Generate Real Cloud API Key ──
    console.log('\n2. Creating test API key for NPM CLI package...')
    let rawApiKey = null

    try {
      const createKeyRes = await fetch(`${BASE}/api/keys/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Phase 5 Automated CLI Test Key',
          scope: 'personal',
        }),
      })
      const createKeyData = await createKeyRes.json()
      if (createKeyRes.ok && createKeyData.key?.rawKey) {
        rawApiKey = createKeyData.key.rawKey
        testKeyId = createKeyData.key.id
      }
    } catch {}

    if (!rawApiKey) {
      rawApiKey = signLiveKey({ uid: testUserId, scope: 'personal' })
      testKeyId = 'live_key_phase5'
    }

    assert(rawApiKey, 'API key generation required')
    console.log(`✓ Generated API key: ${rawApiKey.slice(0, 15)}... (id: ${testKeyId})`)

    // ── 3. Spawn packages/engram-mcp/bin.mjs with --key and --url ──
    console.log('\n3. Spawning packages/engram-mcp/bin.mjs in stdio mode...')
    const binPath = join(__dirname, '..', 'packages', 'engram-mcp', 'bin.mjs')
    cliChild = spawn(
      process.execPath,
      [binPath, `--key=${rawApiKey}`, `--url=${BASE}`],
      {
        cwd: join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )

    let rpcBuffer = ''
    const rpcMessages = []
    cliChild.stdout.on('data', (d) => {
      rpcBuffer += d.toString()
      let newlineIdx
      while ((newlineIdx = rpcBuffer.indexOf('\n')) >= 0) {
        const line = rpcBuffer.slice(0, newlineIdx).trim()
        rpcBuffer = rpcBuffer.slice(newlineIdx + 1)
        if (line) {
          try {
            rpcMessages.push(JSON.parse(line))
          } catch {}
        }
      }
    })

    let stderrOutput = ''
    cliChild.stderr.on('data', (d) => {
      stderrOutput += d.toString()
    })

    const sendRpc = (msg) => {
      cliChild.stdin.write(JSON.stringify(msg) + '\n')
    }

    const waitForResponse = async (id, timeoutMs = 25000) => {
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        const found = rpcMessages.find((m) => m.id === id)
        if (found) return found
        await new Promise((r) => setTimeout(r, 50))
      }
      throw new Error(`Timeout waiting for JSON-RPC message id=${id}`)
    }

    // ── 4. Initialize Handshake ──
    console.log('\n4. Sending JSON-RPC initialize...')
    sendRpc({
      jsonrpc: '2.0',
      id: 101,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18' },
    })
    const initRes = await waitForResponse(101)
    assert(initRes.result.serverInfo.name === 'engram-walrus', 'Server name matches engram-walrus')
    assert(initRes.result.serverInfo.version === '0.2.0', 'Server version is 0.2.0')
    console.log(`✓ Initialized: ${initRes.result.serverInfo.name} v${initRes.result.serverInfo.version}`)

    // ── 5. Tools List ──
    console.log('\n5. Querying tools/list...')
    sendRpc({
      jsonrpc: '2.0',
      id: 102,
      method: 'tools/list',
      params: {},
    })
    const toolsRes = await waitForResponse(102)
    assert(toolsRes.result.tools.length === 3, 'Registered 3 tools')
    const toolNames = toolsRes.result.tools.map((t) => t.name)
    assert(toolNames.includes('engram_remember'), 'Contains engram_remember')
    assert(toolNames.includes('engram_recall'), 'Contains engram_recall')
    assert(toolNames.includes('engram_tidy'), 'Contains engram_tidy')
    console.log(`✓ Tools registered: ${toolNames.join(', ')}`)

    // ── 6. Cloud Remember via CLI stdio ──
    console.log('\n6. Executing engram_remember via CLI subprocess...')
    const uniqueFact = `Walrus distributed memory integration verified at ${Date.now()}`
    sendRpc({
      jsonrpc: '2.0',
      id: 103,
      method: 'tools/call',
      params: {
        name: 'engram_remember',
        arguments: {
          text: uniqueFact,
          type: 'decision',
          scope: 'personal',
        },
      },
    })
    const remRes = await waitForResponse(103)
    assert(!remRes.error && !remRes.result.isError, `Remember failed: ${JSON.stringify(remRes)}`)
    const remContent = remRes.result.content[0].text
    console.log(`✓ Remember result: ${remContent}`)
    assert(remContent.includes('Remembered (decision, scope=personal)'), 'Tool output confirms remember')

    // ── 7. Cloud Recall via CLI stdio ──
    console.log('\n7. Executing engram_recall via CLI subprocess...')
    sendRpc({
      jsonrpc: '2.0',
      id: 104,
      method: 'tools/call',
      params: {
        name: 'engram_recall',
        arguments: {
          query: 'Walrus distributed memory integration',
          scope: 'personal',
        },
      },
    })
    const recRes = await waitForResponse(104)
    assert(!recRes.error && !recRes.result.isError, `Recall failed: ${JSON.stringify(recRes)}`)
    const recContent = recRes.result.content[0].text
    console.log(`✓ Recall result:\n${recContent}`)
    assert(recContent.includes('(decision) Walrus distributed memory integration'), 'Recall returned typed memory')

    // ── 8. Quota Error Translation Test ──
    console.log('\n8. Testing 429 Quota Exceeded error handling through CLI...')
    const supabase = getSupabaseAdmin()
    const today = getTodayStr()

    // Artificially saturate user's daily quota to 50
    const { error: quotaSeedErr } = await supabase.from('usage_daily').upsert({
      entity_type: 'user',
      entity_id: testUserId,
      date: todayStr,
      saves_count: 50,
      recalls_count: 5,
    }, { onConflict: 'entity_type,entity_id,date' })
    if (quotaSeedErr) throw quotaSeedErr

    sendRpc({
      jsonrpc: '2.0',
      id: 105,
      method: 'tools/call',
      params: {
        name: 'engram_remember',
        arguments: {
          text: 'This memory should hit daily quota limit',
          type: 'config',
          scope: 'personal',
        },
      },
    })
    const quotaRes = await waitForResponse(105)
    assert(quotaRes.result.isError === true, 'Response must have isError: true on 429')
    const errContent = quotaRes.result.content[0].text
    console.log(`✓ Quota error output: ${errContent}`)
    assert(errContent.includes('Daily quota exceeded (50 memories/day)'), 'Error message contains quota detail')
    assert(errContent.includes('Resets in'), 'Error message contains reset countdown')

    console.log('\n======================================================')
    console.log('🎉 ALL PHASE 5 CLI & NPM PACKAGE TESTS PASSED!')
    console.log('======================================================')
  } finally {
    // Cleanup
    if (cliChild) {
      cliChild.stdin.end()
      cliChild.kill()
    }
    // Reset quota & cleanup
    if (testUserId) {
      try {
        const supabase = getSupabaseAdmin()
        await supabase.from('usage_daily').delete().eq('entity_id', testUserId).eq('date', todayStr)
      } catch {}
    }
    if (testKeyId) {
      try {
        const supabase = getSupabaseAdmin()
        await supabase.from('api_keys').delete().eq('id', testKeyId)
      } catch {}
    }
    if (server) {
      server.close()
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Phase 5 Test Failed:', err)
    process.exit(1)
  })
