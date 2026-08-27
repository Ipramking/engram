#!/usr/bin/env node
// Engram MCP — give any AI a portable memory on Walrus.
//   npx engram-walrus login     # one-time browser sign-in (your own account)
//   npx engram-walrus           # run the MCP server (add to your AI client)
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createEngram, memwalBinUrl, loggedIn } from './core.mjs'

const arg = process.argv[2]

if (arg === 'login' || arg === '--login') {
  const bin = fileURLToPath(memwalBinUrl())
  const child = spawn(process.execPath, [bin, 'login', '--prod'], { stdio: 'inherit' })
  child.on('exit', (c) => process.exit(c ?? 0))
} else if (arg === 'logout') {
  const bin = fileURLToPath(memwalBinUrl())
  const child = spawn(process.execPath, [bin, '--logout'], { stdio: 'inherit' })
  child.on('exit', (c) => process.exit(c ?? 0))
} else {
  const { TOOLS, handleTool, backend } = createEngram()
  const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
  const replyErr = (id, code, message) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
  let inbuf = ''
  process.stdin.on('data', async (d) => {
    inbuf += d.toString()
    let i
    while ((i = inbuf.indexOf('\n')) >= 0) {
      const line = inbuf.slice(0, i).trim()
      inbuf = inbuf.slice(i + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      const { id, method, params } = msg
      if (method === 'initialize') { reply(id, { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'engram', version: '0.1.0' } }); continue }
      if (method === 'notifications/initialized') continue
      if (method === 'ping') { reply(id, {}); continue }
      if (method === 'tools/list') { reply(id, { tools: TOOLS }); continue }
      if (method === 'tools/call') {
        try { const text = await handleTool(params?.name, params?.arguments || {}); reply(id, { content: [{ type: 'text', text }] }) }
        catch (e) { reply(id, { content: [{ type: 'text', text: `Engram error: ${e.message}` }], isError: true }) }
        continue
      }
      if (id !== undefined) replyErr(id, -32601, `method not found: ${method}`)
    }
  })
  if (backend.kind === 'mock' && !loggedIn())
    process.stderr.write('[engram] not signed in — using an in-memory demo store. Run `npx engram-walrus login` in a terminal for real Walrus memory.\n')
  else process.stderr.write(`[engram] ready (backend=${backend.kind})\n`)
}
