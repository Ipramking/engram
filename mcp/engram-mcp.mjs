#!/usr/bin/env node
// Engram MCP — a thin, opinionated memory server for any MCP client (Claude
// Code, Cursor, Codex). It wraps Walrus Memory with two things a raw memory
// tool lacks: (1) a PERSONAL/TEAM scope, and (2) typed capture rules that tell
// the agent exactly what is worth remembering. Real writes go through the
// official memwal-mcp bridge; set ENGRAM_MCP_BACKEND=mock for an offline test.
//
// Add to Claude Code (~/.claude/mcp.json or client config):
//   { "mcpServers": { "engram": { "command": "node",
//     "args": ["<abs>/engram/mcp/engram-mcp.mjs"] } } }
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { MemWalMock } from '@mysten-incubation/memwal';

const TYPES = ['decision', 'config', 'gotcha', 'person', 'preference'];
const nsFor = (scope, code) => (scope === 'team' ? `team:${code || 'default'}` : 'me');
const enc = (type, text) => `[${TYPES.includes(type) ? type : 'note'}] ${String(text).trim()}`;
const dec = (raw) => {
  const m = String(raw).match(/^\[(decision|config|gotcha|person|preference)\]\s*/i);
  return m ? { type: m[1].toLowerCase(), text: raw.replace(m[0], '').trim() } : { type: 'note', text: String(raw).trim() };
};

// ── Backends ────────────────────────────────────────────────────────────────
function pickBackend() {
  const forced = (process.env.ENGRAM_MCP_BACKEND || '').toLowerCase();
  if (forced === 'mock') return mockBackend();
  if (forced === 'bridge') return bridgeBackend();
  return process.env.MEMWAL_PRIVATE_KEY ? bridgeBackend() : mockBackend();
}

function mockBackend() {
  const cache = new Map();
  const get = (ns) => { if (!cache.has(ns)) cache.set(ns, MemWalMock.create({ namespace: ns })); return cache.get(ns); };
  return {
    kind: 'mock',
    async remember(ns, text) { const j = await get(ns).rememberAndWait(text); return j?.blob_id; },
    async recall(ns, query) { const r = await get(ns).recall({ query, topK: 10, maxDistance: 0.95 }); return (r.results ?? r).map((x) => ({ text: x.text, blobId: x.blob_id })); },
  };
}

function bridgeBackend() {
  const server = new URL('../node_modules/@mysten-incubation/memwal-mcp/dist/bin/memwal-mcp.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const child = spawn('node', [server], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
  let buf = '';
  const pending = new Map();
  child.stdout.on('data', (d) => {
    buf += d.toString(); let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue; let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    }
  });
  child.stderr.on('data', () => {});
  let idc = 0;
  const call = (method, params) => { const id = 'b' + ++idc; const p = new Promise((r) => pending.set(id, r)); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); return p; };
  const ready = (async () => {
    await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'engram', version: '0.1.0' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  })();
  const tool = async (name, args) => { await ready; const res = await call('tools/call', { name, arguments: args }); const t = res.result?.content?.[0]?.text ?? ''; if (res.result?.isError) throw new Error(t || 'bridge tool error'); return t; };
  return {
    kind: 'bridge',
    async remember(ns, text) { const t = await tool('memwal_remember', { text, namespace: ns }); const m = t.match(/blob_id[=:\s]+([A-Za-z0-9_-]+)/i) || t.match(/\/blob\/([A-Za-z0-9_-]+)/i); return m ? m[1] : undefined; },
    async recall(ns, query) { const t = await tool('memwal_recall', { query, namespace: ns }); try { const j = JSON.parse(t); const rows = j.results ?? j.memories ?? j ?? []; return (Array.isArray(rows) ? rows : []).map((x) => ({ text: x.text ?? String(x), blobId: x.blob_id })); } catch { return t ? [{ text: t }] : []; } },
  };
}

const backend = pickBackend();

// Lightweight per-namespace index of what this server has stored, so engram_tidy
// can spot duplicates reliably regardless of backend list support.
const stored = new Map(); // ns -> [{ type, text, blobId }]
const remember = (ns, entry) => { const a = stored.get(ns) ?? []; a.unshift(entry); stored.set(ns, a); };

