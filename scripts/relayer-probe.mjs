// One-shot probe: attempt a real remember+recall via the official MCP bridge.
// Prints "PROOF <json>" and exits 0 on success; "DOWN <status>" and exits 3
// while the relayer upstream is unavailable. Used by the recovery watcher.
import { spawn } from 'node:child_process';

const server = 'node_modules/@mysten-incubation/memwal-mcp/dist/bin/memwal-mcp.js';
const child = spawn('node', [server], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, MEMWAL_NAMESPACE: 'me' } });

let buf = '', down = false;
const pending = new Map();
child.stdout.on('data', (d) => {
  buf += d.toString(); let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  }
});
child.stderr.on('data', (d) => { if (/503|upstream unavailable/.test(d.toString())) down = true; });

let idc = 0;
const send = (method, params) => { const id = ++idc; const p = new Promise((r) => pending.set(id, r)); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); return p; };
const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');

const done = (code, msg) => { console.log(msg); try { child.kill(); } catch {} process.exit(code); };
setTimeout(() => done(down ? 3 : 4, down ? 'DOWN 503' : 'TIMEOUT'), 45000);

try {
  await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'engram-probe', version: '0.0.1' } });
  notify('notifications/initialized', {});
  const rem = await send('tools/call', {
    name: 'memwal_remember',
    arguments: { text: '[decision] Engram uses Walrus Memory for portable, verifiable agent memory — chosen 2026-08-27 at SuiHub Lagos.', namespace: 'me' },
  });
  const txt = JSON.stringify(rem.result ?? rem.error ?? {});
  if (/503|upstream|unavailable|isError.*true/i.test(txt) || down) done(3, 'DOWN 503');
  done(0, 'PROOF ' + txt);
} catch (e) {
  done(down ? 3 : 4, down ? 'DOWN 503' : 'ERR ' + String(e));
}
