// Automated test suite for engram-walrus package (v0.3.0)
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  createEngram,
  cloudBackend,
  mockBackend,
  enc,
  dec,
  TYPES,
} from './core.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    process.exit(1)
  }
}

async function runTests() {
  console.log('🧪 Starting engram-walrus unit & integration tests...')

  // Test 1: Encoder / Decoder
  console.log('  [1/5] Testing enc() & dec() utilities...')
  assert(TYPES.includes('decision'), 'TYPES must include decision')
  assert(TYPES.includes('plan'), 'TYPES must include plan')
  const encoded = enc('config', 'DATABASE_URL is postgres://...')
  assert(encoded === '[config] DATABASE_URL is postgres://...', 'enc() formatted correctly')
  const decoded = dec(encoded)
  assert(decoded.type === 'config', 'dec() recovered correct type')
  assert(decoded.text === 'DATABASE_URL is postgres://...', 'dec() recovered correct clean text')

  // Test 2: In-Memory createEngram() flow
  console.log('  [2/5] Testing createEngram() in-memory mock backend...')
  const engram = createEngram({ forceMock: true })
  assert(engram.TOOLS.length === 3, 'Must register 3 tools')
  assert(engram.backend.kind === 'mock', 'Backend must be mock')

  const remRes = await engram.handleTool('engram_remember', {
    text: 'Use Supabase PostgreSQL for persistent metadata',
    type: 'decision',
    scope: 'personal',
  })
  assert(remRes.includes('Remembered (decision, scope=personal)'), 'Remember personal success')

  const recRes = await engram.handleTool('engram_recall', {
    query: 'What database do we use for metadata?',
    scope: 'personal',
  })
  assert(recRes.includes('(decision) Use Supabase PostgreSQL'), 'Recall personal retrieved correct fact')

  // Isolation check: Team memory should be isolated
  const remTeamRes = await engram.handleTool('engram_remember', {
    text: 'Weekly sync every Thursday at 3pm UTC',
    type: 'person',
    scope: 'team',
    team_code: 'sui-core',
  })
  assert(remTeamRes.includes('Remembered (person, scope=team)'), 'Remember team success')

  const recTeamRes = await engram.handleTool('engram_recall', {
    query: 'When is sync?',
    scope: 'team',
    team_code: 'sui-core',
  })
  assert(recTeamRes.includes('(person) Weekly sync'), 'Team recall succeeded')

  // Check tidy
  const tidyRes = await engram.handleTool('engram_tidy', { scope: 'personal' })
  assert(tidyRes.includes('Scope holds 1 memories (1 decision)'), 'Tidy reported memory breakdown')

  // Test 3: CloudBackend HTTP Handling (Quota & Errors)
  console.log('  [3/5] Testing cloudBackend() HTTP responses & quota error formatting...')
  const originalFetch = globalThis.fetch

  // Simulate 429 Rate Limit
  globalThis.fetch = async (url, options) => {
    return {
      ok: false,
      status: 429,
      json: async () => ({
        error: 'Daily quota exceeded. Free tier allows 50 memories per day.',
        code: 'DAILY_QUOTA_EXCEEDED',
        limit: 50,
        secondsUntilReset: 1800,
      }),
    }
  }

  const cloud = cloudBackend({ apiKey: 'eng_usr_test123', hostUrl: 'https://test-engram.com' })
  let caught429 = false
  try {
    await cloud.remember('me', '[decision] Test memory')
  } catch (err) {
    caught429 = true
    assert(err.message.includes('Daily quota exceeded (50 memories/day)'), '429 message includes limit')
    assert(err.message.includes('Resets in 30 minutes'), '429 message includes countdown')
  }
  assert(caught429, 'cloud.remember properly caught and translated 429 quota error')

  // Simulate 200 Remember & Recall
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/api/remember')) {
      const body = JSON.parse(options.body)
      assert(body.text === 'Clean test memory', 'Text sent to cloud backend is clean/unprefixed')
      assert(body.type === 'decision', 'Type sent to cloud backend')
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, blobId: 'blob_test_abc123' }),
      }
    }
    if (url.endsWith('/api/recall')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          results: [{ type: 'decision', text: 'Clean test memory', blobId: 'blob_test_abc123' }],
        }),
      }
    }
    throw new Error('Unexpected URL: ' + url)
  }

  const cloudBlob = await cloud.remember('me', '[decision] Clean test memory')
  assert(cloudBlob === 'blob_test_abc123', 'Cloud remember returned blobId')

  const cloudResults = await cloud.recall('me', 'test memory')
  assert(cloudResults.length === 1, 'Cloud recall returned 1 result')
  assert(cloudResults[0].type === 'decision', 'Cloud recall preserved type')
  assert(cloudResults[0].text === 'Clean test memory', 'Cloud recall preserved clean text')

  // Restore fetch
  globalThis.fetch = originalFetch

  // Test 4: CLI binary stdio JSON-RPC protocol
  console.log('  [4/5] Testing bin.mjs stdio JSON-RPC server...')
  const binPath = join(__dirname, 'bin.mjs')
  const child = spawn(process.execPath, [binPath, '--mock'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let rpcBuffer = ''
  const responses = []
  child.stdout.on('data', (d) => {
    rpcBuffer += d.toString()
    let newlineIdx
    while ((newlineIdx = rpcBuffer.indexOf('\n')) >= 0) {
      const line = rpcBuffer.slice(0, newlineIdx).trim()
      rpcBuffer = rpcBuffer.slice(newlineIdx + 1)
      if (line) {
        try { responses.push(JSON.parse(line)) } catch {}
      }
    }
  })

  const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n')

  // Handshake: initialize
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  // ping
  send({ jsonrpc: '2.0', id: 2, method: 'ping', params: {} })
  // tools/list
  send({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} })
  // tools/call engram_remember
  send({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'engram_remember',
      arguments: { text: 'Stdio RPC verified', type: 'config', scope: 'personal' },
    },
  })
  // tools/call engram_recall
  send({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'engram_recall',
      arguments: { query: 'Stdio RPC', scope: 'personal' },
    },
  })

  // Give 1 second for processing then close stdin
  await new Promise((r) => setTimeout(r, 1000))
  child.stdin.end()

  await new Promise((resolve) => child.on('exit', resolve))

  const initResp = responses.find((r) => r.id === 1)
  assert(initResp, 'Received initialize response')
  assert(initResp.result.serverInfo.name === 'engram-walrus', 'Server name matches engram-walrus')
  assert(initResp.result.serverInfo.version === '0.3.0', 'Server version is 0.3.0')

  const toolsListResp = responses.find((r) => r.id === 3)
  assert(toolsListResp && toolsListResp.result.tools.length === 3, 'Received 3 tools via stdio')

  const recallResp = responses.find((r) => r.id === 5)
  assert(recallResp && recallResp.result.content[0].text.includes('(config) Stdio RPC verified'), 'Stdio tool call roundtrip successful')

  // Test 5: CLI Help Flag
  console.log('  [5/5] Testing bin.mjs --help...')
  const helpChild = spawn(process.execPath, [binPath, '--help'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let helpStderr = ''
  helpChild.stderr.on('data', (d) => { helpStderr += d.toString() })
  const helpExitCode = await new Promise((resolve) => helpChild.on('exit', resolve))
  assert(helpExitCode === 0, '--help exited with 0')
  assert(helpStderr.includes('Engram Walrus MCP Server v0.3.0'), '--help prints v0.3.0')
  assert(helpStderr.includes('--key=<eng_...>'), '--help documents --key flag')
  assert(helpStderr.includes('--mock'), '--help documents --mock flag')

  console.log('✅ ALL engram-walrus PACKAGE TESTS PASSED!')
}

runTests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
