import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Copy, Download, ExternalLink, Search } from 'lucide-react'
import { Nav, Footer } from '../components/Chrome'
import { ENGRAM_PROMPT, downloadText } from '../lib/promptText'

const SITE = 'https://engram-pearl.vercel.app'
const MCP_URL = `${SITE}/mcp`
const REPO = 'https://github.com/Ipramking/engram'
const NPM = 'https://www.npmjs.com/package/engram-walrus'

interface DocArticle {
  id: string
  category: string
  title: string
  description: string
  toc: { id: string; label: string }[]
  content: ReactNode
}

/* ── Small building blocks ─────────────────────────────────────────────── */

function H({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="scroll-mt-28 pt-2 text-xl font-display text-txt">
      {children}
    </h3>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-mut sm:text-[15px]">{children}</p>
}

function C({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface/80 px-1.5 py-0.5 font-mono text-[12px] text-txt">{children}</code>
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-mut sm:text-[15px]">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-rose/40 font-mono text-[10.5px] text-rose">
            {i + 1}
          </span>
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ol>
  )
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-mut sm:text-[15px]">
          <Check size={15} className="mt-1 shrink-0 text-rose" />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-violet/30 bg-violet/[0.06] px-4 py-3 text-[13px] leading-relaxed text-mut">{children}</div>
  )
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <thead className="bg-surface/60 font-mono text-[11px] uppercase tracking-wider text-faint">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3.5 py-2.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((cell, j) => (
                <td key={j} className={`px-3.5 py-2.5 ${j === 0 ? 'text-txt' : 'text-mut'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () =>
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      },
      () => {},
    )
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-bg/80">
      <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-2">
        <span className="truncate font-mono text-[11px] text-faint">{label}</span>
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[11px] text-mut transition hover:text-txt"
        >
          {copied ? <Check size={12} className="text-rose" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-mut">{code}</pre>
    </div>
  )
}

const json = (v: unknown) => JSON.stringify(v, null, 2)
const NPX = { command: 'npx', args: ['-y', 'engram-walrus'] }

/* ── Articles ──────────────────────────────────────────────────────────── */

const ARTICLES: DocArticle[] = [
  {
    id: 'intro',
    category: 'Start here',
    title: 'What is Engram?',
    description: 'One memory for the AI tools you use: Claude, ChatGPT, your editor and your terminal.',
    toc: [
      { id: 'problem', label: 'Why it exists' },
      { id: 'how', label: 'How it works' },
      { id: 'storage', label: 'Where memories live' },
    ],
    content: (
      <>
        <H id="problem">Why it exists</H>
        <P>
          Every new chat starts from zero. You explain your stack, your conventions and last week's decisions to Claude,
          then again to Cursor, then again on your phone. Engram stores those facts once and lets every AI you connect read
          them.
        </P>
        <H id="how">How it works</H>
        <P>
          Engram is an MCP server, the standard way AI apps call tools. Connected apps get tools such as <C>engram_remember</C>{' '}
          and <C>engram_recall</C>. When your AI learns something durable, like a decision, a config value or a gotcha, it saves it
          as a typed memory. Before answering a question about your work, it recalls the memories that match.
        </P>
        <P>
          Memories are personal by default. A team gets its own shared memory, separate from each member's personal one, that
          every member's apps can read and write.
        </P>
        <H id="storage">Where memories live</H>
        <P>
          Memories are stored in Engram's database (Supabase Postgres), which is what search runs on. Engram also writes a copy
          to Walrus, decentralized storage on Sui, through Walrus Memory. Memories whose copy reached Walrus show a blob id on
          the dashboard that anyone can check on Walruscan.
        </P>
        <P>
          Deleting a memory removes it from Engram and from recall straight away. A Walrus copy can remain until its storage
          period ends, so don't save anything that must be erased everywhere. The{' '}
          <Link to="/privacy" className="text-rose hover:underline">Privacy Policy</Link> has the details.
        </P>
      </>
    ),
  },
  {
    id: 'quickstart',
    category: 'Start here',
    title: 'Quick start',
    description: 'Create an account, connect one app, and check that it remembers.',
    toc: [
      { id: 'account', label: '1. Create an account' },
      { id: 'connect', label: '2. Connect an app' },
      { id: 'check', label: '3. Check it works' },
    ],
    content: (
      <>
        <H id="account">1. Create an account</H>
        <P>
          <Link to="/register" className="text-rose hover:underline">Sign up</Link> with your email and a password of 8 or more
          characters. The dashboard opens on a short checklist that follows your progress.
        </P>
        <H id="connect">2. Connect an app</H>
        <Bullets
          items={[
            <>
              <b className="text-txt">Claude or ChatGPT:</b> add <C>{MCP_URL}</C> as a custom connector and sign in when asked.
              See <i>Claude &amp; ChatGPT</i>.
            </>,
            <>
              <b className="text-txt">Claude Code, Claude Desktop, Cursor, VS Code, Windsurf, Gemini CLI or Codex:</b> run the two
              commands below.
            </>,
            <>
              <b className="text-txt">Anything else:</b> the dashboard's Connect page has step-by-step guides for 15 apps.
            </>,
          ]}
        />
        <CodeBlock label="Terminal" code={'npx engram-walrus login\nnpx engram-walrus init'} />
        <H id="check">3. Check it works</H>
        <P>
          In one app, say: <i>“Remember that our staging database is Neon.”</i> In another app or a new chat, ask:{' '}
          <i>“What do you remember about our databases?”</i> The memory also shows up on the dashboard's Memories page.
        </P>
        <P>
          In a terminal, <C>npx engram-walrus doctor</C> checks the key, the server, the scope and today's usage.
        </P>
      </>
    ),
  },
  {
    id: 'chat-apps',
    category: 'Connect',
    title: 'Claude & ChatGPT',
    description: 'Sign in with Engram: add one link, approve once, and there is no key to copy.',
    toc: [
      { id: 'claude', label: 'Claude' },
      { id: 'chatgpt', label: 'ChatGPT' },
      { id: 'disconnect', label: 'Disconnecting' },
    ],
    content: (
      <>
        <H id="claude">Claude</H>
        <Steps
          items={[
            <>On a computer, open <b className="text-txt">claude.ai → Settings → Connectors</b> and choose <b className="text-txt">Add custom connector</b>.</>,
            <>Name it Engram and paste the link below. Click <b className="text-txt">Add</b>, then <b className="text-txt">Connect</b>.</>,
            <>Engram opens. Sign in if asked, check the app name, and press <b className="text-txt">Allow</b>.</>,
            <>In a chat, open the tools menu and switch Engram on. Connectors you add on claude.ai also work in the Claude phone and desktop apps.</>,
          ]}
        />
        <CodeBlock label="Connector URL" code={MCP_URL} />
        <Note>Custom connectors depend on your Claude plan. If you can't add one, use Claude Desktop with the terminal setup instead.</Note>
        <H id="chatgpt">ChatGPT</H>
        <Steps
          items={[
            <>On a paid plan, open <b className="text-txt">Settings → Apps &amp; Connectors → Advanced</b> on the web and turn on <b className="text-txt">Developer mode</b>.</>,
            <>Create a connector named Engram with the same URL and <b className="text-txt">OAuth</b> authentication, then press <b className="text-txt">Allow</b> on the Engram page.</>,
            <>In a chat, pick <b className="text-txt">Developer mode</b> from the <b className="text-txt">+</b> menu and enable Engram.</>,
          ]}
        />
        <P>
          ChatGPT's free plan can't call connectors. The ChatGPT guide on the dashboard shows a save-only alternative that uses
          custom instructions.
        </P>
        <H id="disconnect">Disconnecting</H>
        <P>
          Each approval creates a key named after the app, such as “Claude (connector)”, on the Keys page. Revoke it to disconnect
          that app. Its access lasts 7 days at a time and renews automatically while the app keeps using it.
        </P>
      </>
    ),
  },
  {
    id: 'cli',
    category: 'Connect',
    title: 'Desktop apps & terminal',
    description: 'One command adds Engram to the AI apps on your computer.',
    toc: [
      { id: 'login', label: 'Sign in this computer' },
      { id: 'init', label: 'Add Engram to your apps' },
      { id: 'commands', label: 'All commands' },
      { id: 'manual', label: 'Manual setup' },
      { id: 'headless', label: 'Servers and CI' },
    ],
    content: (
      <>
        <H id="login">Sign in this computer</H>
        <CodeBlock label="Terminal" code="npx engram-walrus login" />
        <P>
          The terminal shows a code and a link. Open the link, check that the code matches, and approve. The computer gets its
          own permanent key, saved in <C>~/.engram/credentials.json</C> and listed on your Keys page so you can revoke it on its
          own. The key is encrypted for that terminal before it leaves the server, so it never appears in the browser.
        </P>
        <H id="init">Add Engram to your apps</H>
        <CodeBlock label="Terminal" code="npx engram-walrus init" />
        <P>
          <C>init</C> looks for Claude Code, Claude Desktop, Cursor, VS Code, Windsurf, Gemini CLI and Codex. For each one it
          finds, it asks before changing anything, keeps a backup of the config (<C>.engram-backup</C>), and replaces older
          Engram entries that used pasted keys. Restart each app afterwards.
        </P>
        <P>
          For Claude Code it can also add memory rules to <C>~/.claude/CLAUDE.md</C> and a session-start hook that runs{' '}
          <C>npx -y engram-walrus brief</C>, so every session opens with your most recent memories. Add <C>--dry-run</C> to see
          what would change, or <C>--yes</C> to accept every change.
        </P>
        <H id="commands">All commands</H>
        <Table
          head={['Command', 'What it does']}
          rows={[
            [<C>npx engram-walrus login</C>, 'Sign in this computer'],
            [<C>npx engram-walrus init</C>, 'Add Engram to the apps on this computer (--dry-run, --yes)'],
            [<C>npx engram-walrus doctor</C>, "Check the key, server, scope and today's usage"],
            [<C>npx engram-walrus brief</C>, 'Print your most recent memories (used by the Claude Code hook)'],
            [<C>npx engram-walrus logout</C>, "Forget this computer's key"],
            [<C>npx engram-walrus</C>, 'Run the MCP server (apps start it themselves)'],
          ]}
        />
        <H id="manual">Manual setup</H>
        <P>After <C>login</C>, every app can use the same entry. It contains no secret.</P>
        <CodeBlock label="Claude Desktop, Cursor, Windsurf, Gemini CLI, Antigravity" code={json({ mcpServers: { engram: NPX } })} />
        <CodeBlock label="VS Code (.vscode/mcp.json)" code={json({ servers: { engram: { type: 'stdio', ...NPX } } })} />
        <CodeBlock label="Claude Code" code="claude mcp add engram -s user -- npx -y engram-walrus" />
        <CodeBlock label="Codex (~/.codex/config.toml)" code={'[mcp_servers.engram]\ncommand = "npx"\nargs = ["-y", "engram-walrus"]'} />
        <H id="headless">Servers and CI</H>
        <P>
          Where nobody can approve a login, create a key on the Keys page and pass it in the environment. Give jobs a read-only
          or save-only key when that's all they need.
        </P>
        <CodeBlock label="Terminal" code="ENGRAM_API_KEY=eng_usr_… npx -y engram-walrus" />
      </>
    ),
  },
  {
    id: 'phone',
    category: 'Connect',
    title: 'Phone',
    description: 'Save from any app with the share button, even when you are offline.',
    toc: [
      { id: 'android', label: 'Android' },
      { id: 'iphone', label: 'iPhone' },
      { id: 'offline', label: 'Offline' },
    ],
    content: (
      <>
        <H id="android">Android</H>
        <P>
          Open {SITE.replace('https://', '')} in Chrome and choose <b className="text-txt">⋮ → Install app</b>. Engram then
          appears in every app's share menu: share some text to it, pick a type and press Save.
        </P>
        <H id="iphone">iPhone</H>
        <Steps
          items={[
            <>Create a <b className="text-txt">Save only</b> key on the Keys page.</>,
            <>In Shortcuts, make a new shortcut: <b className="text-txt">Receive Text from Share Sheet</b> → <b className="text-txt">Get Contents of URL</b>, with method POST, the header and the JSON body below. Use Shortcut Input as the text.</>,
            <>Name it <b className="text-txt">Save to Engram</b> and turn on <b className="text-txt">Show in Share Sheet</b>. Add <b className="text-txt">Dictate Text</b> first for a voice version.</>,
          ]}
        />
        <CodeBlock
          label="Shortcut request"
          code={`POST ${SITE}/api/remember\nAuthorization: Bearer eng_usr_…\nContent-Type: application/json\n\n{"text":"<Shortcut Input>","type":"decision"}`}
        />
        <H id="offline">Offline</H>
        <P>
          When the phone has no connection, the installed app keeps what you shared on the device and sends it as soon as you're
          back online.
        </P>
      </>
    ),
  },
  {
    id: 'rest',
    category: 'Connect',
    title: 'REST API',
    description: 'Save and search from scripts, shortcuts and other tools.',
    toc: [
      { id: 'auth', label: 'Authentication' },
      { id: 'remember', label: 'Save a memory' },
      { id: 'recall', label: 'Search memories' },
      { id: 'errors', label: 'Errors' },
    ],
    content: (
      <>
        <H id="auth">Authentication</H>
        <P>Send a key from the Keys page as a bearer token.</P>
        <CodeBlock label="Header" code="Authorization: Bearer eng_usr_…" />
        <H id="remember">Save a memory</H>
        <CodeBlock
          label="POST /api/remember"
          code={`curl -X POST ${SITE}/api/remember \\\n  -H "Authorization: Bearer $ENGRAM_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"text":"Staging uses Neon, production uses Supabase","type":"config"}'`}
        />
        <P>
          <C>type</C> is one of decision, config, gotcha, person, preference or plan, and <C>text</C> can be up to 4,000
          characters. A team key saves to its team. With a personal key, add <C>"scope":"team"</C> and{' '}
          <C>"teamCode":"&lt;team id&gt;"</C> to save to a team you belong to.
        </P>
        <H id="recall">Search memories</H>
        <CodeBlock
          label="GET /api/recall"
          code={`curl "${SITE}/api/recall?query=database&topK=5" \\\n  -H "Authorization: Bearer $ENGRAM_API_KEY"`}
        />
        <P>
          Returns <C>results</C>, best match first, each with <C>id</C>, <C>type</C>, <C>text</C> and <C>createdAt</C>. Memories
          replaced by newer ones are left out unless you add <C>includeSuperseded=true</C>. POST with a JSON body works too.
        </P>
        <H id="errors">Errors</H>
        <Table
          head={['Status', 'Meaning']}
          rows={[
            ['401', 'The key is missing, revoked or expired (code KEY_INVALID). Link keys expire after 30 days.'],
            ['403', "The key can't do this: a read-only key tried to save, a save-only key tried to read, or the team isn't yours."],
            ['413', 'The text is too long.'],
            ['429', 'The daily save limit is reached. It resets at midnight UTC.'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'memory-types',
    category: 'Concepts',
    title: 'Memory types',
    description: 'Six kinds of durable fact. Everything else is chatter and stays out.',
    toc: [
      { id: 'types', label: 'The six types' },
      { id: 'secrets', label: 'What not to save' },
    ],
    content: (
      <>
        <H id="types">The six types</H>
        <Table
          head={['Type', 'Holds', 'Example']}
          rows={[
            ['decision', 'A choice and the reason for it', '“Moved the database to Neon because the free tier expired.”'],
            ['config', 'A setup value, or where a secret lives', '“DATABASE_URL is set in Vercel env, not .env.”'],
            ['gotcha', 'A pitfall and its workaround', '“The Supabase CLI has no Windows binary: use the standalone .exe.”'],
            ['person', 'A stable fact about someone you work with', '“Ada leads frontend and works in WAT.”'],
            ['preference', 'A lasting rule or style', '“Every screen must work on phone and desktop.”'],
            ['plan', 'A spec, roadmap or task list', '“Launch: ship MCP, add tests, open sign-ups.”'],
          ]}
        />
        <P>
          Your AI picks the type, or you can say it outright: <i>“Save this as a gotcha: …”</i>. Download the{' '}
          <button onClick={() => downloadText('engram-memory-prompt.txt', ENGRAM_PROMPT)} className="inline-flex items-center gap-1 text-rose hover:underline">
            memory rules <Download size={12} />
          </button>{' '}
          to give any AI the same habits.
        </P>
        <H id="secrets">What not to save</H>
        <P>
          Passwords, API keys and private keys. Engram refuses text that looks like one of these key formats: OpenAI, Anthropic and
          Groq keys, GitHub tokens, Google and Firebase keys, AWS access keys, Slack tokens, Supabase service keys, Sui wallet keys
          and PEM private keys. It can't recognise every kind of secret, so keep passwords and other keys out of your memories
          yourself. Save where a secret lives instead: <i>“The Paystack key is in Vercel env as PAYSTACK_SECRET.”</i>
        </P>
      </>
    ),
  },
  {
    id: 'keys',
    category: 'Concepts',
    title: 'Personal, teams & keys',
    description: 'Who can see a memory, and how each app gets in.',
    toc: [
      { id: 'personal-team', label: 'Personal and team memory' },
      { id: 'kinds', label: 'Kinds of keys' },
      { id: 'permissions', label: 'Permissions' },
    ],
    content: (
      <>
        <H id="personal-team">Personal and team memory</H>
        <P>
          Personal memory is yours alone. A team has its own memory, separate from each member's personal memory. Create a team
          on the Teams page and invite people by email; they need an Engram account with that address. Free teams have 3 seats.
        </P>
        <P>A team key always works in its team. A personal key uses your personal memory unless the app asks for the team.</P>
        <H id="kinds">Kinds of keys</H>
        <Table
          head={['Key', 'Where it comes from', 'Lifetime']}
          rows={[
            ['Personal or team key', 'Keys page', 'Until you revoke it'],
            ['Computer key', <C>npx engram-walrus login</C>, 'Until you revoke it or log out'],
            ['Connector', 'Approving an app with Sign in with Engram', 'Renews itself every 7 days while in use'],
            ['Link', 'Keys page, for apps that only accept a URL', '30 days'],
          ]}
        />
        <P>
          Engram stores a fingerprint of each key, never the key itself, so it can't show you a key again later. Copy it when you
          create it.
        </P>
        <H id="permissions">Permissions</H>
        <Table
          head={['Permission', 'Can', "Can't"]}
          rows={[
            ['Read & write', 'Save, recall, tidy, handoffs and snapshots', '—'],
            ['Read only', 'Recall, recent, get', 'Save anything'],
            ['Save only', 'Save new memories', 'Read anything back (good for shortcuts and share buttons)'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'recall',
    category: 'Concepts',
    title: 'How recall works',
    description: 'Search that copes with how people actually ask.',
    toc: [
      { id: 'matching', label: 'What matches' },
      { id: 'ranking', label: 'Ranking' },
    ],
    content: (
      <>
        <H id="matching">What matches</H>
        <P>Recall searches every memory in your personal or team space, not just the newest ones:</P>
        <Bullets
          items={[
            <><b className="text-txt">Word forms:</b> “deploying” finds “deploy”, “databases” finds “database”.</>,
            <><b className="text-txt">Beginnings of words:</b> “postg” finds “Postgres”.</>,
            <><b className="text-txt">Typos:</b> close misspellings still match.</>,
            <>
              <b className="text-txt">Related words:</b> when fewer than three memories match, a small language model suggests
              related terms (“payment provider” → “Paystack”) and the search runs again. Only your search words are sent, never
              your memories.
            </>,
          ]}
        />
        <H id="ranking">Ranking</H>
        <P>
          Results are ordered by how well they match, newest first among equals. When a new decision replaces an old one, the old
          one drops out of recall; ask for replaced memories to see the history. Recall never counts against your daily limit.
        </P>
      </>
    ),
  },
  {
    id: 'tools',
    category: 'Concepts',
    title: 'MCP tools',
    description: 'What connected apps can call.',
    toc: [
      { id: 'list', label: 'Tools' },
      { id: 'transport', label: 'Endpoint' },
    ],
    content: (
      <>
        <H id="list">Tools</H>
        <Table
          head={['Tool', 'Arguments', 'Does']}
          rows={[
            [<C>engram_remember</C>, 'text, type, scope?, team_code?', 'Save one durable fact'],
            [<C>engram_recall</C>, 'query, scope?, team_code?', 'Find the memories that match'],
            [<C>engram_recent</C>, 'limit?, type?, include_replaced?', 'Newest memories first'],
            [<C>engram_get</C>, 'id', 'One memory by id'],
            [<C>engram_whoami</C>, '—', "Account, key, scope, expiry and today's usage"],
            [<C>engram_tidy</C>, 'scope?', 'Report likely duplicates and replaced memories'],
            [<C>engram_handoff</C>, 'action (record, latest, resume_brief), notes…', 'Pass work between agents'],
            [<C>engram_snapshot</C>, 'action (generate, restore, brief)', "Save or restore a project's context"],
          ]}
        />
        <H id="transport">Endpoint</H>
        <P>
          The hosted server speaks MCP over HTTP at <C>{MCP_URL}</C> and supports OAuth sign-in. The npm package runs the same
          tools locally over stdio and forwards each call to the hosted server.
        </P>
      </>
    ),
  },
  {
    id: 'limits',
    category: 'Account',
    title: 'Plans & limits',
    description: 'Both plans are free for now.',
    toc: [{ id: 'table', label: 'Limits' }],
    content: (
      <>
        <H id="table">Limits</H>
        <Table
          head={['', 'Personal', 'Team']}
          rows={[
            ['Price', 'Free', 'Free'],
            ['Saves per day', '50', '150, shared'],
            ['People', '1', 'Up to 3'],
            ['Recall', 'Not counted', 'Not counted'],
            ['Built-in chat', '100 messages a day', '100 messages a day'],
            ['Memory length', '4,000 characters', '4,000 characters'],
          ]}
        />
        <P>
          Limits reset at midnight UTC. Bigger teams and higher limits will come with a paid plan later;{' '}
          <a href={`${REPO}/issues/new?title=Plan%20request`} target="_blank" rel="noreferrer" className="text-rose hover:underline">
            tell us what you need
          </a>
          .
        </P>
      </>
    ),
  },
  {
    id: 'security',
    category: 'Account',
    title: 'Security & privacy',
    description: 'How Engram protects your account and what you control.',
    toc: [
      { id: 'protect', label: 'What Engram does' },
      { id: 'control', label: 'What you control' },
      { id: 'report', label: 'Reporting a problem' },
    ],
    content: (
      <>
        <H id="protect">What Engram does</H>
        <Bullets
          items={[
            'Keys are stored as fingerprints, so a database leak would not reveal them.',
            'Every request is checked against the key’s owner, team and permission.',
            'Text that looks like an API key or private key is refused before it is saved.',
            'Sign-in and sign-up are rate limited.',
            'Save links opened in a browser ask before saving, so link previews can’t write memories.',
            'All traffic is encrypted in transit.',
          ]}
        />
        <H id="control">What you control</H>
        <Bullets
          items={[
            'Give each app its own key, limit it to read-only or save-only, and revoke it on its own.',
            'Export your memories as Markdown or JSON from the Memories page.',
            'Change your password, disconnect every app at once, or delete your whole account from the Settings page.',
            'Delete single memories from the Memories page.',
          ]}
        />
        <H id="report">Reporting a problem</H>
        <P>
          Please report security issues privately through{' '}
          <a href={`${REPO}/security/advisories/new`} target="_blank" rel="noreferrer" className="text-rose hover:underline">
            GitHub
          </a>
          , not in a public issue. Read the <Link to="/privacy" className="text-rose hover:underline">Privacy Policy</Link> and{' '}
          <Link to="/terms" className="text-rose hover:underline">Terms</Link>.
        </P>
      </>
    ),
  },
  {
    id: 'troubleshooting',
    category: 'Account',
    title: 'Troubleshooting',
    description: 'The problems people hit most, and the fix for each.',
    toc: [
      { id: 'unauthorized', label: '“Unauthorized”' },
      { id: 'missing', label: 'Recall finds nothing' },
      { id: 'old-setup', label: 'Older setups' },
      { id: 'help', label: 'Still stuck' },
    ],
    content: (
      <>
        <H id="unauthorized">“Unauthorized” or “key invalid”</H>
        <P>
          Run <C>npx engram-walrus doctor</C>: it names the key in use and why it fails. Link keys expire after 30 days and
          revoked keys stop at once. Run <C>npx engram-walrus login</C> to give the computer a fresh key, or reconnect the app
          from the dashboard.
        </P>
        <H id="missing">Recall finds nothing</H>
        <P>
          Check the scope. Memories saved with a team key live in the team, not in your personal memory. Ask the app to call{' '}
          <C>engram_whoami</C>, or look on the dashboard's Memories page with the matching scope selected.
        </P>
        <H id="old-setup">Older setups</H>
        <P>
          Configs made with <C>--key=…</C> or version 0.1 of the package may point at the wrong place. Run{' '}
          <C>npx engram-walrus init</C>: it finds those entries, backs them up and replaces them.
        </P>
        <H id="help">Still stuck</H>
        <P>
          <a href={`${REPO}/issues`} target="_blank" rel="noreferrer" className="text-rose hover:underline">
            Open an issue on GitHub
          </a>{' '}
          with what you ran and what you saw. Leave keys out of it.
        </P>
      </>
    ),
  },
]

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function DocsPage() {
  const [params, setParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const requested = params.get('a')
  const activeArticle = ARTICLES.find((a) => a.id === requested) ?? ARTICLES[0]

  useEffect(() => {
    document.title = `${activeArticle.title} · Engram docs`
    return () => {
      document.title = 'Engram'
    }
  }, [activeArticle])

  const open = (id: string) => {
    setParams(id === ARTICLES[0].id ? {} : { a: id }, { replace: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return ARTICLES
    return ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.toc.some((t) => t.label.toLowerCase().includes(q)),
    )
  }, [searchQuery])

  const categories = useMemo(() => {
    const map = new Map<string, DocArticle[]>()
    filtered.forEach((a) => map.set(a.category, [...(map.get(a.category) || []), a]))
    return Array.from(map.entries())
  }, [filtered])

  const idx = ARTICLES.findIndex((a) => a.id === activeArticle.id)
  const prev = idx > 0 ? ARTICLES[idx - 1] : null
  const next = idx < ARTICLES.length - 1 ? ARTICLES[idx + 1] : null

  return (
    <div className="flex min-h-screen flex-col justify-between bg-bg text-txt">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-1/4 h-[600px] w-[600px] rounded-full bg-violet/10 blur-[140px]" />
        <div className="absolute top-1/2 -left-40 h-[500px] w-[500px] rounded-full bg-rose/10 blur-[140px]" />
      </div>

      <Nav />

      <div className="border-b border-line/80 bg-surface/30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 text-xs">
          <div className="flex min-w-0 items-center gap-2 text-faint">
            <Link to="/" className="transition hover:text-txt">Engram</Link>
            <ChevronRight size={13} className="shrink-0" />
            <button onClick={() => open(ARTICLES[0].id)} className="transition hover:text-txt">Docs</button>
            <ChevronRight size={13} className="shrink-0" />
            <span className="truncate font-medium text-rose">{activeArticle.title}</span>
          </div>
          <Link to="/dashboard?tab=connect" className="hidden shrink-0 items-center gap-1 text-mut transition hover:text-rose sm:flex">
            Connect guides <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">
        <div className="mb-6 space-y-2 lg:hidden">
          <label htmlFor="doc-topic" className="block font-mono text-xs uppercase text-mut">Topic</label>
          <select
            id="doc-topic"
            value={activeArticle.id}
            onChange={(e) => open(e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface/80 p-3 text-sm text-txt focus:border-rose/50"
          >
            {ARTICLES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.category} — {a.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[260px_1fr_200px]">
          <aside className="sticky top-[72px] hidden max-h-[calc(100vh-5.5rem)] space-y-5 overflow-y-auto pb-24 pr-3 lg:block">
            <div className="sticky top-0 z-10 bg-bg/95 pb-2 pt-1 backdrop-blur-md">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type="search"
                  aria-label="Search the docs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search the docs"
                  className="w-full rounded-2xl border border-line bg-surface/70 py-2 pl-9 pr-3 text-xs text-txt shadow-sm transition placeholder:text-faint focus:border-rose/50 focus:outline-none"
                />
              </div>
            </div>

            {categories.length === 0 && <p className="px-2 text-xs text-faint">Nothing matches “{searchQuery}”.</p>}
            {categories.map(([cat, items]) => (
              <div key={cat}>
                <p className="mb-2 px-2 font-mono text-[10.5px] uppercase tracking-wider text-faint">{cat}</p>
                <ul className="space-y-1 text-xs">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => open(item.id)}
                        aria-current={activeArticle.id === item.id ? 'page' : undefined}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                          activeArticle.id === item.id
                            ? 'border-rose/30 bg-rose/15 font-medium text-rose shadow-sm'
                            : 'border-transparent text-mut hover:border-line/40 hover:bg-surface/40 hover:text-txt'
                        }`}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="space-y-1.5 border-t border-line/60 px-2 pt-4 text-xs text-mut">
              <Link to="/dashboard?tab=connect" className="flex items-center gap-1.5 text-rose hover:underline">Dashboard guides →</Link>
              <a href={NPM} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 transition hover:text-rose">
                npm package <ExternalLink size={11} className="text-faint" />
              </a>
              <a href={REPO} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 transition hover:text-rose">
                GitHub <ExternalLink size={11} className="text-faint" />
              </a>
            </div>
          </aside>

          <main id="main" className="min-w-0 max-w-3xl">
            <div className="mb-8 border-b border-line/80 pb-6">
              <span className="font-mono text-xs uppercase tracking-wider text-rose">{activeArticle.category}</span>
              <h1 className="mb-3 mt-1 text-3xl font-display text-txt sm:text-4xl">{activeArticle.title}</h1>
              <p className="text-sm leading-relaxed text-mut sm:text-base">{activeArticle.description}</p>
            </div>

            <div className="space-y-5">{activeArticle.content}</div>

            <div className="mt-14 flex items-center justify-between gap-4 border-t border-line/80 pt-8">
              {prev ? (
                <button
                  onClick={() => open(prev.id)}
                  className="flex items-center gap-2 rounded-2xl border border-line bg-surface/30 px-4 py-3 text-left text-xs text-mut transition hover:border-rose/40 hover:text-txt"
                >
                  <ArrowLeft size={14} className="text-rose" />
                  <span>
                    <span className="block font-mono text-[10px] uppercase text-faint">Previous</span>
                    <span className="font-medium text-txt">{prev.title}</span>
                  </span>
                </button>
              ) : (
                <div />
              )}
              {next && (
                <button
                  onClick={() => open(next.id)}
                  className="ml-auto flex items-center gap-2 rounded-2xl border border-line bg-surface/30 px-4 py-3 text-right text-xs text-mut transition hover:border-rose/40 hover:text-txt"
                >
                  <span>
                    <span className="block font-mono text-[10px] uppercase text-faint">Next</span>
                    <span className="font-medium text-txt">{next.title}</span>
                  </span>
                  <ArrowRight size={14} className="text-rose" />
                </button>
              )}
            </div>
          </main>

          <aside className="sticky top-[72px] hidden max-h-[calc(100vh-5.5rem)] space-y-6 overflow-y-auto pb-24 pl-2 lg:block">
            <div>
              <p className="mb-3 font-mono text-[10.5px] uppercase tracking-wider text-faint">On this page</p>
              <ul className="space-y-2 text-xs">
                {activeArticle.toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="block leading-relaxed text-mut transition hover:text-rose">
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2.5 rounded-2xl border border-line glass p-4">
              <p className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-rose">Need help?</p>
              <p className="text-[11.5px] leading-relaxed text-mut">Ask on GitHub. Report security problems privately.</p>
              <a href={`${REPO}/issues`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-txt transition hover:text-rose">
                Issues <ExternalLink size={11} />
              </a>
              <a href={`${REPO}/security/advisories/new`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-txt transition hover:text-rose">
                Security report <ExternalLink size={11} />
              </a>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  )
}
