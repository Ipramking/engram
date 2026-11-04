#!/usr/bin/env node
// Engram MCP — give any AI a portable memory on Walrus.
//   npx engram-walrus login              # sign in once in the browser; saves a key for this device
//   npx engram-walrus                    # run the MCP server (uses the saved key or ENGRAM_API_KEY)
//   npx engram-walrus doctor             # check the key, server and today's usage
//   npx engram-walrus logout             # forget the saved key
//   npx engram-walrus --mock             # in-memory store for offline testing
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createEngram, memwalBinUrl, loggedIn, hostedProxy } from './core.mjs'
import { readCredentials, clearCredentials, deviceLogin, doctor, CREDENTIALS } from './cli-auth.mjs'

const VERSION = '0.3.0'

const rawArgs = process.argv.slice(2)
let apiKey = process.env.ENGRAM_API_KEY
let keySource = apiKey ? 'ENGRAM_API_KEY' : 'none'
let hostUrl = process.env.ENGRAM_HOST || 'https://engram-pearl.vercel.app'
let room = process.env.ENGRAM_ROOM || 'my-space'
let forceMock = false

for (const a of rawArgs) {
  if (a.startsWith('--key=')) {
    apiKey = a.slice(6)
    keySource = '--key flag'
    process.stderr.write('[engram-walrus] tip: set ENGRAM_API_KEY in the client config instead of --key so the key stays out of process lists and shell history\n')
  }
  else if (a.startsWith('--url=')) hostUrl = a.slice(6)
  else if (a.startsWith('--room=')) room = a.slice(7)
  else if (a === '--mock') forceMock = true
  else if (a === '--help' || a === '-h') {
    process.stderr.write(`Engram Walrus MCP Server v${VERSION}
Usage:
  npx engram-walrus login              # Sign in in the browser; saves a key for this device
  npx engram-walrus                    # Run the MCP server (saved key or ENGRAM_API_KEY)
  npx engram-walrus doctor             # Check key, server, scope and today's usage
  npx engram-walrus logout             # Forget the saved key
  npx engram-walrus --mock             # In-memory store for offline testing
  npx engram-walrus login --walrus     # Advanced: MemWal login for direct Walrus mainnet

Options:
  --key=<eng_...>   Engram cloud API key (or set ENGRAM_API_KEY)
  --url=<url>       Custom Engram server URL (default: https://engram-pearl.vercel.app)
  --room=<room>     Custom space/room identifier (default: my-space)
  --mock            Run completely in-memory without network or Walrus credentials
`)
    process.exit(0)
  }
}

const firstArg = rawArgs[0]
const walrus = rawArgs.includes('--walrus')

// A key saved by `login` is used when no flag or env var is given.
if (!apiKey && !forceMock) {
  const saved = readCredentials()
  if (saved?.apiKey) {
    apiKey = saved.apiKey
    keySource = `saved login (${CREDENTIALS})`
    if (!process.env.ENGRAM_HOST && saved.host) hostUrl = saved.host
  }
}

if ((firstArg === 'login' || firstArg === '--login') && walrus) {
  const bin = fileURLToPath(memwalBinUrl())
  const child = spawn(process.execPath, [bin, 'login', '--prod'], { stdio: 'inherit' })
  child.on('exit', (c) => process.exit(c ?? 0))
} else if (firstArg === 'logout' && walrus) {
  const bin = fileURLToPath(memwalBinUrl())
  const child = spawn(process.execPath, [bin, '--logout'], { stdio: 'inherit' })
  child.on('exit', (c) => process.exit(c ?? 0))
} else if (firstArg === 'login' || firstArg === '--login') {
  deviceLogin({ hostUrl, noBrowser: rawArgs.includes('--no-browser') })
    .then(({ deviceName, path }) => {
      process.stderr.write(`
  Signed in as "${deviceName}". Key saved to ${path}
  Add Engram to a client with: { "command": "npx", "args": ["-y", "engram-walrus"] }
`)
      process.exitCode = 0
    })
    .catch((e) => {
      process.stderr.write(`
  Sign-in failed: ${e.message}
`)
      process.exitCode = 1
    })
} else if (firstArg === 'logout') {
  clearCredentials()
  process.stderr.write('Removed the saved key from this device. Revoke it on the dashboard Keys page if it may have leaked.\n')
  process.exit(0)
} else if (firstArg === 'doctor') {
  doctor({ apiKey, hostUrl, keySource, version: VERSION }).then((code) => { process.exitCode = code })
} else {
  const { TOOLS, handleTool, backend } = createEngram({ apiKey, hostUrl, room, forceMock })
  // Cloud mode forwards to the hosted endpoint so tools never drift from the server.
  const proxy = backend.kind === 'cloud' ? hostedProxy({ apiKey, hostUrl }) : null
  let pending = 0
  let ended = false
  const maybeExit = () => { if (ended && pending === 0) process.exit(0) }
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
      if (method === 'initialize') {
        reply(id, {
          protocolVersion: params?.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'engram-walrus', version: VERSION },
        })
        continue
      }
      if (method === 'notifications/initialized') continue
      if (method === 'ping') { reply(id, {}); continue }
      if (method === 'tools/list') {
        if (!proxy) { reply(id, { tools: TOOLS }); continue }
        pending++
        try {
          reply(id, await proxy.rpc('tools/list'))
        } catch (e) {
          process.stderr.write(`[engram-walrus] ${e.message}; offering local tools
`)
          reply(id, { tools: TOOLS })
        } finally { pending--; maybeExit() }
        continue
      }
      if (method === 'tools/call') {
        pending++
        try {
          if (proxy) reply(id, await proxy.rpc('tools/call', params))
          else reply(id, { content: [{ type: 'text', text: await handleTool(params?.name, params?.arguments || {}) }] })
        } catch (e) {
          reply(id, { content: [{ type: 'text', text: `Engram error: ${e.message}` }], isError: true })
        } finally { pending--; maybeExit() }
        continue
      }
      if (id !== undefined) replyErr(id, -32601, `method not found: ${method}`)
    }
  })

  // Let in-flight calls answer before exiting when the client closes stdin.
  process.stdin.on('end', () => {
    ended = true
    maybeExit()
  })

  if (backend.kind === 'cloud') {
    const keyPreview = apiKey ? `…${apiKey.slice(-4)}` : 'configured'
    process.stderr.write(`[engram-walrus v${VERSION}] ready (backend=cloud, key=${keyPreview}, host=${hostUrl})\n`)
  } else if (backend.kind === 'mock') {
    const hint = !loggedIn() ? ' — run `npx engram-walrus login` to connect your Engram memory' : ''
    process.stderr.write(`[engram-walrus v${VERSION}] ready (backend=mock${hint})\n`)
  } else {
    process.stderr.write(`[engram-walrus v${VERSION}] ready (backend=${backend.kind})\n`)
  }
}
