# Engram team endpoint — one URL for your whole team

Instead of everyone installing Engram, host it once and share a **URL**. Every
teammate adds that URL to their agent (Antigravity, Claude, Cursor) and they all
read/write the **same shared team memory** — no install, no per-person login.

```
 Teammate A ─┐
 Teammate B ─┼─►  https://<host>/mcp?token=<TOKEN>&room=<team>  ─►  Walrus
 Teammate C ─┘         (one shared account, team namespace only)
```

## Security model (MVP)
- The server authenticates to Walrus as **one account** and exposes **only team
  namespaces** — personal (`me`) memory is never reachable through the endpoint.
- A shared **token** gates access; **`?room=<name>`** picks the namespace, so one
  host can serve several teams (`room=frontend`, `room=hackathon`, …).
- Roadmap: replace the shared token with **per-member on-chain access** (an
  admin/ExecutorCap in the Walrus contract) so each teammate is authorized by
  their own key — real multi-tenant, no shared secret.

## Run it locally
```bash
ENGRAM_MCP_BACKEND=bridge ENGRAM_TEAM_TOKEN=secret123 pnpm serve:http
# → http://localhost:8788/mcp?token=secret123&room=demo
# (omit ENGRAM_TEAM_TOKEN to run open; ENGRAM_MCP_BACKEND=mock for no account)
```

## Deploy (Render free web service)
The thing that expires on Render's free tier is the **Postgres DB** — free **web
services** are free indefinitely (they sleep after 15 min idle, cold-start ~30–60s).

1. Push this repo to GitHub.
2. Render → **New → Blueprint**, pick the repo (uses `render.yaml`), **or** New →
   Web Service with build `corepack enable && pnpm install`, start
   `node mcp/engram-http.mjs`.
3. Set env vars in the dashboard:
   - `ENGRAM_MCP_BACKEND = bridge`
   - `ENGRAM_TEAM_TOKEN = <a long random secret>`
   - `ENGRAM_CREDS_JSON = <contents of ~/.memwal/credentials.json>` — the account
     the endpoint writes as. *(MVP uses your account; a dedicated team account is
     cleaner — pairs with the admin-cap roadmap.)*
4. Deploy → grab the URL.

## What teammates paste into their agent
```json
{ "mcpServers": { "engram-team": {
  "url": "https://engram-mcp.onrender.com/mcp?token=<TOKEN>&room=<team>" } } }
```
Then paste `../PROMPT.md` into their agent's rules. Done — shared team memory.

> Note: real writes need the Walrus relayer to be healthy. During the launch event
> it was intermittently down (HTTP 503/401); writes land when it recovers.
