// Engram 2.1 Continuity & Cross-Agent Engine Automated Test Suite
import assert from 'node:assert'
import {
  getOrCreateProjectContext,
  recordAgentHandoff,
  getLatestHandoff,
  listProjectHandoffs,
  updateProjectContext,
  generateContinuitySnapshot,
  restoreContinuitySnapshot,
  computeSnapshotChecksum,
  formatQuickResumeBrief,
  _resetContinuityTestState,
} from '../api/_lib/continuity.js'
import continuityHandler from '../api/continuity.js'
import mcpHandler from '../api/mcp.js'
import { signSession } from '../api/_lib/token.js'

let totalTests = 0
let passedTests = 0

function test(name, fn) {
  totalTests++
  try {
    fn()
    console.log(`  ✓ PASS: ${name}`)
    passedTests++
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`)
    console.error(err)
    process.exit(1)
  }
}

async function testAsync(name, fn) {
  totalTests++
  try {
    await fn()
    console.log(`  ✓ PASS: ${name}`)
    passedTests++
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`)
    console.error(err)
    process.exit(1)
  }
}

// Mock HTTP helpers
function createMockReq(opts = {}) {
  return {
    method: opts.method || 'GET',
    headers: opts.headers || {},
    query: opts.query || {},
    body: opts.body || {},
  }
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.body = data
      return this
    },
    send(data) {
      this.body = data
      return this
    },
    end() {
      return this
    },
  }
  return res
}

console.log('\n🔄 RUNNING ENGRAM 2.0 CONTINUITY & CROSS-AGENT SUITE')
console.log('==================================================\n')

_resetContinuityTestState()

// [1] Project Context Management & Architecture Tracking
console.log('[1] Project Context Management & Architecture Tracking')

await testAsync('getOrCreateProjectContext creates and caches structured project context', async () => {
  const ctx = await getOrCreateProjectContext({
    projectId: 'proj_alpha_01',
    projectName: 'Alpha Agent Vault',
    userId: 'user_dev_01',
    scope: 'personal',
  })

  assert.strictEqual(ctx.id, 'proj_alpha_01')
  assert.strictEqual(ctx.name, 'Alpha Agent Vault')
  assert.strictEqual(ctx.architecture.storage, 'Walrus Decentralized Memory (Sui)')
  assert.ok(Array.isArray(ctx.architecture.keyDecisions))
  assert.ok(Array.isArray(ctx.preferences))
})

await testAsync('updateProjectContext updates tasks, architecture, and terms cleanly', async () => {
  const updated = await updateProjectContext({
    projectId: 'proj_alpha_01',
    userId: 'user_dev_01',
    architecture: {
      framework: 'Next.js 15 + TypeScript',
      database: 'Supabase PostgreSQL',
    },
    activeTasks: [
      {
        id: 'task_01',
        title: 'Migrate DB to Supabase',
        status: 'completed',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'task_02',
        title: 'Implement Cross-Agent Continuity',
        status: 'in_progress',
        updatedAt: new Date().toISOString(),
      },
    ],
    blockers: ['Awaiting production Walrus key approval'],
    keyTerms: {
      WAL: 'Walrus native protocol token for epoch storage',
    },
  })

  assert.strictEqual(updated.architecture.framework, 'Next.js 15 + TypeScript')
  assert.strictEqual(updated.activeTasks.length, 2)
  assert.strictEqual(updated.blockers[0], 'Awaiting production Walrus key approval')
  assert.strictEqual(updated.keyTerms.WAL, 'Walrus native protocol token for epoch storage')
})

// [2] Cross-Agent Handoff Recording & History
console.log('\n[2] Cross-Agent Handoff Recording & History')

