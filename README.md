# 🧠 Engram

**Portable, verifiable memory for AI agents — on [Walrus](https://walrus.xyz).**
Tell your agent a decision, config, gotcha or fact about a teammate; it stores it
on Walrus and recalls it across sessions, devices, models — and, in team scope,
across your whole team. It stops re-asking for context you already gave it.

Built for the Walrus Memory hackathon (SuiHub Lagos, Aug 2026).

## Two surfaces, one idea

- **[Engram MCP](./mcp/README.md)** — add it to Claude Code / Cursor / Codex and
  your agent gets `engram_remember` / `engram_recall` / `engram_tidy` with
  **personal vs team scope** and **typed capture rules**. This is the reproducible
  artifact: real Walrus writes, verifiable blob ids.
- **Engram web app** — a chat agent that auto-captures durable facts, shows each
  one's **Walrus blob id + inspect link**, and has a 🔒 Personal ↔ 👥 Team toggle
  and a model switcher. Runs with zero keys via an offline mock.

## The prompt

[`PROMPT.md`](./PROMPT.md) is the copy-pasteable system prompt that drives it — the
rules for *what* to remember and *when* to recall. Paste it into any agent wired to
these tools.

## Quick start

```bash
pnpm install

# The MCP (real Walrus memory in your agent):
pnpm login:memwal        # one-time browser sign-in
# → add mcp/engram-mcp.mjs to your client (see mcp/README.md), paste PROMPT.md

# The web app demo (no keys needed):
pnpm dev                 # http://localhost:5173
```

## Proof it works

Memories written live to **Walrus mainnet** via `engram_remember` (aggregator
returns HTTP 200):

- config → [`2iD9wF…U2qdI`](https://walruscan.com/mainnet/blob/2iD9wFtosZo0AwOEmEmHWyjWw6T_gOuY899xrqU2qdI)
- decision → [`sXb0q3…TVgno`](https://walruscan.com/mainnet/blob/sXb0q3luzgCWtSzvW43HPTYOsNJVZekADWKqjdTVgno)

See [`SUBMISSION.md`](./SUBMISSION.md) for the full write-up and [`VIDEO.md`](./VIDEO.md)
for the demo script.

## Layout

```
PROMPT.md          the copy-pasteable memory protocol (the star deliverable)
mcp/engram-mcp.mjs the MCP server (scope + typed rules) + mcp/README.md
src/, api/         the web app (Vite/React) + its serverless API
scripts/           smoke tests and proof collectors
```
