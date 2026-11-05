// `engram-walrus init`: find the AI apps on this computer and add Engram to each one.
// Every change is confirmed, every touched file is backed up first, and a file that can't be
// parsed is left alone. Configs contain no secret: the server reads the key saved by `login`.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join } from 'node:path'
import { execFileSync, execSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { hostedProxy } from './core.mjs'

const home = homedir()
const isWin = platform() === 'win32'
const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
const macSupport = join(home, 'Library', 'Application Support')
const userConfigDir = isWin ? appData : platform() === 'darwin' ? macSupport : join(home, '.config')

// Windows GUI apps often can't resolve `npx` directly; `cmd /c` is the reliable form.
const server = isWin ? { command: 'cmd', args: ['/c', 'npx', '-y', 'engram-walrus'] } : { command: 'npx', args: ['-y', 'engram-walrus'] }
const say = (s = '') => process.stderr.write(s + '\n')

function readJson(path) {
  if (!existsSync(path)) return {}
  const raw = readFileSync(path, 'utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw) // throws on invalid JSON: caller skips the file
}

function backupAndWrite(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  if (existsSync(path)) copyFileSync(path, `${path}.engram-backup`)
  writeFileSync(path, text)
}

function jsonClient(name, path, key = 'mcpServers', entry = server) {
  return {
    name,
    path,
    present() {
      return existsSync(dirname(path))
    },
    configured() {
      try {
        const e = readJson(path)?.[key]?.engram
        if (!e) return false
        return /--key=|token=|mcp-remote|engram-walrus@0.1/.test(JSON.stringify(e)) ? 'stale' : true
      } catch {
        return false
      }
    },
    apply() {
      const cfg = readJson(path)
      cfg[key] = { ...(cfg[key] || {}), engram: entry }
      backupAndWrite(path, JSON.stringify(cfg, null, 2) + '\n')
    },
  }
}

function hasCommand(cmd) {
  try {
    execFileSync(isWin ? 'where' : 'which', [cmd], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function clients() {
  return [
    {
      name: 'Claude Code',
      path: 'claude mcp (user scope)',
      present: () => hasCommand('claude'),
      configured() {
        try {
          const out = execSync('claude mcp get engram', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
          return /--key=|token=|engram-walrus@0.1/.test(out) ? 'stale' : true
        } catch {
          return false
        }
      },
      apply() {
        if (this.configured()) execSync('claude mcp remove engram -s user', { stdio: 'ignore' })
        execSync('claude mcp add engram -s user -- npx -y engram-walrus', { stdio: 'inherit' })
      },
    },
    jsonClient('Claude Desktop', join(userConfigDir, 'Claude', 'claude_desktop_config.json')),
    jsonClient('Cursor', join(home, '.cursor', 'mcp.json')),
    jsonClient('VS Code', join(userConfigDir, 'Code', 'User', 'mcp.json'), 'servers', { type: 'stdio', ...server }),
    jsonClient('Windsurf', join(home, '.codeium', 'windsurf', 'mcp_config.json')),
    jsonClient('Gemini CLI', join(home, '.gemini', 'settings.json'), 'mcpServers', { command: 'npx', args: ['-y', 'engram-walrus'] }),
    {
      name: 'Codex CLI',
      path: join(home, '.codex', 'config.toml'),
      present() {
        return existsSync(dirname(this.path))
      },
      configured() {
        return existsSync(this.path) && /\[mcp_servers\.engram\]/.test(readFileSync(this.path, 'utf8'))
      },
      apply() {
        const prev = existsSync(this.path) ? readFileSync(this.path, 'utf8') : ''
        backupAndWrite(this.path, `${prev.replace(/\s*$/, '\n')}\n[mcp_servers.engram]\ncommand = "npx"\nargs = ["-y", "engram-walrus"]\n`)
      },
    },
  ]
}

const RULES_START = '<!-- engram:start -->'
const RULES = `${RULES_START}
## Engram memory
- Before answering questions about my projects, setup, people or preferences, call engram_recall.
- When I make a decision, set a config value, hit a gotcha, mention a person, state a preference or agree a plan, save one self-contained sentence with engram_remember (include the reason and the date).
- Never save secrets, keys or passwords; save where they live instead.
<!-- engram:end -->
`

const HOOK_COMMAND = 'npx -y engram-walrus brief'

function installClaudeExtras({ rules, hooks }) {
  const dir = join(home, '.claude')
  if (rules) {
    const md = join(dir, 'CLAUDE.md')
    const prev = existsSync(md) ? readFileSync(md, 'utf8') : ''
    if (!prev.includes(RULES_START)) backupAndWrite(md, `${prev.replace(/\s*$/, prev ? '\n\n' : '')}${RULES}`)
  }
  if (hooks) {
    const settingsPath = join(dir, 'settings.json')
    const settings = readJson(settingsPath)
    settings.hooks = settings.hooks || {}
    const list = settings.hooks.SessionStart || []
    const already = JSON.stringify(list).includes(HOOK_COMMAND)
    if (!already) {
      list.push({ hooks: [{ type: 'command', command: HOOK_COMMAND, timeout: 20 }] })
      settings.hooks.SessionStart = list
      backupAndWrite(settingsPath, JSON.stringify(settings, null, 2) + '\n')
    }
  }
}

export async function init({ yes = false, dryRun = false, signedIn = false }) {
  say(signedIn ? 'Signed in. Looking for AI apps on this computer…' : 'Not signed in yet: run `npx engram-walrus login` first, then init again.')
  if (!signedIn && !dryRun) return 1
  const found = clients().filter((c) => c.present())
  if (!found.length) {
    say('No supported apps found. See the Connect page on the dashboard for manual steps.')
    return 0
  }
  const rl = yes || dryRun ? null : createInterface({ input: process.stdin, output: process.stderr })
  const ask = async (q) => (yes ? true : dryRun ? false : /^y(es)?$/i.test((await rl.question(`${q} [y/N] `)).trim()))
  let changed = 0
  for (const c of found) {
    const state = c.configured()
    if (state === true) {
      say(`✓ ${c.name}: already set up`)
      continue
    }
    const verb = state === 'stale' ? 'Replace the old Engram entry (it has a key inside) in' : 'Add Engram to'
    if (dryRun) {
      say(`• ${c.name}: would ${verb[0].toLowerCase() + verb.slice(1)} ${c.path}`)
      continue
    }
    if (!(await ask(`${verb} ${c.name} (${c.path})?`))) continue
    try {
      c.apply()
      changed++
      say(`✓ ${c.name}: added`)
    } catch (e) {
      say(`✗ ${c.name}: skipped (${e.message.split('\n')[0]}). Nothing was changed.`)
    }
  }
  if (found.some((c) => c.name === 'Claude Code')) {
    if (dryRun) say('• Claude Code: would offer memory rules in ~/.claude/CLAUDE.md and a session-start recall hook')
    else {
      const rules = await ask('Add the Engram memory rules to ~/.claude/CLAUDE.md so Claude saves decisions on its own?')
      const hooks = await ask('Load your recent memories at the start of every Claude Code session (hook)?')
      if (rules || hooks) {
        try {
          installClaudeExtras({ rules, hooks })
          say('✓ Claude Code: ' + [rules && 'memory rules', hooks && 'session hook'].filter(Boolean).join(' and ') + ' added')
        } catch (e) {
          say(`✗ Claude Code extras skipped (${e.message}).`)
        }
      }
    }
  }
  rl?.close()
  say(changed ? '\nDone. Restart those apps so they pick up Engram. Backups end in .engram-backup.' : '\nNothing changed.')
  return 0
}

/** Printed by the Claude Code SessionStart hook; becomes context for the session. Never fails loudly. */
export async function brief({ apiKey, hostUrl }) {
  if (!apiKey) return 0
  try {
    const r = await hostedProxy({ apiKey, hostUrl, timeoutMs: 8000, retries: 0 }).rpc('tools/call', { name: 'engram_recent', arguments: { limit: 8 } })
    const text = r?.content?.map((c) => c.text).join('\n')
    if (text && !r?.isError && !/^No memories/.test(text)) {
      process.stdout.write(`Engram memory: the user's most recent saved facts (use engram_recall for more):\n${text}\n`)
    }
  } catch {
    /* offline or signed out: start the session without memory rather than blocking it */
  }
  return 0
}