await testAsync('recordAgentHandoff records departing agent notes, task state, and next actions', async () => {
  const handoff = await recordAgentHandoff({
    projectId: 'proj_alpha_01',
    userId: 'user_dev_01',
    fromAgent: 'Claude Code',
    toAgent: 'Cursor IDE',
    taskState: 'Milestone 2 complete, starting Milestone 3',
    handoffNotes: 'Completed intelligence engine. All 10 tests passed. Ready for continuity integration.',
    supportingReferences: ['api/_lib/intelligence.ts', 'api/recall.ts'],
    unresolvedQuestions: ['Should quick-resume default to markdown or JSON?'],
    nextActions: [
      'Expose /api/continuity endpoints',
      'Register engram_handoff MCP tool',
      'Run continuity regression suite',
    ],
  })

  assert.ok(handoff.id.startsWith('handoff_'))
  assert.strictEqual(handoff.fromAgent, 'Claude Code')
  assert.strictEqual(handoff.toAgent, 'Cursor IDE')
  assert.strictEqual(handoff.nextActions.length, 3)
  assert.strictEqual(handoff.unresolvedQuestions.length, 1)

  const latest = await getLatestHandoff('proj_alpha_01')
  assert.strictEqual(latest.id, handoff.id)

  const allHandoffs = await listProjectHandoffs('proj_alpha_01')
  assert.strictEqual(allHandoffs.length, 1)
})

// [3] Verifiable Snapshots & Tamper Detection
console.log('\n[3] Verifiable Snapshots & Tamper Detection')

let generatedSnapshot = null

await testAsync('generateContinuitySnapshot generates schemaVersion 2.0 with sha256 checksum', async () => {
  generatedSnapshot = await generateContinuitySnapshot({
    projectId: 'proj_alpha_01',
    userId: 'user_dev_01',
    scope: 'personal',
    activeMemories: [
      { type: 'decision', text: 'Database hosted on Supabase Postgres' },
      { type: 'config', text: 'WALRUS_EPOCH=24' },
    ],
  })

  assert.strictEqual(generatedSnapshot.schemaVersion, '2.0')
  assert.ok(generatedSnapshot.snapshotId.startsWith('snap_'))
  assert.strictEqual(typeof generatedSnapshot.checksum, 'string')
  assert.strictEqual(generatedSnapshot.checksum.length, 64)
  assert.strictEqual(generatedSnapshot.activeMemoriesCount, 2)
})

await testAsync('restoreContinuitySnapshot verifies authentic snapshot successfully', async () => {
  const result = await restoreContinuitySnapshot({
    snapshotJson: JSON.stringify(generatedSnapshot),
    userId: 'user_dev_01',
  })
  assert.strictEqual(result.verified, true)
  assert.ok(result.snapshot)
  assert.strictEqual(result.snapshot.snapshotId, generatedSnapshot.snapshotId)
})

await testAsync('restoreContinuitySnapshot detects tampered data and rejects restoration', async () => {
  // Tamper with context
  const tampered = JSON.parse(JSON.stringify(generatedSnapshot))
  tampered.context.architecture.database = 'Hacked Insecure DB'

  const result = await restoreContinuitySnapshot({
    snapshotJson: JSON.stringify(tampered),
    userId: 'user_dev_01',
  })
  assert.strictEqual(result.verified, false)
  assert.ok(result.error.includes('Snapshot integrity checksum mismatch'))
})

// [4] Zero-Cold-Start Quick-Resume Brief Formatting
console.log('\n[4] Zero-Cold-Start Quick-Resume Brief Formatting')

test('formatQuickResumeBrief generates structured markdown for new agent sessions', () => {
  const brief = formatQuickResumeBrief(generatedSnapshot)

  assert.ok(brief.includes('# Project Context & Quick-Resume Brief:'))
  assert.ok(brief.includes('Next.js 15 + TypeScript'))
  assert.ok(brief.includes('Claude Code'))
  assert.ok(brief.includes('Cursor IDE'))
  assert.ok(brief.includes('Immediate Next Actions'))
  assert.ok(brief.includes('Expose /api/continuity endpoints'))
  assert.ok(brief.includes('Key Ground-Truth Facts'))
  assert.ok(brief.includes('Database hosted on Supabase Postgres'))
})

// [5] End-to-End REST API (/api/continuity)
console.log('\n[5] End-to-End REST API (/api/continuity)')

const validToken = signSession({ id: 'user_e2e_01', email: 'dev@engram.memory' })

await testAsync('GET /api/continuity fails closed with 401 when unauthenticated', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()
  await continuityHandler(req, res)
  assert.strictEqual(res.statusCode, 401)
  assert.ok(res.body.error.includes('Unauthorized'))
})

