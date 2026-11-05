# Running Engram in production

## Environment (Vercel → Settings → Environment Variables, Production)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Database and auth |
| `ENGRAM_SIGNING_SECRET` | Signs sessions, link keys and space tokens; also salts key fingerprints |
| `ENGRAM_PREVIOUS_SIGNING_SECRET` | Old secret during a rotation, so existing keys keep working. Remove once old keys are replaced |
| `GROQ_API_KEY`, `ENGRAM_MODEL` | LLM for `/api/chat` |
| `ENGRAM_EXPAND_MODEL` | Optional: Groq model for recall query expansion (default `llama-3.1-8b-instant`) |
| `MEMWAL_*` | Walrus (MemWal) bridge credentials |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather (enables the Telegram bot) |
| `TELEGRAM_WEBHOOK_SECRET` | Random string; Telegram sends it with every webhook call |
| `TELEGRAM_BOT_USERNAME` | Bot username without `@`, shown in the dashboard guide |

Generate secrets locally, never in a chat: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## Database migrations
Run each file in `supabase/migrations/` once, in date order, in the Supabase SQL editor. All are safe to re-run.
- `20261104_atomic_usage_and_device_login.sql`: atomic quota, CLI device login, recall indexes
- `20261105_scopes_oauth_telegram.sql`: plan-tier lock, scoped keys, Sign in with Engram, Telegram links
- `20261106_recall_search.sql`: full-text + fuzzy recall (`search_memories`); until it runs, recall uses the in-app scorer

Features whose tables are missing answer "not enabled yet" instead of failing.

## Telegram bot (one-time)
1. In Telegram, talk to **@BotFather** → `/newbot` → pick a name and username. Copy the token.
2. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_BOT_USERNAME` in Vercel and redeploy.
3. Register the webhook from your own terminal (replace the two values; don't paste them anywhere else):
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://engram-pearl.vercel.app/api/telegram&secret_token=<WEBHOOK_SECRET>&allowed_updates=%5B%22message%22%5D"
   ```
4. Message the bot. It replies with a link; approving it on the dashboard connects the chat.

## Sign in with Engram (OAuth)
Nothing to configure. Clients discover it from `/.well-known/oauth-protected-resource` and
`/.well-known/oauth-authorization-server`, register themselves, and send users to `/oauth/authorize`.
Each approval appears on the Keys page as "<app> (connector)"; revoking that key disconnects the app.

## Vercel function limit
The Hobby plan allows 12 serverless functions and `api/` now has 12. New endpoints must be added as
subpaths of an existing function (see the `?subpath=` rewrites in `vercel.json`).

## Monitoring and backups (free)
- **Uptime + keep-alive** (`.github/workflows/uptime.yml`): every 6 hours checks the site, `/api/health?deep=1` (one tiny
  database query), the MCP 401 and OAuth discovery. A failed run emails the repo owner. The query also keeps the free
  Supabase project from pausing for inactivity.
- **Nightly encrypted backup** (`.github/workflows/backup.yml`): `pg_dump` of the `public` and `auth` schemas, encrypted with
  AES-256 and kept as a 30-day workflow artifact. Add two repository secrets to turn it on:
  `SUPABASE_DB_URL` (Supabase → Connect → **Session pooler** URI, which works from GitHub's IPv4 runners) and
  `BACKUP_PASSPHRASE` (keep a copy offline; without it the backups can't be restored).
- Errors: Vercel's function logs (Project → Logs). Add Sentry's free plan later if needed.

## Legal pages
`/privacy` and `/terms` (`src/pages/LegalPage.tsx`). Set `CONTACT_EMAIL` (and check `GOVERNING_LAW`) at the top of that file
before launch. Not legal advice: have a lawyer review before you scale.

## Checks
`pnpm typecheck`, `pnpm build`, `pnpm test:package` (CI runs these). `pnpm test:integration` touches the
real Supabase project; run it only against a staging project.
