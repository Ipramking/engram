// Self-test our Engram MCP server (mock backend): initialize, list tools,
// remember two facts (personal), recall, then check team scope is isolated.
import { spawn } from 'node:child_process';

const child = spawn('node', ['mcp/engram-mcp.mjs'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, ENGRAM_MCP_BACKEND: 'mock' },
});
let buf = ''; const pending = new Map();
child.stdout.on('data', (d) => {
  buf += d.toString(); let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue; let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  }
});
child.stderr.on('data', (d) => process.stderr.write(d));
let idc = 0;
const send = (method, params) => { const id = ++idc; const p = new Promise((r) => pending.set(id, r)); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); return p; };
const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
const callTool = async (name, args) => (await send('tools/call', { name, arguments: args })).result?.content?.[0]?.text;

await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
notify('notifications/initialized', {});
const tl = await send('tools/list', {});
console.log('TOOLS:', tl.result.tools.map((t) => t.name).join(', '));

console.log('\n[personal] remember x2:');
console.log(' ', await callTool('engram_remember', { text: 'We moved the DB to Neon Postgres on 2026-08-03 because the Render free tier expired.', type: 'decision', scope: 'personal' }));
console.log(' ', await callTool('engram_remember', { text: 'DATABASE_URL is set in the Render dashboard env, not in .env.', type: 'config', scope: 'personal' }));

console.log('\n[personal] recall "database setup":');
console.log(await callTool('engram_recall', { query: 'database setup', scope: 'personal' }));

console.log('\n[team sui-lagos] recall same (should be empty — scope isolation):');
console.log(await callTool('engram_recall', { query: 'database setup', scope: 'team', team_code: 'sui-lagos' }));

console.log('\n[team sui-lagos] remember + recall:');
console.log(' ', await callTool('engram_remember', { text: 'Team convention: all PRs need one review before merge.', type: 'decision', scope: 'team', team_code: 'sui-lagos' }));
console.log(await callTool('engram_recall', { query: 'PR review policy', scope: 'team', team_code: 'sui-lagos' }));

console.log('\n[tidy personal]:');
console.log(await callTool('engram_tidy', { scope: 'personal' }));

child.kill();
