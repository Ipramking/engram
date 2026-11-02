// Automated Storage Reliability & Integrity Verification Suite (Milestone 1)
// Tests: REL-01, REL-02, REL-03, REL-04, REL-05
import assert from 'node:assert/strict'
import {
  computeContentHash,
  computeIdempotencyKey,
  verifyMemoryIntegrity,
  writeMemoryWithRetry,
  processRecoveryQueue,
  getRecoveryQueueStats,
  formatRetentionContract,
  _resetStorageTestState,
} from '../api/_lib/storage.js'
import { signLiveKey } from '../api/_lib/token.js'
import rememberHandler from '../api/remember.js'
import recallHandler from '../api/recall.js'
import memoriesHandler from '../api/memories.ts'

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

console.log('\n💾 RUNNING ENGRAM 2.0 STORAGE RELIABILITY SUITE\n' + '='.repeat(50))

// ── Test Group 1: REL-01 Explicit Persistence States Contract ──
console.log('\n[1] REL-01: Explicit Persistence State Contracts')

await test('Successful mock write returns local_mock or confirmed_durable with blobId', async () => {
  _resetStorageTestState()
  const mockClient = {
    async rememberAndWait() { return { blob_id: 'blob_mock_durable_123' } },
    async remember() { return { blob_id: 'blob_mock_durable_123' } },
  }

  const res = await writeMemoryWithRetry({
    mem: mockClient,
    encodedText: '[decision] Use TypeScript for all backend services',
    type: 'decision',
    cleanText: 'Use TypeScript for all backend services',
    userId: 'usr_rel_1',
    scope: 'personal',
  })

  assert.ok(['confirmed_durable', 'local_mock'].includes(res.storageState), 'Must be durable or local_mock')
  assert.equal(res.blobId, 'blob_mock_durable_123')
  assert.ok(res.contentHash && res.contentHash.length === 64)
  assert.ok(res.idempotencyKey && res.idempotencyKey.length === 64)
})

await test('Storage failure flags recovery_required and enqueues job', async () => {
  _resetStorageTestState()
  const failingClient = {
    async rememberAndWait() { throw new Error('Walrus relayer gateway timeout (504)') },
    async remember() { throw new Error('Walrus relayer gateway timeout (504)') },
  }

  const res = await writeMemoryWithRetry({
    mem: failingClient,
    encodedText: '[config] DATABASE_URL is set in Vercel env',
    type: 'config',
    cleanText: 'DATABASE_URL is set in Vercel env',
    userId: 'usr_rel_fail',
    scope: 'personal',
    maxRetries: 1,
    initialBackoffMs: 50,
    timeoutMs: 200,
  })

  assert.equal(res.storageState, 'recovery_required')
  assert.equal(res.blobId, undefined)
  assert.ok(res.error.includes('timeout') || res.error.includes('504'))

  const stats = getRecoveryQueueStats()
  assert.ok(stats.pendingCount >= 1, 'Recovery queue must have at least 1 job')
})

// ── Test Group 2: REL-02 Idempotency & Duplicate Write Prevention ──
console.log('\n[2] REL-02: Idempotency & Duplicate-Write Prevention')

await test('Duplicate write with identical parameters returns cached confirmation', async () => {
  _resetStorageTestState()
  let callCount = 0
  const mockClient = {
    async rememberAndWait() {
      callCount++
      return { blob_id: 'blob_idempotent_abc' }
    },
  }

  // First write
  const res1 = await writeMemoryWithRetry({
    mem: mockClient,
    encodedText: '[gotcha] Docker build requires --platform linux/amd64',
    type: 'gotcha',
    cleanText: 'Docker build requires --platform linux/amd64',
    userId: 'usr_idem',
    scope: 'personal',
  })
  assert.equal(res1.blobId, 'blob_idempotent_abc')
  assert.equal(callCount, 1)

  // Second duplicate write
  const res2 = await writeMemoryWithRetry({
    mem: mockClient,
    encodedText: '[gotcha] Docker build requires --platform linux/amd64',
    type: 'gotcha',
    cleanText: 'Docker build requires --platform linux/amd64',
    userId: 'usr_idem',
    scope: 'personal',
  })
  assert.equal(res2.blobId, 'blob_idempotent_abc')
  assert.equal(res2.isDuplicate, true, 'Second write must be flagged as duplicate')
  assert.equal(callCount, 1, 'Underlying storage write must NOT be invoked again for duplicate')
})

await test('Different users or scopes have distinct idempotency keys', () => {
  const keyUser1 = computeIdempotencyKey('usr_1', 'personal', null, 'decision', 'Same text')
  const keyUser2 = computeIdempotencyKey('usr_2', 'personal', null, 'decision', 'Same text')
  const keyTeam = computeIdempotencyKey('usr_1', 'team', 'team_alpha', 'decision', 'Same text')

  assert.notEqual(keyUser1, keyUser2, 'Different users must have different idempotency keys')
  assert.notEqual(keyUser1, keyTeam, 'Personal vs team must have different idempotency keys')
})

// ── Test Group 3: REL-03 Retries & Recovery Queue Processing ──
console.log('\n[3] REL-03: Transient Retry with Backoff & Recovery Processing')

