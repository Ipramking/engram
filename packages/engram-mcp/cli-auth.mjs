// Terminal sign-in for Engram cloud: device login, saved credentials, and a health check.
import { generateKeyPairSync, privateDecrypt, constants } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fetchRetry, hostedProxy } from './core.mjs'

const DIR = join(homedir(), '.engram')
export const CREDENTIALS = join(DIR, 'credentials.json')

export function readCredentials() {
  try {
    return existsSync(CREDENTIALS) ? JSON.parse(readFileSync(CREDENTIALS, 'utf8')) : null
  } catch {
    return null
  }
}

function saveCredentials(data) {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(CREDENTIALS, JSON.stringify(data, null, 2), { mode: 0o600 })
  try {
    chmodSync(CREDENTIALS, 0o600)
  } catch {
    /* Windows ignores POSIX modes; the file lives in the user profile */
  }
}

export function clearCredentials() {
  if (existsSync(CREDENTIALS)) rmSync(CREDENTIALS)
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
  } catch {
    /* printing the URL is enough */
  }
}

const say = (s) => process.stderr.write(s + '\n')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function deviceLogin({ hostUrl, noBrowser = false }) {
  const base = hostUrl.replace(/\/$/, '')
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  const deviceName = `${hostname()}`.slice(0, 40)
  const start = await fetchRetry(`${base}/api/keys/device/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey, deviceName }),
  })
  const s = await start.json().catch(() => ({}))
  if (!start.ok) throw new Error(s.error || `Could not start sign-in (${start.status})`)

  say('')
  say(`  Confirm this code in your browser:  ${s.code}`)
  say(`  ${s.verifyUrl}`)
  say('')
  if (!noBrowser) openBrowser(s.verifyUrl)
  say('  Waiting for approval… (Ctrl+C to cancel)')

  const deadline = Date.now() + (s.expiresIn || 600) * 1000
  while (Date.now() < deadline) {
    await sleep((s.interval || 3) * 1000)
    let p
    try {
      const res = await fetchRetry(`${base}/api/keys/device/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId: s.pollId }),
      })
      p = await res.json().catch(() => ({}))
    } catch {
      continue // flaky network: keep polling until the deadline
    }
    if (p.status === 'pending') continue
    if (p.status === 'denied') throw new Error('Sign-in was denied in the dashboard.')
    if (p.status !== 'approved' || !p.encryptedKey) throw new Error(p.error || `Sign-in ${p.status || 'failed'}.`)
    const apiKey = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(p.encryptedKey, 'base64'),
    ).toString('utf8')
    saveCredentials({ apiKey, host: base, device: deviceName, savedAt: new Date().toISOString() })
    return { deviceName, path: CREDENTIALS }
  }
  throw new Error('The sign-in code expired. Run `npx engram-walrus login` again.')
}

export async function doctor({ apiKey, hostUrl, keySource, version }) {
  say(`engram-walrus v${version}`)
  say(`Server:     ${hostUrl}`)
  say(`Key from:   ${keySource}${apiKey ? ` (…${apiKey.slice(-4)})` : ''}`)
  if (!apiKey) {
    say('Status:     not signed in. Run `npx engram-walrus login`, or set ENGRAM_API_KEY.')
    return 1
  }
  try {
    const result = await hostedProxy({ apiKey, hostUrl }).rpc('tools/call', { name: 'engram_whoami', arguments: {} })
    const text = result?.content?.map((c) => c.text).join('\n') || '(no details)'
    say('Status:     connected')
    say(text.split('\n').map((l) => `  ${l}`).join('\n'))
    return result?.isError ? 1 : 0
  } catch (e) {
    say(`Status:     failed — ${e.message}`)
    return 1
  }
}
