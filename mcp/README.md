# Engram MCP — Walrus memory for any agent

A tiny MCP server that gives your coding agent (Claude Code, Cursor, Codex) a
**portable, verifiable memory** on [Walrus Memory](https://memory.walrus.xyz),
with two things a raw memory tool lacks:

- **Scope** — every memory is `personal` (private to you) or `team` (a shared pool
  your teammates' agents also read, keyed by a join code).
- **Typed capture rules** — the tools tell the agent exactly *what* is worth
  remembering (`decision · config · gotcha · person · preference`) and what never
  to store (secrets, small talk, this-session-only detail).

## Tools

| Tool | What it does |
|---|---|
| `engram_remember(text, type, scope, team_code?)` | Store one typed durable fact on Walrus |
| `engram_recall(query, scope, team_code?)` | Semantic recall of the relevant memories |
| `engram_tidy(scope, team_code?)` | Report likely-duplicate memories to consolidate |

## Setup (2 minutes)

```bash
git clone <this repo> && cd engram
pnpm install
pnpm login:memwal      # one-time browser sign-in (Google / Sui wallet)
```

Add the server to your client. **Claude Code** — merge into `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "engram": {
      "command": "node",
      "args": ["ABSOLUTE/PATH/TO/engram/mcp/engram-mcp.mjs"]
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`) and **Codex** (`~/.codex/config.toml`) use the
same command/args. Restart the client, then confirm the `engram_*` tools appear.

Finally, paste [`../PROMPT.md`](../PROMPT.md) as your agent's system prompt — that's
what tells the agent *when* to call these tools. Now just talk; it remembers.

## Try it with no account

```bash
ENGRAM_MCP_BACKEND=mock node mcp/engram-mcp.mjs
```

The mock runs the full tool surface in memory (deterministic, no keys, no chain) —
handy for testing the integration before signing in.

## How it works

- Real writes go through the official **memwal bridge** to the Walrus relayer,
  which embeds, Seal-encrypts, uploads to Walrus, and indexes for semantic search.
- `personal` maps to namespace `me`; `team` maps to `team:<join-code>`. Recall is
  scoped by namespace, so team facts are shared and personal facts stay private.
- Each `engram_remember` returns a Walrus **blob id** you can verify on
  [walruscan](https://walruscan.com) or fetch from a Walrus aggregator.

## Env

| Var | Meaning |
|---|---|
| `ENGRAM_MCP_BACKEND` | `bridge` (default when creds exist) or `mock` |
| `MEMWAL_SERVER_URL` | relayer URL (from login; mainnet by default) |

Credentials live in `~/.memwal/credentials.json` after `pnpm login:memwal`.
