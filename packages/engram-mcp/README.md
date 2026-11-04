# engram-walrus (v0.2.1)

[![npm version](https://img.shields.io/npm/v/engram-walrus.svg)](https://www.npmjs.com/package/engram-walrus)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Portable, verifiable memory for AI agents — on [Walrus](https://walrus.xyz).**  
An official Model Context Protocol (MCP) server that gives any AI agent persistent, cross-client memory on Walrus decentralized storage. Store an architectural decision or gotcha in Cursor, recall it in Claude Desktop, verify it on Walrus Explorer.

▶ Web Dashboard & Docs: **[https://engram-pearl.vercel.app](https://engram-pearl.vercel.app)**  
▶ GitHub Repository: **[https://github.com/Ipramking/engram](https://github.com/Ipramking/engram)**

---

## ⚡ Connection Modes

### Option 1: Engram Cloud Account (Recommended)
Grab your API key from the [Engram Web Dashboard](https://engram-pearl.vercel.app):

```jsonc
// In claude_desktop_config.json or .cursor/mcp.json:
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "engram-walrus@0.2"], "env": { "ENGRAM_API_KEY": "eng_usr_YOUR_KEY" }
    }
  }
}
```

### Option 2: Direct Walrus Mainnet (MemWal Login)
Sign in directly with your own Walrus cryptographic key:

```bash
# 1. Sign in once (creates or connects your private Walrus account)
npx engram-walrus login

# 2. Add to your MCP client config without a key
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "engram-walrus@0.2"]
    }
  }
}
```

### Option 3: Offline / Local Testing
Run completely in-memory without network connectivity or Walrus credentials:

```bash
npx engram-walrus --mock
```

---

## 💻 Client Setup Guides

### Claude Desktop
Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):
```json
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "engram-walrus@0.2"], "env": { "ENGRAM_API_KEY": "eng_usr_YOUR_KEY" }
    }
  }
}
```

### Cursor
Add to `.cursor/mcp.json` in your workspace or global settings:
```json
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "engram-walrus@0.2"], "env": { "ENGRAM_API_KEY": "eng_usr_YOUR_KEY" }
    }
  }
}
```

### Google Antigravity / AGY
Add to `~/.gemini/antigravity-cli/mcp_servers.json`:
```json
{
  "engram": {
    "command": "npx",
    "args": ["-y", "engram-walrus@0.2"], "env": { "ENGRAM_API_KEY": "eng_usr_YOUR_KEY" }
  }
}
```

### Windsurf
Add to `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "engram-walrus@0.2"], "env": { "ENGRAM_API_KEY": "eng_usr_YOUR_KEY" }
    }
  }
}
```

---

## 🛠️ Tools

| Tool | Parameters | Description |
|---|---|---|
| `engram_remember` | `text`, `type`, `scope`, `team_code?` | Store a durable fact (`decision`, `config`, `gotcha`, `person`, `preference`, `plan`). Verifiably committed to Walrus. |
| `engram_recall` | `query`, `scope`, `team_code?` | Semantic vector search across stored memories. Citations include Walrus blob IDs. |
| `engram_tidy` | `scope`, `team_code?` | Analyzes stored memories, detects semantic duplicates, and reports category breakdowns. |

### Scopes
- `personal`: Private to your account or device.
- `team`: Shared across your entire team via `team_code` or team API key (`eng_team_...`).

### Memory Taxonomy
- `decision`: Architectural or process choice and its reason.
- `config`: Concrete setup value or environment location.
- `gotcha`: Non-obvious pitfalls, quirks, and exact fixes.
- `person`: Stable facts, roles, timezones, and preferences of collaborators.
- `preference`: Lasting user workflows, styles, and goals.
- `plan`: Multi-step plans, specs, task lists, and work streams.

---

## ⚙️ CLI Flags

| Flag | Default | Description |
|---|---|---|
| `--key=<key>` | `$ENGRAM_API_KEY` | Your Engram API key. Prefer the env var: `--key` is visible in process lists. |
| `--url=<url>` | `https://engram-pearl.vercel.app` | Custom Engram backend endpoint URL. |
| `--room=<name>` | `my-space` | Space or workspace identifier. |
| `--mock` | `false` | Run an isolated in-memory store for unit tests or offline demos. |
| `login` | — | Open browser OAuth / Passkey sign-in for direct Walrus mainnet storage. |
| `logout` | — | Sign out and remove local Walrus credentials. |
| `--help`, `-h` | — | Show usage syntax and options. |

---

## 🛡️ Quota & Error Handling

When using Engram Cloud keys, standard daily limits apply (Free tier: 50 saves/day). If an agent hits the limit, `engram-walrus` gracefully formats the error with a live reset countdown:
```
Engram error: Daily quota exceeded (50 memories/day). Resets in 45 minutes.
```
Your AI agent can inspect this error message and notify you immediately without crashing.

---

## 📜 License

MIT © [Ipramking](https://github.com/Ipramking) — Built for the Walrus Protocol.
