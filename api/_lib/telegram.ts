// Telegram bot: save and recall Engram memories from any phone.
// Setup: create a bot with @BotFather, set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET (and optionally
// TELEGRAM_BOT_USERNAME) in Vercel, then point the bot's webhook at /api/telegram with that secret.
import { randomInt } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'
import { getProfile } from './db.js'
import { executeMemoryCreationLifecycle } from './lifecycle.js'
import { fetchScopeRows, formatMemoryLine, isSupersededRoom, rank } from './search.js'

const TYPES = ['decision', 'config', 'gotcha', 'person', 'preference', 'plan'] as const
const env = (k: string) => (globalThis as any).process?.env?.[k] as string | undefined
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const HELP = `Send me any message and I'll save it to your Engram memory.

/recall <words>  search your memories
/recent  the 5 newest memories
/decision <text>  save with a type (also /config /gotcha /person /preference /plan)
/type <name>  change the default type for plain messages
/unlink  disconnect this chat`

export function telegramInfo() {
  return { enabled: Boolean(env('TELEGRAM_BOT_TOKEN')), username: env('TELEGRAM_BOT_USERNAME') || null }
}

async function send(chatId: number, text: string) {
  const bot = env('TELEGRAM_BOT_TOKEN')
  if (!bot) return
  await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  }).catch((e) => console.warn('[telegram] send failed:', e?.message))
}

function linkCode() {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
}

export async function handleTelegramUpdate(req: any, host: string): Promise<{ status: number; body: any }> {
  // Telegram signs webhook calls with the secret we registered; reject anything else.
  const secret = env('TELEGRAM_WEBHOOK_SECRET')
  if (!secret || req.headers?.['x-telegram-bot-api-secret-token'] !== secret) return { status: 401, body: { ok: false } }
  const supabase = getSupabaseAdmin()
  const msg = req.body?.message || req.body?.edited_message
  const chatId: number | undefined = msg?.chat?.id
  const text: string = String(msg?.text || msg?.caption || '').trim()
  // Always answer 200 so Telegram doesn't retry; problems are reported to the chat instead.
  if (!supabase || !chatId || !text) return { status: 200, body: { ok: true } }

  const { data: link } = await supabase.from('telegram_links').select('*').eq('chat_id', chatId).maybeSingle()

  if (!link?.user_id) {
    const code = linkCode()
    await supabase.from('telegram_links').upsert({
      chat_id: chatId,
      link_code: code,
      link_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    await send(chatId, `Welcome to Engram. To connect this chat to your memory, open this link and approve it (valid 15 minutes):\n${host}/dashboard?telegram=${code}`)
    return { status: 200, body: { ok: true } }
  }

  const profile = await getProfile(link.user_id).catch(() => null)
  const user = { id: link.user_id, email: profile?.email, plan_tier: profile?.plan_tier || 'free_personal' }
  const [cmdRaw, ...rest] = text.split(/\s+/)
  const cmd = cmdRaw.toLowerCase().replace(/@.*$/, '')
  const arg = rest.join(' ').trim()

  if (cmd === '/start' || cmd === '/help') {
    await send(chatId, `Connected${profile?.email ? ` as ${profile.email}` : ''}.\n\n${HELP}`)
  } else if (cmd === '/unlink') {
    await supabase.from('telegram_links').delete().eq('chat_id', chatId)
    await send(chatId, 'This chat is disconnected from Engram. Send any message to connect again.')
  } else if (cmd === '/type') {
    if (!TYPES.includes(arg as any)) await send(chatId, `Choose one of: ${TYPES.join(', ')}`)
    else {
      await supabase.from('telegram_links').update({ default_type: arg }).eq('chat_id', chatId)
      await send(chatId, `Plain messages will now be saved as ${arg}.`)
    }
  } else if (cmd === '/recall' || cmd === '/r' || cmd === '/recent') {
    const rows = (await fetchScopeRows(supabase, { scope: 'personal', userId: link.user_id, limit: cmd === '/recent' ? 5 : 500 })).filter(
      (r) => !isSupersededRoom(r.room),
    )
    const found = cmd === '/recent' ? rows.slice(0, 5) : rank(rows, arg, (r) => r.text, (r) => r.type).slice(0, 5).map((x) => x.row)
    if (cmd !== '/recent' && !arg) await send(chatId, 'Add some words to search for, e.g. /recall database')
    else await send(chatId, found.length ? found.map((m, i) => formatMemoryLine(i, m)).join('\n\n') : 'No matching memories.')
  } else if (cmd.startsWith('/') && TYPES.includes(cmd.slice(1) as any)) {
    await save(chatId, user, arg, cmd.slice(1))
  } else if (cmd.startsWith('/')) {
    await send(chatId, HELP)
  } else {
    await save(chatId, user, text, link.default_type || 'decision')
  }
  return { status: 200, body: { ok: true } }
}

async function save(chatId: number, user: any, text: string, type: string) {
  if (!text) return send(chatId, 'Nothing to save: add the text after the command.')
  const r = await executeMemoryCreationLifecycle({ user, text, type, scope: 'personal', teamCode: 'default', source: 'explicit_user' })
  if (!r.ok) return send(chatId, `Not saved: ${r.error}`)
  const replaced = r.superseded?.length ? ` It replaced an older ${type}.` : ''
  return send(chatId, `Saved as ${r.type}.${replaced}`)
}

/** Dashboard side: the signed-in user approves a chat's link code. */
export async function approveTelegramLink(userId: string, code: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { status: 503, body: { error: 'Telegram linking is not enabled yet.' } }
  const { data: link, error } = await supabase.from('telegram_links').select('*').eq('link_code', String(code || '').toUpperCase()).maybeSingle()
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return { status: 503, body: { error: 'Telegram linking is not enabled yet.' } }
  if (!link || !link.link_expires_at || new Date(link.link_expires_at).getTime() < Date.now()) {
    return { status: 410, body: { error: 'This link expired. Send any message to the bot for a new one.' } }
  }
  await supabase
    .from('telegram_links')
    .update({ user_id: userId, linked_at: new Date().toISOString(), link_code: null, link_expires_at: null })
    .eq('chat_id', link.chat_id)
  await send(link.chat_id, `Connected. Send me anything to save it, or /help for commands.`)
  return { status: 200, body: { ok: true } }
}
