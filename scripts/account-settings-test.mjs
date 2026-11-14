// Hermetic test for the account endpoints behind the Settings page (change password, display name)
// and the sign-up email check. It runs the real handler and the real Supabase client against a tiny
// fake Supabase server on localhost, so it needs no network, database or credentials.
import assert from 'node:assert/strict'
import http from 'node:http'

// ── Fake Supabase (GoTrue + the few PostgREST calls these endpoints make) ──
const users = new Map() // email -> { id, email, password }
const profiles = new Map() // id -> row
const tokens = new Map() // fake access token -> user id
const calls = { adminUpdates: [], profileWrites: [] }

const addUser = (id, email, password, jwt, name) => {
  users.set(email, { id, email, password })
  tokens.set(jwt, id)
  if (name) profiles.set(id, { id, email, name, plan_tier: 'free_personal' })
}
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: {}, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
const byId = (id) => [...users.values()].find((u) => u.id === id)
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}
const noRows = { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }
/** PostgREST answers a single object when the client asks for one, an array otherwise. */
const sendRows = (req, res, rows, status = 200) => {
  if (String(req.headers.accept || '').includes('vnd.pgrst.object')) {
    return rows.length === 1 ? send(res, status, rows[0]) : send(res, 406, noRows)
  }
  return send(res, status, rows)
}

const server = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const url = new URL(req.url, 'http://fake')
    const bearer = String(req.headers.authorization || '').replace(/^Bearer /, '')
    const body = raw ? JSON.parse(raw) : {}

    if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
      const u = byId(tokens.get(bearer))
      return u ? send(res, 200, userJson(u)) : send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' })
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      if (body.email === 'flaky@example.org') return send(res, 500, { msg: 'upstream failure' })
      const u = users.get(body.email)
      if (!u || u.password !== body.password) {
        return send(res, 400, { error: 'invalid_grant', error_code: 'invalid_credentials', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' })
      }
      return send(res, 200, { access_token: `session-${u.id}`, token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: userJson(u) })
    }
    const admin = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/)
    if (admin && req.method === 'PUT') {
      const u = byId(admin[1])
      if (!u) return send(res, 404, { msg: 'User not found', error_code: 'user_not_found' })
      if (body.password) u.password = body.password
      calls.adminUpdates.push({ id: u.id, fields: Object.keys(body) })
      return send(res, 200, userJson(u))
    }
    if (url.pathname === '/auth/v1/admin/users' && req.method === 'POST') {
      return send(res, 422, { msg: 'A user with this email address has already been registered', error_code: 'email_exists' })
    }
    if (url.pathname === '/rest/v1/rpc/hit_rate_limit') {
      return send(res, 404, { code: 'PGRST202', message: 'Could not find the function public.hit_rate_limit', details: null, hint: null })
    }
    if (url.pathname === '/rest/v1/profiles') {
      const id = (url.searchParams.get('id') || '').replace(/^eq\./, '')
      if (req.method === 'GET') return sendRows(req, res, profiles.has(id) ? [profiles.get(id)] : [])
      if (req.method === 'PATCH') {
        if (!profiles.has(id)) return sendRows(req, res, [])
        Object.assign(profiles.get(id), body)
        calls.profileWrites.push({ id, op: 'update', fields: Object.keys(body) })
        return sendRows(req, res, [{ id }])
      }
      if (req.method === 'POST') {
        const row = Array.isArray(body) ? body[0] : body
        profiles.set(row.id, { ...(profiles.get(row.id) || {}), ...row })
        calls.profileWrites.push({ id: row.id, op: 'insert', fields: Object.keys(row) })
        return sendRows(req, res, [profiles.get(row.id)], 201)
      }
    }
    send(res, 404, { message: `unhandled ${req.method} ${req.url}` })
  })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

// The app reads its Supabase settings when its modules load, so set them first.
process.env.SUPABASE_URL = `http://127.0.0.1:${port}`
process.env.SUPABASE_ANON_KEY = 'anon-test-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key'
const { default: authHandler } = await import('../api/auth.js')

// ── Harness ──
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

async function call({ url, token, body, method = 'POST', query = {} }) {
  const out = { status: 200, headers: {}, json: null }
  const res = {
    setHeader: (k, v) => ((out.headers[k.toLowerCase()] = v), res),
    status: (c) => ((out.status = c), res),
    json: (d) => ((out.json = d), res),
    send: (d) => ((out.json = d), res),
    end: () => res,
  }
  const headers = token ? { authorization: `Bearer ${token}` } : {}
  await authHandler({ method, url, query, headers, body }, res)
  return out
}
const changePassword = (token, body) => call({ url: '/api/auth?subpath=change-password', query: { subpath: 'change-password' }, token, body })
const saveProfile = (token, body) => call({ url: '/api/auth/profile', token, body })

