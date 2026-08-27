# Engram — Walrus Memory Hackathon Submission

> An AI agent that actually remembers — portable across sessions, devices and
> models, and shareable with your team — backed by **Walrus Memory**.

---

## 1. The prompt (copy-pasteable)

The full, ready-to-run prompt is in [`PROMPT.md`](./PROMPT.md). Paste it as the
system prompt of any agent that has `remember(text)` and `recall(query)` tools
(Engram, Claude Code, ChatGPT, Cursor, Gemini CLI) and it will start capturing
your decisions, configs, gotchas and people — and stop re-asking for context.

It gives the agent explicit rules for:
- **when to recall** (before answering anything that depends on a past fact),
- **what to remember** (decisions + reasons, configs, gotchas, people, preferences),
- **what never to store** (secrets, small talk, this-session-only details),
- **how to write a memory** (one self-contained fact, absolute dates, one tag),
- **scope** (personal vs shared team memory).

## 2. What we built

**Engram** gives any agent a memory on Walrus, in two forms:

**(a) The Engram MCP server** (`mcp/engram-mcp.mjs`) — the reproducible artifact.
Add it to Claude Code / Cursor / Codex and the agent gets three tools whose
descriptions *are* the capture rules:
- `engram_remember(text, type, scope)` — store one typed durable fact
  (`decision | config | gotcha | person | preference`) to **personal** or **team** scope
- `engram_recall(query, scope)` — semantic recall of the relevant memories
- `engram_tidy(scope)` — report likely duplicates to consolidate

Real writes go through the official Walrus Memory relayer (via the memwal bridge);
personal and team scopes are **separate namespaces**, so team facts are shared and
personal facts stay private.

**(b) The Engram web app** — a visual demo of the same idea: a chat agent that
auto-captures durable facts as you talk, shows each stored memory with its
**Walrus blob id + inspect link**, and has a **🔒 Personal ↔ 👥 Team toggle** plus a
model switcher (flip models, memory persists — proving portability). Runs with zero
keys via an offline mock so anyone can try it instantly.

Same protocol in both; the scope toggle just changes whose memory the agent reads
and writes.

## 3. What it remembers (and why)

| Type | Example | Why store it |
|---|---|---|
| **decision** | "Moved the DB to Neon Postgres on 2026-08-03 because the Render free tier expired." | Stops the agent re-litigating settled choices |
| **config** | "DATABASE_URL is in the Render dashboard env, not .env." | Setup details you always forget |
| **gotcha** | "npx supabase CLI has no win32 binary — use the standalone .exe." | Painful pitfalls, solved once |
| **person** | "Ada leads frontend, prefers Tailwind, WAT timezone." | Relationship/team context |
| **preference** | "Every UI must work on phone and desktop." | Stable preferences that shape every answer |

**When:** the moment you state such a fact (auto), or when you hit "📌 Pin this" (manual).
**Where:** encrypted on Walrus, scoped to `account + namespace`. **Never:** secrets,
questions, or throwaway chatter.

## 4. Proof it works — links to stored memory

These memories were written to **Walrus mainnet** through Engram's own
`engram_remember` tool, and are live on-chain right now (each aggregator link
returns HTTP 200 — the stored, Seal-encrypted blob):

| Memory (type) | Walrus blob id | Verify |
|---|---|---|
| *"The delegate key and accountId live in ~/.memwal/credentials.json."* (config) | `2iD9wFtosZo0AwOEmEmHWyjWw6T_gOuY899xrqU2qdI` | [explorer](https://walruscan.com/mainnet/blob/2iD9wFtosZo0AwOEmEmHWyjWw6T_gOuY899xrqU2qdI) · [aggregator](https://aggregator.walrus-mainnet.walrus.space/v1/blobs/2iD9wFtosZo0AwOEmEmHWyjWw6T_gOuY899xrqU2qdI) |
| *"Engram deploys the web app locally only; the reproducible artifact is the MCP."* (decision) | `sXb0q3luzgCWtSzvW43HPTYOsNJVZekADWKqjdTVgno` | [explorer](https://walruscan.com/mainnet/blob/sXb0q3luzgCWtSzvW43HPTYOsNJVZekADWKqjdTVgno) · [aggregator](https://aggregator.walrus-mainnet.walrus.space/v1/blobs/sXb0q3luzgCWtSzvW43HPTYOsNJVZekADWKqjdTVgno) |

**Recall proof:** calling `engram_recall("where are my walrus credentials?")` returned
the stored memories semantically ranked — the credentials `config` on top
(score 0.508) — and the relayer collapsed identical re-stores of a fact into one
content-addressed blob (built-in dedup + verifiability).

> Note: the Walrus relayer had an outage during the event (HTTP 503); these writes
> landed once it recovered. The bare server-side SDK path is rejected (401) by the
> current relayer — Engram writes via the sanctioned MemWal bridge, which is why the
> **MCP** is the real, reproducible surface and the web app is the offline-capable demo.

---

## Run it yourself

**The MCP server** (real Walrus memory in your coding agent):
```bash
pnpm install
pnpm login:memwal          # one-time browser sign-in → creds in ~/.memwal
```
Add to your client (Claude Code `~/.claude/mcp.json`, Cursor, etc.):
```json
{ "mcpServers": { "engram": {
  "command": "node",
  "args": ["<abs-path>/engram/mcp/engram-mcp.mjs"] } } }
```
Then paste `PROMPT.md` as the system prompt and just talk — it remembers.
Set `ENGRAM_MCP_BACKEND=mock` to try the tools with no account.

**The web app** (visual demo):
```bash
pnpm dev          # web on :5173, api on :8787
```
Runs out of the box with an **offline mock** (no keys). Add `OPENROUTER_API_KEY`
for full LLM answers + model switching (proves memory is portable across models).

## Demo video script (~75s)

1. (0:00) Personal mode. Type: *"We moved the DB to Neon Postgres today because the
   Render free tier expired."* → point at the 🧠 chip + blob id → click **inspect ↗**
   to show it on Walrus.
2. (0:20) New question: *"What's my database setup?"* → agent recalls it and cites
   the memory. (Reload the page first to prove it survived the session.)
3. (0:40) Switch the model dropdown to a different model → ask again → still
   remembers. **Portable across models.**
4. (0:55) Flip to 👥 Team. On a second device/browser with the same join code, ask
   the same question → the teammate's agent recalls what you stored. **Shareable.**
5. (1:10) Close on the prompt: "this is the whole thing — one prompt, any agent."
