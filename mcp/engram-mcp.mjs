#!/usr/bin/env node
// Engram MCP (stdio) — personal + team memory for a LOCAL MCP client
// (Claude Code, Cursor, Antigravity). Real writes go through the memwal bridge;
// set ENGRAM_MCP_BACKEND=mock for an offline test.
//
//   { "mcpServers": { "engram": { "command": "node",
//     "args": ["<abs>/engram/mcp/engram-mcp.mjs"],
//     "env": { "ENGRAM_MCP_BACKEND": "bridge" } } } }
import { createEngram } from './engram-core.mjs';

const { TOOLS, handleTool, backend } = createEngram(); // full personal/team scope

const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
const replyErr = (id, code, message) =>
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');

let inbuf = '';
process.stdin.on('data', async (d) => {
  inbuf += d.toString();
  let i;
  while ((i = inbuf.indexOf('\n')) >= 0) {
    const line = inbuf.slice(0, i).trim();
    inbuf = inbuf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    const { id, method, params } = msg;
    if (method === 'initialize') {
      reply(id, { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'engram', version: '0.1.0' } });
      continue;
    }
    if (method === 'notifications/initialized') continue;
    if (method === 'ping') { reply(id, {}); continue; }
    if (method === 'tools/list') { reply(id, { tools: TOOLS }); continue; }
    if (method === 'tools/call') {
      try {
        const text = await handleTool(params?.name, params?.arguments || {});
        reply(id, { content: [{ type: 'text', text }] });
      } catch (e) {
        reply(id, { content: [{ type: 'text', text: `Engram error: ${e.message}` }], isError: true });
      }
      continue;
    }
    if (id !== undefined) replyErr(id, -32601, `method not found: ${method}`);
  }
});

process.stderr.write(`[engram-mcp] ready (backend=${backend.kind})\n`);
