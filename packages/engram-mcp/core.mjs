// Engram MCP core (published package). Wraps Walrus Memory with personal/team
// scope + typed capture rules. Real writes go through the official memwal bridge
// (resolved from this package's own dependency); MemWalMock for offline.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MemWalMock } from '@mysten-incubation/memwal'

// Resolve the memwal-mcp bin via the package's main export (only "." is exported).
export function memwalBinUrl() {
  const idx = import.meta.resolve('@mysten-incubation/memwal-mcp')
  return new URL('./bin/memwal-mcp.js', idx)
}

export const TYPES = ['decision', 'config', 'gotcha', 'person', 'preference', 'plan']
const nsFor = (scope, code) => (scope === 'team' ? `team:${code || 'default'}` : 'me')
const enc = (type, text) => `[${TYPES.includes(type) ? type : 'note'}] ${String(text).trim()}`
const dec = (raw) => {
  const m = String(raw).match(/^\[(decision|config|gotcha|person|preference|plan)\]\s*/i)
  return m ? { type: m[1].toLowerCase(), text: raw.replace(m[0], '').trim() } : { type: 'note', text: String(raw).trim() }
}

export function loggedIn() {
  return existsSync(join(homedir(), '.memwal', 'credentials.json'))
}

function pickBackend() {
  const forced = (process.env.ENGRAM_MCP_BACKEND || '').toLowerCase()
  if (forced === 'mock') return mockBackend()
  if (forced === 'bridge') return bridgeBackend()
  return loggedIn() || process.env.MEMWAL_PRIVATE_KEY ? bridgeBackend() : mockBackend()
}

function mockBackend() {
  const cache = new Map()
  const get = (ns) => { if (!cache.has(ns)) cache.set(ns, MemWalMock.create({ namespace: ns })); return cache.get(ns) }
  return {
    kind: 'mock',
    async remember(ns, text) { const j = await get(ns).rememberAndWait(text); return j?.blob_id },
    async recall(ns, query) { const r = await get(ns).recall({ query, topK: 10, maxDistance: 0.95 }); return (r.results ?? r).map((x) => ({ text: x.text, blobId: x.blob_id })) },
  }
}

function bridgeBackend() {
  const bin = fileURLToPath(memwalBinUrl())
  const child = spawn(process.execPath, [bin], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env }, cwd: homedir() })
  let buf = ''
  const pending = new Map()
  child.stdout.on('data', (d) => {
    buf += d.toString(); let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
      if (!line) continue; let m; try { m = JSON.parse(line) } catch { continue }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    }
  })
  child.stderr.on('data', () => {})
  let idc = 0
  const call = (method, params) => { const id = 'b' + ++idc; const p = new Promise((r) => pending.set(id, r)); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); return p }
  const ready = (async () => {
    await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'engram', version: '0.1.0' } })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n')
  })()
  const isFlap = (t) => /\b401\b|\b503\b|AUTH_REJECTED|unauthorized|not signed in|upstream|unavailable/i.test(t)
  const tool = async (name, args) => {
    await ready
    let last = 'bridge tool error'
    for (let a = 0; a < 4; a++) {
      const res = await call('tools/call', { name, arguments: args })
      const t = res.result?.content?.[0]?.text ?? ''
      if (!res.result?.isError) return t
      last = t || last
      if (!isFlap(last)) break
      await new Promise((r) => setTimeout(r, 500 * (a + 1)))
    }
    throw new Error(last)
  }
  return {
    kind: 'bridge',
    async remember(ns, text) { const t = await tool('memwal_remember', { text, namespace: ns }); const m = t.match(/blob_id[=:\s]+([A-Za-z0-9_-]+)/i) || t.match(/\/blob\/([A-Za-z0-9_-]+)/i); return m ? m[1] : undefined },
    async recall(ns, query) { const t = await tool('memwal_recall', { query, namespace: ns }); try { const j = JSON.parse(t); const rows = j.results ?? j.memories ?? j ?? []; return (Array.isArray(rows) ? rows : []).map((x) => ({ text: x.text ?? String(x), blobId: x.blob_id })) } catch { return t ? [{ text: t }] : [] } },
  }
}

