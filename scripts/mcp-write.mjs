// Minimal MCP stdio client: drives the official memwal-mcp server to do a real
// remember + recall, proving whether real Walrus writes are reachable.
import { spawn } from 'node:child_process';

const server = 'node_modules/@mysten-incubation/memwal-mcp/dist/bin/memwal-mcp.js';
const child = spawn('node', [server], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, MEMWAL_NAMESPACE: 'me', MEMWAL_MCP_DEBUG: '1' },
});

let buf = '';
const pending = new Map();
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on('data', (d) => process.stderr.write('[mcp] ' + d));

let idc = 0;
function send(method, params) {
  const id = ++idc;
  const p = new Promise((res) => pending.set(id, res));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return p;
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

const timeout = setTimeout(() => { console.error('TIMEOUT'); child.kill(); process.exit(1); }, 120000);

try {
  const init = await send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'engram-probe', version: '0.0.1' },
  });
  console.log('INIT ok:', !!init.result);
  notify('notifications/initialized', {});

  const tools = await send('tools/list', {});
  console.log('TOOLS:', (tools.result?.tools ?? []).map((t) => t.name).join(', '));

  const rem = await send('tools/call', {
    name: 'memwal_remember',
    arguments: { text: '[decision] Engram uses Walrus Memory for portable agent memory, chosen 2026-08-27 at SuiHub Lagos.', namespace: 'me' },
  });
  console.log('\nREMEMBER RESULT:\n', JSON.stringify(rem.result ?? rem.error, null, 2));

  const rec = await send('tools/call', {
    name: 'memwal_recall',
    arguments: { query: 'what memory layer does Engram use?', namespace: 'me' },
  });
  console.log('\nRECALL RESULT:\n', JSON.stringify(rec.result ?? rec.error, null, 2));
} catch (e) {
  console.error('ERR', e);
} finally {
  clearTimeout(timeout);
  child.kill();
}
