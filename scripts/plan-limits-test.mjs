// Plan limits: the free plan stops at its daily save limit, the operator-granted "unlimited" plan
// never does, and unknown plan names fall back to the free limits. Runs with no network or database.
import assert from 'node:assert/strict'
import { checkAndIncrementUsage, PLAN_LIMITS, UNLIMITED } from '../api/_lib/db.ts'
import { fmtLimit, isUnlimited } from '../src/pages/dashboard/ui.tsx'

let passed = 0
let failed = 0
async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } catch (err) {
    console.log(`  ✗ FAIL: ${name}\n    ${String(err?.message || err).split('\n').join('\n    ')}`)
    failed++
  }
}
const save = (entityId, planTier) => checkAndIncrementUsage({ entityType: 'user', entityId, operation: 'save', planTier })

console.log('\n[1] Daily save limits')
await test('free plan allows 50 saves and refuses the 51st', async () => {
  for (let i = 0; i < 50; i++) await save('free-user', 'free_personal')
  await assert.rejects(() => save('free-user', 'free_personal'), /Daily memory save limit \(50/)
})
await test('unlimited plan keeps accepting saves far beyond the free limit', async () => {
  let last
  for (let i = 0; i < 400; i++) last = await save('big-user', 'unlimited')
  assert.equal(last.saves, 400)
  assert.equal(last.limit, UNLIMITED)
  assert.ok(last.remaining > 999_999_000)
})
await test('an unknown plan name falls back to the free limits instead of opening everything up', async () => {
  for (let i = 0; i < 50; i++) await save('odd-user', 'platinum')
  await assert.rejects(() => save('odd-user', 'platinum'), /Daily memory save limit \(50/)
})

console.log('\n[2] The unlimited limit is safe to store')
await test('fits the database counter (a 32-bit integer) and is above every real plan', () => {
  assert.ok(UNLIMITED < 2_147_483_647)
  for (const [name, p] of Object.entries(PLAN_LIMITS)) if (name !== 'unlimited') assert.ok(p.dailySaves < UNLIMITED, name)
})

console.log('\n[3] Dashboard wording')
await test('shows the word Unlimited for the stand-in number, and real numbers otherwise', () => {
  assert.equal(fmtLimit(UNLIMITED), 'Unlimited')
  assert.equal(fmtLimit(50), '50')
  assert.equal(isUnlimited(UNLIMITED), true)
  assert.equal(isUnlimited(5000), false)
  assert.equal(isUnlimited(undefined), false)
})

console.log(`\nTotal tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
process.exitCode = failed ? 1 : 0
