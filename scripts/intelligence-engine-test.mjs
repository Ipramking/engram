// Automated Intelligent Memory Engine Verification Suite (Milestone 2)
// Tests: 5 Memory Categories, Lifecycle Pipeline, Hybrid Retrieval, Entity Graph, Conflict Resolution
import assert from 'node:assert/strict'
import {
  MEMORY_CATEGORIES,
  mapSubtypeToCategory,
  extractEntities,
  assessImportance,
  assessSensitivity,
  computeJaccardSimilarity,
  evaluateContradiction,
  executeLifecyclePipeline,
  scoreMemoryHybrid,
} from '../api/_lib/intelligence.js'
import { signLiveKey } from '../api/_lib/token.js'
import rememberHandler from '../api/remember.js'
import recallHandler from '../api/recall.js'

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

function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = null, query = {} } = {}) {
  const req = { method, url, headers: { ...headers }, body, query }
  let statusCode = 200
  const responseHeaders = {}
  let sentData = null

  const res = {
    setHeader(name, val) { responseHeaders[name.toLowerCase()] = val; return res },
    status(code) { statusCode = code; return res },
    json(data) { sentData = data; return res },
    send(data) { sentData = data; return res },
    end() { return res },
    getStatusCode: () => statusCode,
    getData: () => sentData,
    getHeaders: () => responseHeaders,
  }
  return { req, res }
}

console.log('\n🧠 RUNNING ENGRAM 2.0 INTELLIGENT MEMORY ENGINE SUITE\n' + '='.repeat(50))

// ── Test Group 1: 5 Memory Categories Taxonomy & Auto-Mapping ──
console.log('\n[1] 5 Memory Categories Taxonomy & Auto-Mapping')

await test('5 Core Categories are defined and distinct', () => {
  assert.equal(MEMORY_CATEGORIES.length, 5)
  assert.deepEqual(
    [...MEMORY_CATEGORIES].sort(),
    ['episodic', 'procedural', 'project', 'relational', 'semantic'].sort()
  )
})

await test('mapSubtypeToCategory maps subtypes to appropriate categories with backward compatibility', () => {
  // Project category
  assert.equal(mapSubtypeToCategory('decision').category, 'project')
  assert.equal(mapSubtypeToCategory('plan').category, 'project')
  assert.equal(mapSubtypeToCategory('milestone').category, 'project')

  // Procedural category
  assert.equal(mapSubtypeToCategory('preference').category, 'procedural')
  assert.equal(mapSubtypeToCategory('gotcha').category, 'procedural')
  assert.equal(mapSubtypeToCategory('workflow').category, 'procedural')

  // Semantic category
  assert.equal(mapSubtypeToCategory('config').category, 'semantic')
  assert.equal(mapSubtypeToCategory('fact').category, 'semantic')

  // Relational category
  assert.equal(mapSubtypeToCategory('person').category, 'relational')
  assert.equal(mapSubtypeToCategory('team_member').category, 'relational')

  // Episodic category
  assert.equal(mapSubtypeToCategory('event').category, 'episodic')
  assert.equal(mapSubtypeToCategory('conversation').category, 'episodic')
})

// ── Test Group 2: Entity Graph Extraction & Attribute Assessment ──
console.log('\n[2] Entity Graph Extraction & Attribute Assessment')

await test('extractEntities detects technology stack and named proper nouns', () => {
  const text = 'Ada deployed the Postgres database to Render using Docker and TypeScript.'
  const entities = extractEntities(text)
  const lowerEntities = entities.map((e) => e.toLowerCase())

  assert.ok(lowerEntities.includes('postgres'), 'Should extract postgres')
  assert.ok(lowerEntities.includes('render'), 'Should extract render')
  assert.ok(lowerEntities.includes('docker'), 'Should extract docker')
  assert.ok(lowerEntities.includes('typescript'), 'Should extract typescript')
  assert.ok(entities.includes('Ada'), 'Should extract proper noun Ada')
})

await test('assessImportance assigns priority based on criticality', () => {
  const critical = assessImportance('decision', 'Security vulnerability detected in token signing!')
  const architectural = assessImportance('decision', 'Moved database to PostgreSQL')
  const casual = assessImportance('note', 'Met someone at the conference')

  assert.equal(critical, 5, 'Security/critical text must have importance 5')
  assert.equal(architectural, 4, 'Architectural decisions must have importance 4')
  assert.ok(casual <= 3, 'Casual notes must have lower importance')
})

// ── Test Group 3: Memory Lifecycle & Conflict Resolution ──
console.log('\n[3] Memory Lifecycle Pipeline & Conflict Resolution')

await test('Lifecycle pipeline classifies and detects duplicate memories', () => {
  const existing = [
    { id: 'mem_1', text: 'All backend APIs are built in TypeScript with Express', type: 'decision' },
  ]

  // Exact/near duplicate
  const dupResult = executeLifecyclePipeline({
    userId: 'usr_test',
    scope: 'personal',
    text: 'All backend APIs are built in TypeScript with Express.',
    type: 'decision',
    existingMemories: existing,
  })
  assert.equal(dupResult.isDuplicate, true)
  assert.equal(dupResult.duplicateOf, 'mem_1')

  // Distinct new fact
  const novelResult = executeLifecyclePipeline({
    userId: 'usr_test',
    scope: 'personal',
    text: 'Use Redis for session caching and rate-limiting.',
    type: 'config',
    existingMemories: existing,
  })
  assert.equal(novelResult.isDuplicate, false)
})