await testAsync('POST /api/continuity records handoff with Bearer token', async () => {
  const req = createMockReq({
    method: 'POST',
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      action: 'handoff',
      projectId: 'proj_e2e_test',
      fromAgent: 'Cursor',
      toAgent: 'Claude',
      taskState: 'in_progress',
      handoffNotes: 'E2E REST API handoff recording test',
      nextActions: ['Verify MCP integration'],
    },
  })
  const res = createMockRes()
  await continuityHandler(req, res)

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.body.ok, true)
  assert.ok(res.body.handoff.id.startsWith('handoff_'))
  assert.strictEqual(res.body.handoff.toAgent, 'Claude')
})

await testAsync('GET /api/continuity?action=resume&format=markdown returns markdown brief', async () => {
  const req = createMockReq({
    method: 'GET',
    headers: { authorization: `Bearer ${validToken}` },
    query: {
      projectId: 'proj_e2e_test',
      action: 'resume',
      format: 'markdown',
    },
  })
  const res = createMockRes()
  await continuityHandler(req, res)

  assert.strictEqual(res.statusCode, 200)
  assert.ok(typeof res.body === 'string')
  assert.ok(res.body.includes('Project Context & Quick-Resume Brief'))
  assert.ok(res.body.includes('E2E REST API handoff recording test'))
})

// [6] MCP Protocol Integration (engram_handoff & engram_snapshot)
console.log('\n[6] MCP Protocol Integration (engram_handoff & engram_snapshot)')

await testAsync('MCP tools/list includes engram_handoff and engram_snapshot', async () => {
  const req = createMockReq({
    method: 'POST',
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      jsonrpc: '2.0',
      id: 'mcp_list_01',
      method: 'tools/list',
      params: {},
    },
  })
  const res = createMockRes()
  await mcpHandler(req, res)

  assert.strictEqual(res.statusCode, 200)
  const toolNames = res.body.result.tools.map((t) => t.name)
  assert.ok(toolNames.includes('engram_handoff'), 'tools/list must include engram_handoff')
  assert.ok(toolNames.includes('engram_snapshot'), 'tools/list must include engram_snapshot')
})

await testAsync('MCP engram_handoff tool records handoff and retrieves latest', async () => {
  // Record handoff
  const callReq = createMockReq({
    method: 'POST',
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      jsonrpc: '2.0',
      id: 'mcp_call_01',
      method: 'tools/call',
      params: {
        name: 'engram_handoff',
        arguments: {
          project_id: 'proj_mcp_test',
          from_agent: 'Antigravity IDE',
          to_agent: 'Gemini CLI',
          task_state: 'completed_milestone_3',
          handoff_notes: 'Continuity engine is fully wired across REST and MCP.',
          next_actions: ['Test Python SDK'],
        },
      },
    },
  })
  const callRes = createMockRes()
  await mcpHandler(callReq, callRes)

  assert.strictEqual(callRes.statusCode, 200)
  assert.ok(callRes.body.result.content[0].text.includes('Context handoff recorded'))

  // Retrieve latest handoff
  const getReq = createMockReq({
    method: 'POST',
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      jsonrpc: '2.0',
      id: 'mcp_call_02',
      method: 'tools/call',
      params: {
        name: 'engram_handoff',
        arguments: {
          project_id: 'proj_mcp_test',
          action: 'latest',
        },
      },
    },
  })
  const getRes = createMockRes()
  await mcpHandler(getReq, getRes)

  assert.strictEqual(getRes.statusCode, 200)
  assert.ok(getRes.body.result.content[0].text.includes('Antigravity IDE → To: Gemini CLI'))
  assert.ok(getRes.body.result.content[0].text.includes('Test Python SDK'))
})

await testAsync('MCP engram_snapshot tool outputs verifiable quick-resume brief', async () => {
  const req = createMockReq({
    method: 'POST',
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      jsonrpc: '2.0',
      id: 'mcp_snap_01',
      method: 'tools/call',
      params: {
        name: 'engram_snapshot',
        arguments: {
          project_id: 'proj_mcp_test',
          action: 'brief',
        },
      },
    },
  })
  const res = createMockRes()
  await mcpHandler(req, res)

  assert.strictEqual(res.statusCode, 200)
  const text = res.body.result.content[0].text
  assert.ok(text.includes('# Project Context & Quick-Resume Brief'))
  assert.ok(text.includes('Antigravity IDE'))
})

console.log('\n==================================================')
console.log(`Total tests: ${totalTests} | Passed: ${passedTests} | Failed: 0`)
console.log('🎉 ALL CONTINUITY & CROSS-AGENT TESTS PASSED!\n')
