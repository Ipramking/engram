# Engram

One memory for the AI tools you use. Your AI saves the facts worth keeping, like decisions, configs, gotchas,
people, preferences and plans, and any connected app can recall them later: Claude, ChatGPT, Claude Code, Cursor,
VS Code, Windsurf, Gemini CLI, Codex, or your phone.

- **App:** https://engram-pearl.vercel.app (docs at [/docs](https://engram-pearl.vercel.app/docs))
- **npm:** [`engram-walrus`](https://www.npmjs.com/package/engram-walrus)
- **Status:** free personal and team plans; see [docs/OPERATIONS.md](docs/OPERATIONS.md) for how it runs

## What it does

- **Typed memories.** Six types (`decision`, `config`, `gotcha`, `person`, `preference`, `plan`). Text that looks
  like an API key or private key is refused before it's saved.
- **Personal and team memory.** Personal memory is private; a team shares one memory that's separate from each
  member's personal one.
- **Recall that copes with real questions.** Postgres full-text search with word forms and prefixes, fuzzy matching
  for typos, and related-term expansion when few memories match. When a new decision contradicts an older one,
  the older one is marked as replaced.
- **Keys you control.** Every app gets its own key, which can be read-only or save-only and revoked on its own.
  Keys are stored as fingerprints only.
- **Copies on Walrus.** Engram also writes memories to [Walrus](https://walrus.xyz) through Walrus Memory. The
  database is the source of truth for search; memories that reached Walrus carry a blob id you can check on
  Walruscan.

## Connect

### Claude and ChatGPT: Sign in with Engram

Add `https://engram-pearl.vercel.app/mcp` as a custom connector (Claude: Settings → Connectors; ChatGPT: Settings →
Apps & Connectors → Developer mode), click Connect and approve on the Engram page. There's no key to copy.
Each approval shows up on the Keys page as "<app> (connector)"; revoke it to disconnect.

### Desktop apps and terminal

```bash
npx engram-walrus login    # approve this computer in the browser; a per-device key is saved
npx engram-walrus init     # adds Engram to Claude Code, Claude Desktop, Cursor, VS Code, Windsurf, Gemini CLI, Codex
npx engram-walrus doctor   # checks the key, server, scope and today's usage
```

`init` asks before changing each app, backs up every config it touches and replaces older entries that used pasted
keys. For Claude Code it can also add memory rules and a session-start brief. To configure an app by hand after
`login`, use an entry with no secret in it:

```json
{ "mcpServers": { "engram": { "command": "npx", "args": ["-y", "engram-walrus"] } } }
```

On servers and in CI, pass a key instead: `ENGRAM_API_KEY=eng_usr_… npx -y engram-walrus`.

### Phone

- **Android:** open the app in Chrome → Install app. Engram appears in every app's share menu; shares made offline
  are sent when you're back online.
- **iPhone:** a Shortcut that POSTs to `/api/remember` with a save-only key (guide in the dashboard).

### REST

```bash
curl -X POST https://engram-pearl.vercel.app/api/remember \
  -H "Authorization: Bearer $ENGRAM_API_KEY" -H "Content-Type: application/json" \
  -d '{"text":"Staging uses Neon, production uses Supabase","type":"config"}'

curl "https://engram-pearl.vercel.app/api/recall?query=database&topK=5" \
  -H "Authorization: Bearer $ENGRAM_API_KEY"
```

### Python (preview)

```bash
pip install "git+https://github.com/Ipramking/engram#subdirectory=packages/engram-py"
```

```python
from engram import remember, recall   # reads ENGRAM_API_KEY

remember("Staging uses Neon, production uses Supabase", type="config")
for m in recall("which database does staging use?"):
    print(m.type, m.text)
```

A PyPI release under the name `engram-walrus` is planned.

## MCP tools

| Tool | Does |
| --- | --- |
| `engram_remember` | Save one durable fact |
| `engram_recall` | Find the memories that match a question |
| `engram_recent` | Newest memories first, optionally by type or including replaced ones |
| `engram_get` | One memory by id |
| `engram_whoami` | Account, key, scope, expiry and today's usage |
| `engram_tidy` | Report likely duplicates and replaced memories |
| `engram_handoff` | Record or read a handoff between agents |
| `engram_snapshot` | Save or restore a project's context |

The hosted server speaks MCP over HTTP at `/mcp` with OAuth 2.1 discovery, dynamic client registration and PKCE.
The npm package runs the same tools over stdio and forwards each call to the hosted server.

## Develop

```bash
pnpm install
pnpm dev            # Vite + local API server
pnpm typecheck      # frontend and serverless functions
pnpm build
pnpm test           # hermetic tests: no network, no database
```

`pnpm test:integration` talks to a real Supabase project; run it only against staging. Environment variables,
database migrations, monitoring and backups are described in [docs/OPERATIONS.md](docs/OPERATIONS.md).

```
api/               Vercel serverless functions (REST, /mcp, OAuth, keys, teams)
api/_lib/          auth, search, storage, OAuth, device login, Telegram, security checks
src/               React 19 + Tailwind v4 web app and dashboard
packages/engram-mcp  npm package `engram-walrus` (CLI + MCP server)
packages/engram-py   Python SDK
supabase/          schema and migrations
tests/             hermetic contract tests
scripts/           older engine test suites and benchmarks
```

## Security

Please report vulnerabilities privately through
[GitHub security advisories](https://github.com/Ipramking/engram/security/advisories/new). See [SECURITY.md](SECURITY.md).

## License

MIT