await test('Conflict resolution supersedes outdated preferences and preserves history', () => {
  const existing = [
    { id: 'mem_pref_old', text: 'I prefer Python for backend development', type: 'preference' },
  ]

  // User later updates preference
  const updateResult = executeLifecyclePipeline({
    userId: 'usr_test',
    scope: 'personal',
    text: 'I have moved all backend projects to TypeScript and no longer use Python',
    type: 'preference',
    existingMemories: existing,
  })

  assert.equal(updateResult.supersededMemories.length, 1)
  assert.equal(updateResult.supersededMemories[0].id, 'mem_pref_old')
  assert.match(updateResult.supersededMemories[0].reason, /Domain update on "backend"/i)
})

// ── Test Group 4: Hybrid Retrieval Scoring Engine ──
console.log('\n[4] Hybrid Retrieval Scoring Engine')

await test('scoreMemoryHybrid balances keywords, entity graph links, and importance', () => {
  const memoryA = {
    id: 'm1',
    userId: 'usr_1',
    scope: 'personal',
    category: 'project',
    subtype: 'decision',
    text: 'We chose PostgreSQL on Supabase because of automatic backups and row-level security.',
    entities: ['postgresql', 'supabase'],
    confidence: 1.0,
    importance: 5,
    sensitivity: 'internal',
    status: 'active',
    source: 'explicit_user',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contentHash: 'hash_a',
  }

  const memoryB = {
    id: 'm2',
    userId: 'usr_1',
    scope: 'personal',
    category: 'episodic',
    subtype: 'event',
    text: 'Quick chat with marketing yesterday about banner images.',
    entities: [],
    confidence: 0.8,
    importance: 2,
    sensitivity: 'internal',
    status: 'active',
    source: 'conversation_extraction',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contentHash: 'hash_b',
  }

  const query = 'What database do we use on Supabase?'
  const scoreA = scoreMemoryHybrid(memoryA, query)
  const scoreB = scoreMemoryHybrid(memoryB, query)

  assert.ok(scoreA.score > scoreB.score, 'Database memory must outscore irrelevant marketing chat')
  assert.ok(scoreA.entityMatchScore > 0, 'Entity match score should reflect supabase/postgres overlap')
  assert.ok(scoreA.evidenceExplanation.length > 0, 'Must provide structured evidence explanation')
})

await test('Superseded memories receive rank penalty in active recall', () => {
  const activeMem = {
    id: 'm_active',
    userId: 'usr_1',
    scope: 'personal',
    category: 'semantic',
    subtype: 'config',
    text: 'Active DB host is Neon serverless postgres',
    entities: ['neon', 'postgres'],
    confidence: 1.0,
    importance: 4,
    sensitivity: 'internal',
    status: 'active',
    source: 'explicit_user',
    version: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contentHash: 'h_act',
  }

  const supersededMem = {
    ...activeMem,
    id: 'm_old',
    text: 'Active DB host is Render postgres',
    status: 'superseded',
    version: 1,
  }

  const scoreActive = scoreMemoryHybrid(activeMem, 'What is our DB host?')
  const scoreSuperseded = scoreMemoryHybrid(supersededMem, 'What is our DB host?')

  assert.ok(scoreActive.score > scoreSuperseded.score * 5, 'Active memory must substantially outrank superseded memory')
})

// ── Test Group 5: End-to-End Category Filtering & Uncertainty Acknowledgment ──
console.log('\n[5] Category Filtering & Uncertainty Acknowledgment in api/recall')

await test('api/recall acknowledges uncertainty when no memories match query', async () => {
  const token = signLiveKey({ uid: 'usr_unmatched_query', scope: 'personal' })
  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api/recall',
    headers: { authorization: `Bearer ${token}` },
    body: { query: 'xyzzynonexistentquery123456789' },
  })

  await recallHandler(req, res)
  assert.equal(res.getStatusCode(), 200)
  const data = res.getData()
  assert.equal(data.count, 0)
  assert.equal(data.confidence, 'uncertain')
  assert.match(data.reason, /sufficient evidence/i)
})

await test('api/remember returns enriched 5-category intelligence metadata', async () => {
  const token = signLiveKey({ uid: 'usr_intel_remember', scope: 'personal' })
  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api/remember',
    headers: { authorization: `Bearer ${token}` },
    body: {
      text: 'We standardized on Tailwind CSS and TypeScript for frontend development.',
      type: 'decision',
    },
  })

  await rememberHandler(req, res)
  assert.equal(res.getStatusCode(), 200)
  const data = res.getData()
  assert.equal(data.category, 'project')
  assert.equal(data.subtype, 'decision')
  assert.ok(Array.isArray(data.entities))
  assert.ok(data.entities.map((e) => e.toLowerCase()).includes('typescript'))
  assert.ok(data.importance >= 3)
})

// ── Summary ──
console.log('\n' + '='.repeat(50))
console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
if (failed > 0) {
  process.exit(1)
} else {
  console.log('🎉 ALL INTELLIGENT MEMORY ENGINE TESTS PASSED!\n')
}
