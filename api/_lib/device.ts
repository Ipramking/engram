// CLI device login (`engram-walrus login`). The CLI sends a one-time RSA public key and gets a
// short code; the signed-in user approves the code in the dashboard; the server creates a
// permanent key, encrypts it to the CLI's public key, and hands it over exactly once.
// The database only ever holds RSA-OAEP ciphertext, cleared as soon as the CLI collects it.
import { createHash, publicEncrypt, randomBytes, randomInt, constants } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'
import { createApiKey } from './db.js'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

function userCode() {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  return `${pick()}-${pick()}`
}

function cleanName(name: unknown) {
  return String(name || 'CLI').replace(/[^\w .@()-]/g, '').trim().slice(0, 40) || 'CLI'
}

function unavailable() {
  return { status: 503, body: { error: 'Device login is not enabled on this server yet. Use ENGRAM_API_KEY from the dashboard instead.' } }
}

export async function startDeviceLogin(body: any, host: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return unavailable()
  const publicKey = String(body?.publicKey || '')
  if (!publicKey.includes('BEGIN PUBLIC KEY') || publicKey.length > 2000) {
    return { status: 400, body: { error: 'publicKey (PEM) is required.' } }
  }
  // Opportunistic cleanup so abandoned requests don't pile up.
  await supabase.from('device_logins').delete().lt('expires_at', new Date(Date.now() - 86400000).toISOString())
  const pollId = randomBytes(32).toString('base64url')
  const code = userCode()
  const { error } = await supabase.from('device_logins').insert({
    code,
    poll_hash: sha256(pollId),
    public_key: publicKey,
    device_name: cleanName(body?.deviceName),
  })
  if (error) return error.code === '42P01' ? unavailable() : { status: 500, body: { error: 'Could not start device login.' } }
  return {
    status: 200,
    body: { ok: true, code, pollId, interval: 3, expiresIn: 600, verifyUrl: `${host}/dashboard?device=${code}` },
  }
}

export async function pollDeviceLogin(body: any) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return unavailable()
  const pollId = String(body?.pollId || '')
  if (!pollId) return { status: 400, body: { error: 'pollId is required.' } }
  const { data: row } = await supabase.from('device_logins').select('*').eq('poll_hash', sha256(pollId)).maybeSingle()
  if (!row) return { status: 404, body: { error: 'Unknown login request.' } }
  if (new Date(row.expires_at).getTime() < Date.now() && row.status === 'pending') {
    return { status: 410, body: { status: 'expired', error: 'This login code expired. Run the login command again.' } }
  }
  if (row.status === 'denied') return { status: 200, body: { status: 'denied' } }
  if (row.status === 'collected') return { status: 410, body: { status: 'collected', error: 'This key was already collected.' } }
  if (row.status !== 'approved' || !row.encrypted_key) return { status: 200, body: { status: 'pending' } }
  // Hand over once, then forget the ciphertext.
  const { data: claimed } = await supabase
    .from('device_logins')
    .update({ status: 'collected', encrypted_key: null })
    .eq('code', row.code)
    .eq('status', 'approved')
    .select('code')
  if (!claimed || claimed.length === 0) return { status: 410, body: { status: 'collected' } }
  return { status: 200, body: { status: 'approved', encryptedKey: row.encrypted_key } }
}

export async function describeDeviceLogin(code: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return unavailable()
  const { data: row } = await supabase
    .from('device_logins')
    .select('code, device_name, status, expires_at, created_at')
    .eq('code', String(code || '').toUpperCase())
    .maybeSingle()
  if (!row) return { status: 404, body: { error: 'No login request with that code.' } }
  const expired = new Date(row.expires_at).getTime() < Date.now()
  return { status: 200, body: { ok: true, code: row.code, deviceName: row.device_name, status: expired && row.status === 'pending' ? 'expired' : row.status } }
}

export async function decideDeviceLogin(userId: string, body: any) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return unavailable()
  const code = String(body?.code || '').toUpperCase()
  const approve = body?.approve !== false
  const { data: row } = await supabase.from('device_logins').select('*').eq('code', code).maybeSingle()
  if (!row) return { status: 404, body: { error: 'No login request with that code.' } }
  if (row.status !== 'pending') return { status: 409, body: { error: `This request is already ${row.status}.` } }
  if (new Date(row.expires_at).getTime() < Date.now()) return { status: 410, body: { error: 'This code expired. Run the login command again.' } }

  if (!approve) {
    await supabase.from('device_logins').update({ status: 'denied', user_id: userId }).eq('code', code)
    return { status: 200, body: { ok: true, status: 'denied' } }
  }

  const key = await createApiKey({ userId, name: `${row.device_name} · CLI`, scope: 'personal', room: 'my-space' })
  const rawKey = (key as any).rawKey as string
  const encryptedKey = publicEncrypt(
    { key: row.public_key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(rawKey, 'utf8'),
  ).toString('base64')
  const { error } = await supabase
    .from('device_logins')
    .update({ status: 'approved', user_id: userId, api_key_id: (key as any).id, encrypted_key: encryptedKey })
    .eq('code', code)
    .eq('status', 'pending')
  if (error) return { status: 500, body: { error: 'Could not approve the login.' } }
  return { status: 200, body: { ok: true, status: 'approved', keyName: `${row.device_name} · CLI` } }
}
