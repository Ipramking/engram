# Engram everywhere — CLI, desktop and mobile

Goal: a person signs in once and every AI they use (terminal agents, desktop apps, IDEs, phone chat apps) reads and
writes the same memory, with no keys pasted into chats and nothing that silently goes stale.

## Principles
1. **One source of truth.** The hosted endpoint (`/mcp` + `/api/*`) is the only store clients talk to. The npm
   package becomes a thin stdio proxy to `/mcp`, so tools never drift between local and hosted (today there are three
   copies of the tool logic).
2. **No secrets in argv, URLs or chats.** Keys go in the OS keychain, an env var or an `Authorization` header —
   never `--key=` on the command line (process lists, shell history) or `?token=` (logs, chat history).
3. **Keys never expire silently.** One revocable key per device/app, with `last_used_at`, and an explicit,
   visible expiry if one exists. Every auth failure says *why* (`KEY_EXPIRED`, `KEY_REVOKED`, `KEY_UNKNOWN`,
   `AUTH_BACKEND_DOWN`) and *where to fix it*.
4. **Memory rules ship with the connection.** Connecting gives tools; the rules (when to recall/save) are installed
   into the agent's instruction file at the same time.

## Tier 1 — terminal & desktop: `engram` CLI (npm `engram-walrus`, bin alias `engram`)
```
npx engram-walrus login      # device-code flow: opens browser, you approve, CLI receives a per-device key
npx engram-walrus init       # detects installed clients and wires each one (asks per client)
npx engram-walrus doctor     # diagnoses: key valid? expiry? backend? reachable? which clients configured?
npx engram-walrus brief      # prints a short "what you should know" recall for hooks
```
- **login** — device authorization (like `gh auth login`): `POST /api/device/code` → user approves at
  `/dashboard?device=XXXX` → CLI polls `/api/device/token` → stores a named, non-expiring, revocable key
  ("Claude Code on LAPTOP-7Q2") in the OS keychain (fallback `~/.engram/credentials`, mode 600).
- **init** — detects and patches, with a diff preview and backup:
  | Client | File | Entry |
  |---|---|---|
  | Claude Code | `claude mcp add --scope user` | http transport + `Authorization` header |
  | Claude Desktop | `claude_desktop_config.json` | stdio `engram-walrus serve` (reads keychain) |
  | Cursor | `~/.cursor/mcp.json` | `url` + `headers` |
  | VS Code | user `mcp.json` | `type: http` + `headers` |
  | Windsurf / Antigravity | `mcp_config.json` | `serverUrl` / stdio |
  | Gemini CLI | `~/.gemini/settings.json` | `httpUrl` + `headers` |
  | Codex CLI | `~/.codex/config.toml` | stdio `engram-walrus serve` |
  It also offers to append the memory rules to `~/.claude/CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursor/rules`.
- **Hooks for zero-effort memory (Claude Code first):** a plugin with `SessionStart` → `engram brief` (injects the
  top memories for the current repo), and `PreCompact`/`Stop` → asks the agent to save durable facts before context
  is lost. Same idea later for Gemini CLI and Codex where hook support exists.
- **doctor** would have solved the 3 Nov incident in one command: "backend=bridge (npm 0.1.0) — your memories are in
  the cloud; run `engram init`" / "key expired on 2 Dec — run `engram login`".

## Tier 2 — chat apps on web, desktop and phone
- **Remote MCP with OAuth 2.1** (MCP authorization spec): `/.well-known/oauth-protected-resource` +
  authorization-server metadata, dynamic client registration, PKCE. Then Claude.ai, Claude mobile/desktop and ChatGPT
  connectors show **"Sign in with Engram"** — no token in the URL, per-connector revocation, works on phones because
  connectors added once sync to the apps.
- **Until OAuth lands:** the token-in-URL link (what the dashboard gives today), clearly labelled and revocable.
- **ChatGPT free / Gemini Gems / other chatbots** (no MCP): replace "save links with the master key" by
  **scoped, short-lived save tokens** (`save-only`, 30 days, revocable) and a GET page that *confirms* before it
  POSTs. Serve the memory pack from a read-only **pack URL** so Gems can be refreshed without re-copying.

## Tier 3 — native phone capture
- **Installable PWA** (manifest + service worker) with a **Web Share Target**: share any text/link from any app to
  Engram → choose type → saved. Offline queue that syncs later.
- **iOS Shortcut / Android HTTP Shortcuts** using a save-only key: "Hey Siri, remember for Engram…".
- Later, if usage justifies it: Capacitor wrapper (same codebase) for widgets and a share extension.

## Server work this depends on
1. Non-expiring revocable per-device keys (hashed with a dedicated pepper, not the signing secret) + key scopes
   (`read`, `write`, `save-only`, `team:<id>`).
2. Device-code endpoints; OAuth 2.1 endpoints.
3. Distinct auth error codes; `engram_whoami`, `engram_recent`, `engram_get` tools; dates/ids/scores in recall.
4. One shared recall implementation (FTS + vector) used by REST, hosted MCP and the proxy.
5. Session-only auth for `/api/keys` and `/api/teams` (API keys must not manage keys).

## Rollout
| Step | Ships | Unblocks |
|---|---|---|
| 1 | Publish `engram-walrus@0.2.x` (cloud, env key, scope fix) | Every existing `npx` user |
| 2 | Error codes + whoami + per-device keys | `doctor`, clear failures |
| 3 | `login` / `init` / `doctor` CLI | One-command setup on any machine |
| 4 | Claude Code plugin (hooks) | Automatic save/recall in the terminal |
| 5 | OAuth 2.1 on `/mcp` | Claude & ChatGPT connectors on web + phone without tokens |
| 6 | PWA share target + save-only keys | Capture from any phone app |
