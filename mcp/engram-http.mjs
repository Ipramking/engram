#!/usr/bin/env node
// Engram MCP — HTTP endpoint (the team's unified access point).
// A hosted, remote MCP server over Streamable HTTP. Teammates add ONE URL to
// their agent and share a memory pool — no install, no per-person login.
//
//   client config:  { "mcpServers": { "engram": {
//     "url": "https://<host>/mcp?token=<TOKEN>&room=<team>" } } }
//
// Security model (MVP): the server authenticates to Walrus as ONE account and
// exposes ONLY team namespaces (never personal `me`). A shared token gates
// access; a ?room=<name> picks the namespace. Per-member on-chain access
// (admin/ExecutorCap) is the roadmap upgrade.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createEngram, pickBackend } from './engram-core.mjs';

// On a host, provision the Walrus login from env (no browser). Provide the
// contents of ~/.memwal/credentials.json as ENGRAM_CREDS_JSON.
function provisionCreds() {
  const raw = process.env.ENGRAM_CREDS_JSON;
  if (!raw) return;
  const path = join(homedir(), '.memwal', 'credentials.json');
  if (existsSync(path)) return;
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    JSON.parse(json); // validate
    mkdirSync(join(homedir(), '.memwal'), { recursive: true });
    writeFileSync(path, json, { mode: 0o600 });
    console.log('[engram-http] provisioned ~/.memwal/credentials.json from env');
  } catch (e) {
    console.error('[engram-http] ENGRAM_CREDS_JSON invalid:', e.message);
  }
}
provisionCreds();

const TOKEN = process.env.ENGRAM_TEAM_TOKEN || '';
const sharedBackend = pickBackend(); // one bridge for the whole process

const roomNs = (room) => `team:${String(room || 'default').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default'}`;

function buildServer(lockNamespace) {
  const { TOOLS, handleTool } = createEngram({ backend: sharedBackend, lockNamespace });
  const server = new Server({ name: 'engram-team', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (r) => {
    try {
      const text = await handleTool(r.params.name, r.params.arguments || {});
      return { content: [{ type: 'text', text }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Engram error: ${e.message}` }], isError: true };
    }
  });
  return server;
}

function authed(req, res) {
  if (!TOKEN) return true;
  const t = req.query.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (t === TOKEN) return true;
  res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized: bad or missing token' }, id: null });
  return false;
}

const app = express();
app.use(cors({ exposedHeaders: ['Mcp-Session-Id'] }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) =>
  res.type('text').send('Engram MCP endpoint. Point your agent at /mcp?token=…&room=…  (backend=' + sharedBackend.kind + ')'));
app.get('/health', (_req, res) => res.json({ ok: true, backend: sharedBackend.kind, tokenRequired: Boolean(TOKEN) }));

// Stateful Streamable HTTP with per-session transports (the pattern real MCP
// clients expect: initialize → Mcp-Session-Id → subsequent requests reuse it).
const transports = {}; // sessionId -> transport
const isInit = (body) =>
  (Array.isArray(body) ? body : [body]).some((m) => m && m.method === 'initialize');

app.post('/mcp', async (req, res) => {
  if (!authed(req, res)) return;
  try {
    const sid = req.headers['mcp-session-id'];
    let transport = sid ? transports[sid] : undefined;
    if (!transport && isInit(req.body)) {
      const lockNamespace = roomNs(req.query.room);
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => { transports[id] = transport; },
      });
      transport.onclose = () => { if (transport.sessionId) delete transports[transport.sessionId]; };
      await buildServer(lockNamespace).connect(transport);
    } else if (!transport) {
      return res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session; send initialize first' }, id: null });
    }
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: String(e?.message || e) }, id: null });
  }
});

// GET (server->client SSE) and DELETE (end session) reuse the session transport.
async function bySession(req, res) {
  if (!authed(req, res)) return;
  const sid = req.headers['mcp-session-id'];
  const transport = sid && transports[sid];
  if (!transport) return res.status(400).send('Invalid or missing session id');
  await transport.handleRequest(req, res);
}
app.get('/mcp', bySession);
app.delete('/mcp', bySession);

// Keep the free-tier instance awake: ping our own PUBLIC url every 10 min so
// Render's load balancer registers inbound traffic and never idles us out.
// RENDER_EXTERNAL_URL is injected by Render. Opt out with ENGRAM_NO_KEEPALIVE=1.
const selfUrl = process.env.RENDER_EXTERNAL_URL;
if (selfUrl && !process.env.ENGRAM_NO_KEEPALIVE && typeof fetch === 'function') {
  const ping = () =>
    fetch(new URL('/health', selfUrl).href)
      .then((r) => console.log(`[engram-http] keepalive ${r.status}`))
      .catch((e) => console.error('[engram-http] keepalive failed:', e.message));
  setInterval(ping, 10 * 60 * 1000).unref();
  console.log(`[engram-http] keepalive on -> ${selfUrl}`);
}

const port = Number(process.env.PORT || 8788);
app.listen(port, () => console.log(`[engram-http] listening on :${port}  (backend=${sharedBackend.kind}, token=${TOKEN ? 'on' : 'off'})`));