export function createEngram({ backend = pickBackend(), lockNamespace = null } = {}) {
  const stored = new Map()
  const note = (ns, e) => { const a = stored.get(ns) ?? []; a.unshift(e); stored.set(ns, a) }
  const scoped = Boolean(lockNamespace)
  const scopeProps = scoped ? {} : {
    scope: { type: 'string', enum: ['personal', 'team'], default: 'personal' },
    team_code: { type: 'string', description: 'shared team join code (team scope only)' },
  }
  const where = scoped ? 'the shared TEAM memory' : 'personal or team memory'

  const TOOLS = [
    {
      name: 'engram_remember',
      description:
        `Store durable knowledge worth reusing later, in ${where}. Call this the moment the user states such a fact, ` +
        'AND whenever the user asks you to "remember / save / store / keep" something (a work plan, spec, notes, a snippet) — ' +
        'store it even if it is longer or does not fit neatly. Pick one type: decision (a choice + its reason), ' +
        'config (a setup value or where it lives), gotcha (a pitfall + fix), person (a stable fact about a teammate), ' +
        'preference (a lasting preference/goal), plan (a multi-step plan, spec, task list, or working doc to keep and continue later). ' +
        "For a normal fact write one self-contained sentence; for an explicitly-requested plan/note keep the user's full content. " +
        'NEVER store secrets/API keys, or throwaway small talk unless the user explicitly asks to keep it.' +
        (scoped ? '' : ' Use scope "team" for shared team facts, else "personal".'),
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' }, type: { type: 'string', enum: TYPES }, ...scopeProps },
        required: ['text', 'type'],
      },
    },
    {
      name: 'engram_recall',
      description:
        `Recall the memories most relevant to a query from ${where} — match by MEANING, so a few keywords or a full ` +
        'sentence both work. Call it before answering anything that depends on a past decision, plan, the user\'s ' +
        'setup/preferences, or a person, and whenever the user asks "what did we/I decide, plan, or store about X". ' +
        'Returns typed facts you should treat as ground truth and cite briefly.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, ...scopeProps }, required: ['query'] },
    },
    {
      name: 'engram_tidy',
      description: `Review ${where} and report likely-duplicate memories to consolidate. Read-only.`,
      inputSchema: { type: 'object', properties: { ...scopeProps } },
    },
  ]

  async function handleTool(name, args = {}) {
    const ns = lockNamespace ?? nsFor(args.scope, args.team_code)
    const scopeLabel = scoped ? 'team' : args.scope || 'personal'
    if (name === 'engram_remember') {
      const blobId = await backend.remember(ns, enc(args.type, args.text))
      note(ns, { type: args.type, text: String(args.text).trim(), blobId })
      return `Remembered (${args.type}, scope=${scopeLabel}). Walrus blob: ${blobId ?? '(pending)'}`
    }
    if (name === 'engram_recall') {
      const rows = await backend.recall(ns, args.query)
      if (!rows.length) return 'No relevant memories in this scope.'
      return rows.map((r) => { const { type, text } = dec(r.text); return `• (${type}) ${text}${r.blobId ? `  [blob ${r.blobId}]` : ''}` }).join('\n')
    }
    if (name === 'engram_tidy') {
      const rows = stored.get(ns) ?? []
      if (!rows.length) return 'No memories stored in this scope this session.'
      const sig = (t) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3))
      const dups = []
      for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
        const a = sig(rows[i].text), b = sig(rows[j].text)
        if ([...a].filter((w) => b.has(w)).length / Math.max(1, Math.min(a.size, b.size)) >= 0.5) dups.push(`- "${rows[i].text}"\n  ≈ "${rows[j].text}"`)
      }
      return `Scope holds ${rows.length} memories. ` + (dups.length ? `Likely duplicates:\n${dups.join('\n')}` : 'No obvious duplicates.')
    }
    throw new Error(`unknown tool ${name}`)
  }

  return { TOOLS, handleTool, backend }
}
