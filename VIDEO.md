# Engram — demo video script (record-ready)

**Length:** ~90 seconds. **Record when:** the Walrus relayer is back up (needed
for the real blob link in Part B). Part A works anytime (offline mock).

**Setup before recording**
- Terminal 1: `cd ~/engram && pnpm dev` → open http://localhost:5173
- Terminal 2: a Claude Code (or Cursor) window with the Engram MCP added and
  `PROMPT.md` pasted as the system prompt (see `mcp/README.md`).
- Have https://walruscan.com open in a tab.

---

## Part A — the idea, in the web app (≈35s)

1. **(0:00)** Open on the empty state. VO: *"This is Engram — it gives an AI agent
   a memory that lives on Walrus, so it stops forgetting what you told it."*
2. **(0:06)** Click the suggestion *"We moved the DB to Neon Postgres today…"*.
   → point at the green **🧠 remembered** chip with its `decision` tag.
   VO: *"As I talk, it captures durable facts — decisions, configs, gotchas,
   people — and shows exactly what it stored."*
3. **(0:16)** Type *"What's my database setup?"* → the reply cites the memory,
   and the **↩ recalled** row appears. VO: *"Ask later and it recalls them."*
4. **(0:24)** Flip the header toggle **🔒 Personal → 👥 Team**, ask the same
   question → nothing. VO: *"Two scopes: your private memory, and a shared team
   memory. Team facts are shared with your teammates' agents; personal stays
   private."* Switch the **model dropdown** → ask again → still remembers.
   VO: *"Same memory, any model."*

## Part B — it's real, and anyone can run it (≈45s)  ← the proof

5. **(0:35)** Cut to the Claude Code window. VO: *"The reproducible part is an MCP
   server — paste one prompt, add one MCP, and any agent gets Walrus memory."*
6. **(0:42)** Tell the agent: *"Remember that we deploy the API on Render and the
   web on Vercel."* → it calls **`engram_remember`** → response shows a **real
   Walrus blob id**.
7. **(0:52)** Paste that blob id into **walruscan.com** → the stored blob resolves
   on-chain. VO: *"There's the memory, verifiable on Walrus."*
8. **(1:02)** Open a **fresh** Claude Code session (no context). Ask *"where do we
   deploy?"* → it calls `engram_recall` and answers correctly. VO: *"New session,
   zero context — it still knows, because the memory isn't in the chat, it's on
   Walrus."*
9. **(1:15)** Close on `PROMPT.md`. VO: *"That's the whole thing: one prompt, one
   MCP, portable memory you own — and can share with your team."*

---

**Fallback if the relayer is still down at deadline:** record Part A in full, and
in Part B show the `engram_remember` tool call returning (the blob id may be
pending), plus the `mcp/README.md` setup — narrate that writes land on Walrus once
the relayer (which had an outage during the event) is back. Keep the offline mock
line honest.
