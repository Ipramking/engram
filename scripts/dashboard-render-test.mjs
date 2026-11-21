// Regression test for the dashboard crash that blanked the Teams page: the members API returns
// database rows with `joined_at` (no `created_at`), and formatting the missing date threw.
// Renders the real components to HTML in Node; no browser, server or network needed.
// Run with: pnpm test:dashboard
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import { fmtDate } from '../src/pages/dashboard/ui.tsx'
import { MemberRow } from '../src/pages/dashboard/Teams.tsx'
import { ErrorBoundary } from '../src/components/ErrorBoundary.tsx'

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } catch (err) {
    console.log(`  ✗ FAIL: ${name}\n    ${String(err?.message || err).split('\n').join('\n    ')}`)
    failed++
  }
}
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()

console.log('\n[1] Dates never throw')
test('a missing, empty or invalid date shows a dash', () => {
  for (const v of [undefined, null, '', 'not a date', new Date('nope')]) assert.equal(fmtDate(v), '—', String(v))
})
test('a real date still formats', () => {
  assert.match(fmtDate('2026-11-01T10:00:00Z'), /2026/)
  assert.match(fmtDate(new Date('2026-11-01T10:00:00Z')), /2026/)
})

console.log('\n[2] Team member rows')
test('renders a row exactly as the API returns it (joined_at, no created_at)', () => {
  const row = { id: 'm1', team_id: 't1', user_id: 'u1', email: 'ada@example.com', role: 'owner', status: 'active', joined_at: '2026-11-01T10:00:00Z' }
  const out = text(renderToString(h('ul', null, h(MemberRow, { member: row }))))
  assert.match(out, /ada@example\.com/)
  assert.match(out, /Joined .*2026/)
  assert.match(out, /owner/)
})
test('renders rows with no date or no email without throwing', () => {
  const noDate = text(renderToString(h('ul', null, h(MemberRow, { member: { id: 'm2', email: 'grace@example.com', role: 'member' } }))))
  assert.match(noDate, /Joined —/)
  renderToString(h('ul', null, h(MemberRow, { member: { id: 'm3', role: 'member' } })))
})

console.log('\n[3] Error boundary')
test('turns a render error into a visible message instead of a blank page', () => {
  assert.deepEqual(ErrorBoundary.getDerivedStateFromError(new Error('boom')).error.message, 'boom')
  for (const variant of ['page', 'screen']) {
    const boundary = new ErrorBoundary({ children: null, variant })
    boundary.state = { error: new TypeError('Cannot read properties of undefined') }
    const out = text(renderToString(boundary.render()))
    assert.match(out, /This page hit a problem/)
    assert.match(out, /TypeError: Cannot read properties of undefined/)
    assert.match(out, /Reload the page/)
  }
})
test('renders its children when nothing is wrong', () => {
  const out = text(renderToString(h(ErrorBoundary, null, h('p', null, 'all good'))))
  assert.equal(out, 'all good')
})

console.log(`\nTotal tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
process.exitCode = failed ? 1 : 0