addUser('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ada@example.com', 'old-password-1', 'jwt-ada', 'ada')
addUser('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'grace@example.com', 'grace-password-1', 'jwt-grace', 'grace')
addUser('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'flaky@example.org', 'flaky-password-1', 'jwt-flaky', 'flaky')
addUser('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'nora@example.com', 'nora-password-1', 'jwt-nora', null) // signed up, but no profile row yet

console.log('\n[1] Sign-up email check')
await test('rejects a malformed address', async () => {
  const r = await call({ url: '/api/auth/register', body: { email: 'bad@nodot', password: 'long-enough-1' } })
  assert.equal(r.status, 400)
  assert.match(r.json.error, /valid email/i)
})
await test('accepts addresses containing the letter s (the old pattern excluded it)', async () => {
  // Passing validation reaches the fake user store, which answers "already registered".
  const r = await call({ url: '/api/auth/register', body: { email: 'sam@example.com', password: 'long-enough-1' } })
  assert.equal(r.status, 400)
  assert.match(r.json.error, /already registered/i)
})

console.log('\n[2] Change password: who may call it')
await test('needs a signed-in session', async () => {
  const r = await changePassword(null, { currentPassword: 'old-password-1', newPassword: 'new-password-2' })
  assert.equal(r.status, 401)
})
await test('refuses API keys', async () => {
  const r = await changePassword('eng_usr_abcdefghijklmnop', { currentPassword: 'old-password-1', newPassword: 'new-password-2' })
  assert.equal(r.status, 403)
})

console.log('\n[3] Change password: input and current-password checks')
await test('rejects missing, short, oversized and unchanged passwords without touching the account', async () => {
  const cases = [
    [{}, 400],
    [{ currentPassword: 'old-password-1' }, 400],
    [{ currentPassword: 'old-password-1', newPassword: 'short' }, 400],
    [{ currentPassword: 'old-password-1', newPassword: 'x'.repeat(129) }, 400],
    [{ currentPassword: 'old-password-1', newPassword: 'old-password-1' }, 400],
    [{ currentPassword: 5, newPassword: 'new-password-2' }, 400],
  ]
  for (const [body, status] of cases) assert.equal((await changePassword('jwt-ada', body)).status, status, JSON.stringify(body))
  assert.equal(calls.adminUpdates.length, 0)
})
await test('a wrong current password is refused and the password stays as it was', async () => {
  const r = await changePassword('jwt-ada', { currentPassword: 'not-my-password', newPassword: 'new-password-2' })
  assert.equal(r.status, 400)
  assert.equal(r.json.code, 'WRONG_PASSWORD')
  assert.equal(users.get('ada@example.com').password, 'old-password-1')
  assert.equal(calls.adminUpdates.length, 0)
})
await test('an outage while checking the password is reported as a server problem, not a wrong password', async () => {
  const r = await changePassword('jwt-flaky', { currentPassword: 'flaky-password-1', newPassword: 'new-password-2' })
  assert.equal(r.status, 502)
  assert.notEqual(r.json.code, 'WRONG_PASSWORD')
  assert.equal(users.get('flaky@example.org').password, 'flaky-password-1')
})

console.log('\n[4] Change password: success')
await test('changes the password and only the password', async () => {
  const r = await changePassword('jwt-ada', { currentPassword: 'old-password-1', newPassword: 'new-password-2' })
  assert.equal(r.status, 200)
  assert.equal(r.json.ok, true)
  assert.equal(users.get('ada@example.com').password, 'new-password-2')
  assert.deepEqual(calls.adminUpdates, [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', fields: ['password'] }])
})
await test('the old password no longer works as the current one; the new one does', async () => {
  const stale = await changePassword('jwt-ada', { currentPassword: 'old-password-1', newPassword: 'another-one-3' })
  assert.equal(stale.status, 400)
  assert.equal(stale.json.code, 'WRONG_PASSWORD')
  const fresh = await changePassword('jwt-ada', { currentPassword: 'new-password-2', newPassword: 'another-one-3' })
  assert.equal(fresh.status, 200)
  assert.equal(users.get('ada@example.com').password, 'another-one-3')
})

console.log('\n[5] Change password: guessing is limited')
await test('five wrong guesses are answered, the sixth is rate limited with Retry-After', async () => {
  for (let i = 0; i < 5; i++) {
    const r = await changePassword('jwt-grace', { currentPassword: `guess-${i}-xxxx`, newPassword: 'new-password-2' })
    assert.equal(r.status, 400, `attempt ${i + 1}`)
  }
  const blocked = await changePassword('jwt-grace', { currentPassword: 'grace-password-1', newPassword: 'new-password-2' })
  assert.equal(blocked.status, 429)
  assert.equal(blocked.json.code, 'RATE_LIMITED')
  assert.equal(blocked.headers['retry-after'], '900')
  assert.equal(users.get('grace@example.com').password, 'grace-password-1', 'even the right password is not accepted while limited')
})

console.log('\n[6] Display name')
await test('needs a signed-in session and refuses API keys', async () => {
  assert.equal((await saveProfile(null, { name: 'Ada' })).status, 401)
  assert.equal((await saveProfile('eng_usr_abcdefghijklmnop', { name: 'Ada' })).status, 403)
})
await test('rejects empty, oversized and control-character names', async () => {
  for (const name of ['', '   ', 'x'.repeat(61), 'bad\u0007name', 42, undefined]) {
    assert.equal((await saveProfile('jwt-ada', { name })).status, 400, JSON.stringify(name))
  }
  assert.equal(calls.profileWrites.length, 0)
})
await test('trims and collapses whitespace, then saves the name', async () => {
  const r = await saveProfile('jwt-ada', { name: '  Ada   Lovelace ' })
  assert.equal(r.status, 200)
  assert.equal(r.json.name, 'Ada Lovelace')
  assert.equal(profiles.get('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').name, 'Ada Lovelace')
})
await test('creates the profile when the account has none yet', async () => {
  const r = await saveProfile('jwt-nora', { name: 'Nora' })
  assert.equal(r.status, 200)
  assert.equal(profiles.get('dddddddd-dddd-4ddd-8ddd-dddddddddddd')?.name, 'Nora')
  assert.ok(calls.profileWrites.some((w) => w.id === 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' && w.op === 'insert'))
})

console.log(`\nTotal tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
server.closeAllConnections?.()
server.close()
process.exitCode = failed ? 1 : 0