// ── Tool definitions (rules live in the descriptions — this is the point) ─────
const TOOLS = [
  {
    name: 'engram_remember',
    description:
      'Store ONE durable fact worth reusing weeks later. Call this the moment the user states such a fact. ' +
      'Pick exactly one type: decision (a choice + its reason), config (a concrete setup value or where it lives), ' +
      'gotcha (a non-obvious pitfall + fix), person (a stable fact about a teammate), preference (a lasting user preference/goal). ' +
      'Write one self-contained sentence (absolute dates, the user\'s wording). NEVER store secrets/API keys, questions, ' +
      'small talk, or this-session-only details. Use scope "team" for shared team facts (conventions, who-owns-what), else "personal".',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'the self-contained fact to remember' },
        type: { type: 'string', enum: TYPES, description: 'exactly one memory type' },
        scope: { type: 'string', enum: ['personal', 'team'], default: 'personal' },
        team_code: { type: 'string', description: 'shared team join code (team scope only)' },
      },
      required: ['text', 'type'],
    },
  },
  {
    name: 'engram_recall',
    description:
      'Recall the memories most relevant to a query before answering anything that depends on a past decision, ' +
      'the user\'s setup/preferences, or a person. Returns typed facts you should treat as ground truth and cite briefly.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        scope: { type: 'string', enum: ['personal', 'team'], default: 'personal' },
        team_code: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'engram_tidy',
    description:
      'Review a scope and report likely-duplicate or superseded memories so they can be consolidated. Read-only: it suggests, it does not delete.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['personal', 'team'], default: 'personal' },
        team_code: { type: 'string' },
      },
    },
  },
];

async function handleTool(name, args = {}) {
  const ns = nsFor(args.scope, args.team_code);
  if (name === 'engram_remember') {
    const blobId = await backend.remember(ns, enc(args.type, args.text));
    remember(ns, { type: args.type, text: String(args.text).trim(), blobId });
    return `Remembered (${args.type}, scope=${args.scope || 'personal'}). Walrus blob: ${blobId ?? '(pending)'}`;
  }
  if (name === 'engram_recall') {
    const rows = await backend.recall(ns, args.query);
    if (!rows.length) return 'No relevant memories in this scope.';
    return rows.map((r) => { const { type, text } = dec(r.text); return `• (${type}) ${text}${r.blobId ? `  [blob ${r.blobId}]` : ''}`; }).join('\n');
  }
  if (name === 'engram_tidy') {
    const rows = stored.get(ns) ?? [];
    if (!rows.length) return 'No memories stored in this scope this session.';
    // Group near-duplicates by shared significant words (cheap Jaccard).
    const sig = (t) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3));
    const dups = [];
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++) {
        const a = sig(rows[i].text), b = sig(rows[j].text);
        const inter = [...a].filter((w) => b.has(w)).length;
        const overlap = inter / Math.max(1, Math.min(a.size, b.size));
        if (overlap >= 0.5) dups.push(`- "${rows[i].text}"\n  ≈ "${rows[j].text}"`);
      }
    const byType = rows.reduce((m, r) => ((m[r.type] = (m[r.type] || 0) + 1), m), {});
    const summary = Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(', ');
    return `Scope holds ${rows.length} memories (${summary}). ` +
      (dups.length ? `Likely duplicates to consolidate:\n${dups.join('\n')}` : 'No obvious duplicates.');
  }
  throw new Error(`unknown tool ${name}`);
}

// ── Minimal MCP stdio server ─────────────────────────────────────────────────
function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function replyErr(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }

let inbuf = '';
process.stdin.on('data', async (d) => {
  inbuf += d.toString(); let i;
  while ((i = inbuf.indexOf('\n')) >= 0) {
    const line = inbuf.slice(0, i).trim(); inbuf = inbuf.slice(i + 1);
    if (!line) continue; let msg; try { msg = JSON.parse(line); } catch { continue; }
    const { id, method, params } = msg;
    if (method === 'initialize') { reply(id, { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'engram', version: '0.1.0' } }); continue; }
    if (method === 'notifications/initialized') continue;
    if (method === 'ping') { reply(id, {}); continue; }
    if (method === 'tools/list') { reply(id, { tools: TOOLS }); continue; }
    if (method === 'tools/call') {
      try { const text = await handleTool(params?.name, params?.arguments || {}); reply(id, { content: [{ type: 'text', text }] }); }
      catch (e) { reply(id, { content: [{ type: 'text', text: `Engram error: ${e.message}` }], isError: true }); }
      continue;
    }
    if (id !== undefined) replyErr(id, -32601, `method not found: ${method}`);
  }
});

process.stderr.write(`[engram-mcp] ready (backend=${backend.kind})\n`);
