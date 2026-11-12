# engram-walrus

[![npm version](https://img.shields.io/npm/v/engram-walrus.svg)](https://www.npmjs.com/package/engram-walrus)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

The command-line tool and MCP server for [Engram](https://engram-pearl.vercel.app): one memory for the AI tools you
use. Save a decision in Claude Code, recall it in Cursor, Claude or ChatGPT.

- Web app and docs: https://engram-pearl.vercel.app
- Source: https://github.com/Ipramking/engram

## Quick start

```bash
npx engram-walrus login    # approve this computer in your browser; a key is saved for it
npx engram-walrus init     # adds Engram to the AI apps on this computer (asks first)
npx engram-walrus doctor   # checks the key, server, scope and today's usage
```

`init` looks for Claude Code, Claude Desktop, Cursor, VS Code, Windsurf, Gemini CLI and Codex. It asks before
changing each one, keeps a `.engram-backup` of every config it edits, and replaces older Engram entries that used
pasted keys. For Claude Code it can also add memory rules to `~/.claude/CLAUDE.md` and a session-start hook that
runs `npx -y engram-walrus brief`. Use `--dry-run` to preview or `--yes` to accept everything.

## Manual setup

After `login`, any MCP app can use this entry. It contains no secret:

```json
{ "mcpServers": { "engram": { "command": "npx", "args": ["-y", "engram-walrus"] } } }
```

| App | Where |
| --- | --- |
| Claude Code | `claude mcp add engram -s user -- npx -y engram-walrus` |
| Claude Desktop | `claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| VS Code | `.vscode/mcp.json`, as `{ "servers": { "engram": { "type": "stdio", "command": "npx", "args": ["-y", "engram-walrus"] } } }` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Gemini CLI | `~/.gemini/settings.json` |
| Codex | `~/.codex/config.toml`, as `[mcp_servers.engram]` with `command = "npx"`, `args = ["-y", "engram-walrus"]` |

Claude and ChatGPT on the web and phone don't need this package: add `https://engram-pearl.vercel.app/mcp` as a
custom connector and sign in with Engram.

## Servers and CI

Where nobody can approve a login, create a key on the dashboard's Keys page and pass it in the environment.
A read-only or save-only key is enough for most jobs.

```bash
ENGRAM_API_KEY=eng_usr_… npx -y engram-walrus
```

## Commands

| Command | Does |
| --- | --- |
| `npx engram-walrus login` | Sign in this computer (device approval in the browser) |
| `npx engram-walrus init [--dry-run] [--yes]` | Add Engram to the AI apps on this computer |
| `npx engram-walrus doctor` | Check the key, server, scope and today's usage |
| `npx engram-walrus brief` | Print your most recent memories (used by the Claude Code hook) |
| `npx engram-walrus logout` | Forget this computer's key |
| `npx engram-walrus` | Run the MCP server over stdio (apps start it themselves) |
| `npx engram-walrus --mock` | Run with an in-memory store, for offline testing |

| Option | Default | |
| --- | --- | --- |
| `ENGRAM_API_KEY` | saved login | Key to use instead of the saved one |
| `--url=<url>` / `ENGRAM_HOST` | `https://engram-pearl.vercel.app` | Engram server |

The key from `login` lives in `~/.engram/credentials.json` and is listed on the Keys page, where you can revoke it.

## Tools

With a cloud key, the CLI forwards every call to the hosted server, so it always has the server's current tools:

| Tool | Does |
| --- | --- |
| `engram_remember` | Save one durable fact: `decision`, `config`, `gotcha`, `person`, `preference` or `plan` |
| `engram_recall` | Find the memories that match a question |
| `engram_recent` | Newest memories first, optionally by type or including replaced ones |
| `engram_get` | One memory by id |
| `engram_whoami` | Account, key, scope, expiry and today's usage |
| `engram_tidy` | Report likely duplicates and replaced memories |
| `engram_handoff` | Record or read a handoff between agents |
| `engram_snapshot` | Save or restore a project's context |

Personal memory is private. Team keys (`eng_team_…`) use the team's shared memory; personal keys can reach a team
you belong to when the tool call sets `scope: "team"`.

## Limits

Free plans allow 50 saves a day (150 for a team), reset at midnight UTC. Recall isn't counted. When a limit is
reached the tool returns a readable error instead of failing silently.

## Advanced: direct Walrus

`npx engram-walrus login --walrus` signs in to Walrus Memory itself (MemWal) instead of Engram, for running the
server against your own Walrus account. This needs the optional `@mysten-incubation/memwal-mcp` package.

## License

MIT © Ipramking
