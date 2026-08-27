# engram-walrus

**Portable, verifiable memory for AI agents — on [Walrus](https://walrus.xyz).**
An MCP server that gives any AI a memory it actually keeps. Store a fact in one
AI, recall it in another. Personal and team scope, with typed capture rules.

▶ Live demo & docs: **https://engram-pearl.vercel.app**

## Quick start (2 steps)

```bash
# 1. Sign in once (opens a browser — creates your own private Walrus account)
npx engram-walrus login
```

```jsonc
// 2. Add it to your AI client (Claude Code, Cursor, VS Code, Antigravity…)
{
  "mcpServers": {
    "engram": { "command": "npx", "args": ["-y", "engram-walrus"] }
  }
}
```

Then paste the [Engram prompt](https://github.com/Ipramking/engram/blob/main/PROMPT.md)
into your agent's rules so it knows *when* to remember and recall. That's it —
just talk, and it remembers.

## Tools

| Tool | What it does |
|---|---|
| `engram_remember(text, type, scope)` | Store one typed durable fact — `decision · config · gotcha · person · preference · plan`. Also stores anything you ask it to *remember/save/keep* (a plan, note, snippet). |
| `engram_recall(query, scope)` | Semantic recall — a few keywords or a whole sentence. |
| `engram_tidy(scope)` | Report likely-duplicate memories to consolidate. |

`scope` is `personal` (private to you) or `team` (a shared pool). Each memory is
Seal-encrypted and written to Walrus as a verifiable blob.

## Team memory (shared, one URL)

For a shared team memory across people/devices, host the endpoint and point every
teammate at one URL — see the
[team guide](https://github.com/Ipramking/engram/blob/main/mcp/ENDPOINT.md).

## Notes

- Without `login`, it runs an in-memory demo store (no account needed) so you can
  test the tools. Run `npx engram-walrus login` for real, persistent Walrus memory.
- Node 20+. Credentials live in `~/.memwal/credentials.json`.

MIT · built for the Walrus Memory hackathon.