await test('Transient failure retries and succeeds before exhaustion', async () => {
  _resetStorageTestState()
  let attempts = 0
  const transientClient = {
    async rememberAndWait() {
      attempts++
      if (attempts < 2) throw new Error('Temporary 503 Service Unavailable')
      return { blob_id: 'blob_recovered_after_retry' }
    },
  }

  const res = await writeMemoryWithRetry({
    mem: transientClient,
    encodedText: '[plan] Ship Engram 2.0 with full multi-agent support',
    type: 'plan',
    cleanText: 'Ship Engram 2.0 with full multi-agent support',
    userId: 'usr_transient',
    scope: 'personal',
    maxRetries: 2,
    initialBackoffMs: 50,
  })

  assert.equal(res.blobId, 'blob_recovered_after_retry')
  assert.equal(res.attempts, 2)
  assert.ok(['confirmed_durable', 'local_mock'].includes(res.storageState))
})

await test('processRecoveryQueue drains jobs when client recovers', async () => {
  _resetStorageTestState()
  const failingClient = {
    async rememberAndWait() { throw new Error('Offline') },
  }

  // Enqueue 1 failed job
  await writeMemoryWithRetry({
    mem: failingClient,
    encodedText: '[person] Chizzy leads the Engram architecture',
    type: 'person',
    cleanText: 'Chizzy leads the Engram architecture',
    userId: 'usr_worker_test',
    scope: 'personal',
    maxRetries: 0,
    timeoutMs: 100,
  })

  const statsBefore = getRecoveryQueueStats()
  assert.equal(statsBefore.pendingCount, 1)

  // Worker recovers
  const recoveredClient = {
    async rememberAndWait() { return { blob_id: 'blob_drained_by_worker' } },
  }

  const drainResult = await processRecoveryQueue(() => recoveredClient, { force: true })
  assert.equal(drainResult.succeeded, 1)
  assert.equal(drainResult.failed, 0)

  const statsAfter = getRecoveryQueueStats()
  assert.equal(statsAfter.pendingCount, 0, 'Recovery queue should be empty after drain')
})

// ── Test Group 4: REL-04 Content Integrity Hashing & Tamper Detection ──
console.log('\n[4] REL-04: Cryptographic Content Hashing & Tamper Detection')

await test('computeContentHash is deterministic and format-invariant', () => {
  const hash1 = computeContentHash('decision', '  Deploy with Docker and Sui testnet.  ')
  const hash2 = computeContentHash('decision', 'Deploy with Docker and Sui testnet.')
  assert.equal(hash1, hash2, 'Trimmed content should yield identical hash')
  assert.equal(hash1.length, 64)
})

await test('verifyMemoryIntegrity validates authentic text and detects tampering', () => {
  const text = 'Sui validator stakes require minimum epoch lockup'
  const authenticHash = computeContentHash('config', text)

  // Authentic verification
  const validCheck = verifyMemoryIntegrity(text, 'config', authenticHash)
  assert.equal(validCheck.verified, true)

  // Tampered text
  const tamperedText = 'Sui validator stakes require ZERO epoch lockup (tampered)'
  const tamperedCheck = verifyMemoryIntegrity(tamperedText, 'config', authenticHash)
  assert.equal(tamperedCheck.verified, false, 'Tampered text must fail integrity check')
})

// ── Test Group 5: REL-05 Truthful Retention & Deletion Contract ──
console.log('\n[5] REL-05: Truthful Retention Contracts')

await test('formatRetentionContract truthfully documents on-chain epoch retention', () => {
  const contract = formatRetentionContract('blob_walrus_epoch_99')
  assert.equal(contract.unindexed, true)
  assert.equal(contract.metadataDeleted, true)
  assert.match(contract.storageRetention, /expires? naturally|registered epoch/i)
  assert.equal(contract.blobId, 'blob_walrus_epoch_99')
})

// ── Test Group 6: End-to-End API Integration ──
console.log('\n[6] End-to-End API Integration (api/remember & api/recall)')

await test('api/remember and api/recall maintain content integrity and storage states', async () => {
  const token = signLiveKey({ uid: 'usr_e2e_storage', scope: 'personal' })
  const fact = `Durable Walrus snapshot verified at ${Date.now()}`

  // 1. Remember
  const { req: remReq, res: remRes } = createMockReqRes({
    method: 'POST',
    url: '/api/remember',
    headers: { authorization: `Bearer ${token}` },
    body: { text: fact, type: 'decision', scope: 'personal' },
  })
  await rememberHandler(remReq, remRes)
  assert.equal(remRes.getStatusCode(), 200)
  const remData = remRes.getData()
  assert.ok(remData.contentHash && remData.contentHash.length === 64)
  assert.ok(remData.idempotencyKey)
  assert.ok(['confirmed_durable', 'local_mock', 'recovery_required'].includes(remData.storageState))
  assert.equal(remData.integrityVerified, true)

  // 2. Recall
  const { req: recReq, res: recRes } = createMockReqRes({
    method: 'POST',
    url: '/api/recall',
    headers: { authorization: `Bearer ${token}` },
    body: { query: 'Durable Walrus snapshot', scope: 'personal' },
  })
  await recallHandler(recReq, recRes)
  assert.equal(recRes.getStatusCode(), 200)
  const recData = recRes.getData()
  assert.ok(recData.ok)
  assert.ok(Array.isArray(recData.results || recData.memories))
})

// ── Summary ──
console.log('\n' + '='.repeat(50))
console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
if (failed > 0) {
  process.exit(1)
} else {
  console.log('🎉 ALL STORAGE RELIABILITY & INTEGRITY TESTS PASSED!\n')
}
