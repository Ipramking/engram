import { useMemo, useState } from 'react'
import { Terminal, Monitor, Code2, Globe, Smartphone, Copy, Check, Download, ArrowRight, User, Users, KeyRound, Rocket } from 'lucide-react'
import { ENGRAM_PROMPT, downloadText } from '../lib/promptText'

const REPO = 'https://github.com/Ipramking/engram'
const ENDPOINT = 'https://engram-mcp.onrender.com'
const URL = `${ENDPOINT}/mcp?token=<TOKEN>&room=<team>`
const NPX = `{ "mcpServers": { "engram": { "command": "npx", "args": ["-y", "engram-walrus"] } } }`
const LOGIN = `npx engram-walrus login   # one-time browser sign-in — your own private Walrus account`

type Cat = 'CLI' | 'App' | 'IDE' | 'Web' | 'Mobile'
type Client = {
  id: string; name: string; cat: Cat; icon: any; blurb: string
  local: string | null // stdio config (personal); null = can't run locally
  remote: string // url config (team)
  lang?: 'json' | 'toml' | 'sh'
  uiNote?: string
}

const CLIENTS: Client[] = [
  {
    id: 'claude-code', name: 'Claude Code', cat: 'CLI', icon: Terminal, blurb: 'Anthropic’s terminal agent',
    local: `claude mcp add engram -- npx -y engram-walrus`,
    remote: `claude mcp add --transport http engram "${URL}"`,
    uiNote: 'Then run /mcp to confirm the engram_* tools are listed.',
  },
  {
    id: 'claude-desktop', name: 'Claude Desktop', cat: 'App', icon: Monitor, blurb: 'The Claude app (Mac / Windows)',
    local: `{
  "mcpServers": {
    "engram": { "command": "npx", "args": ["-y", "engram-walrus"] }
  }
}`,
    remote: `{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${URL}"]
    }
  }
}`,
    uiNote: 'Merge into claude_desktop_config.json (Settings → Developer → Edit Config), then fully quit & reopen. Remote also works via Settings → Connectors.',
  },
  {
    id: 'cursor', name: 'Cursor', cat: 'IDE', icon: Code2, blurb: 'AI-first code editor',
    local: NPX,
    remote: `{ "mcpServers": { "engram": { "url": "${URL}" } } }`,
    uiNote: 'Edit ~/.cursor/mcp.json (or Settings → Tools & MCP), then reload.',
  },
  {
    id: 'vscode', name: 'VS Code', cat: 'IDE', icon: Code2, blurb: 'Copilot agent mode',
    local: `{ "servers": { "engram": { "type": "stdio", "command": "npx", "args": ["-y", "engram-walrus"] } } }`,
    remote: `{ "servers": { "engram": { "type": "http", "url": "${URL}" } } }`,
    uiNote: 'Put it in .vscode/mcp.json, then open Copilot Chat in Agent mode.',
  },
  {
    id: 'antigravity', name: 'Antigravity', cat: 'IDE', icon: Code2, blurb: 'Google’s agentic IDE',
    local: NPX,
    remote: `{ "mcpServers": { "engram": { "url": "${URL}" } } }`,
    uiNote: 'Command Palette → “MCP”, or edit %APPDATA%\\Antigravity\\User\\mcp.json, then reload.',
  },
  {
    id: 'windsurf', name: 'Windsurf', cat: 'IDE', icon: Code2, blurb: 'Codeium’s agentic IDE',
    local: NPX,
    remote: `{ "mcpServers": { "engram": { "serverUrl": "${URL}" } } }`,
    uiNote: 'Settings → Cascade → MCP Servers → Add, then refresh.',
  },
  {
    id: 'codex', name: 'Codex', cat: 'CLI', icon: Terminal, blurb: 'OpenAI’s terminal agent', lang: 'toml',
    local: `[mcp_servers.engram]
command = "npx"
args = ["-y", "engram-walrus"]`,
    remote: `[mcp_servers.engram]
command = "npx"
args = ["-y", "mcp-remote", "${URL}"]`,
    uiNote: 'Add to ~/.codex/config.toml, then restart Codex.',
  },
  {
    id: 'gemini', name: 'Gemini CLI', cat: 'CLI', icon: Terminal, blurb: 'Google’s terminal agent',
    local: NPX,
    remote: `{ "mcpServers": { "engram": { "httpUrl": "${URL}" } } }`,
    uiNote: 'Add to ~/.gemini/settings.json, then run /mcp to verify.',
  },
  {
    id: 'chatgpt', name: 'ChatGPT', cat: 'Web', icon: Globe, blurb: 'Web & desktop connectors',
    local: null,
    remote: URL,
    uiNote: 'Settings → Connectors (Developer mode) → Add → Model Context Protocol → paste the URL. Needs a Plus/Pro/Team plan.',
  },
  {
    id: 'mobile', name: 'Mobile', cat: 'Mobile', icon: Smartphone, blurb: 'Claude / ChatGPT apps',
    local: null,
    remote: URL,
    uiNote: 'In the app: Settings → Connectors → Add custom connector → paste the URL. If unavailable, connect on desktop with the same account — the memory is shared.',
  },
]

const CATS: (Cat | 'All')[] = ['All', 'CLI', 'App', 'IDE', 'Web', 'Mobile']

function CodeBlock({ code }: { code: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="relative mt-2 rounded-xl border border-line bg-bg/60">
      <pre className="overflow-x-auto p-3.5 pr-11 font-mono text-[12px] leading-relaxed whitespace-pre text-txt/90">{code}</pre>
      <button
        onClick={() => { navigator.clipboard?.writeText(code); setDone(true); setTimeout(() => setDone(false), 1300) }}
        className="absolute right-2 top-2 rounded-md border border-line bg-surface p-1.5 text-mut transition hover:border-rose/50 hover:text-rose"
        aria-label="Copy"
      >
        {done ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  )
}

export default function Setup() {
  const [mode, setMode] = useState<'personal' | 'team'>('personal')
  const [cat, setCat] = useState<Cat | 'All'>('All')
  const [active, setActive] = useState('claude-code')
  const list = useMemo(() => (cat === 'All' ? CLIENTS : CLIENTS.filter((c) => c.cat === cat)), [cat])
  const client = CLIENTS.find((c) => c.id === active)!

  return (
    <section id="setup" className="mx-auto max-w-6xl px-5 py-24">
      <div data-reveal className="mb-8 text-center">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Set it up</p>
        <h2 className="text-4xl sm:text-5xl">Connect it to any AI.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-mut">
          Use it solo for your own private memory, or spin up a shared team. Pick your setup, choose your
          tool, follow the exact steps — then paste the prompt.
        </p>
      </div>

      {/* mode toggle */}
      <div data-reveal className="mb-8 flex justify-center">
        <div className="flex rounded-full border border-line bg-surface/50 p-1">
          {([['personal', User, 'Just me'], ['team', Users, 'My team']] as const).map(([m, Icon, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm transition ${mode === m ? 'bg-gradient-to-r from-rose to-violet text-bg font-medium' : 'text-mut hover:text-txt'}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* mode intro panel */}
      <div data-reveal className="mb-8">
        {mode === 'personal' ? <PersonalIntro /> : <TeamIntro />}
      </div>

      {/* download prompt */}
      <div data-reveal className="mb-10 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => downloadText('engram-prompt.txt', ENGRAM_PROMPT)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose to-violet px-5 py-2.5 text-sm font-medium text-bg transition hover:opacity-90"
        >
          <Download size={16} /> Download the prompt
        </button>
        <CopyPrompt />
      </div>

      {/* selector + steps */}
      <div data-reveal className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-xs transition ${cat === c ? 'bg-rose/15 text-rose ring-1 ring-rose/30' : 'text-faint hover:text-txt'}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {list.map((c) => {
              const Icon = c.icon
              const on = c.id === active
              const na = mode === 'personal' && !c.local
              return (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${on ? 'border-rose/50 bg-surface shadow-lg shadow-black/30' : 'border-line bg-surface/40 hover:border-line-2'}`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${on ? 'border-rose/40 bg-rose/10 text-rose' : 'border-line bg-bg/40 text-mut'}`}>
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-txt">{c.name}</span>
                    <span className="block truncate text-[11px] text-faint">{na ? 'needs a hosted endpoint' : c.blurb}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-line glass p-6 sm:p-7">
          <Steps key={`${client.id}-${mode}`} client={client} mode={mode} />
        </div>
      </div>
    </section>
  )
}

function Steps({ client, mode }: { client: Client; mode: 'personal' | 'team' }) {
  const na = mode === 'personal' && !client.local
  const code = mode === 'personal' ? client.local! : client.remote
  return (
    <div className="step-in">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-rose/40 bg-rose/10 text-rose"><client.icon size={19} /></span>
        <div>
          <h3 className="text-xl leading-none">{client.name}</h3>
          <p className="mt-1 text-xs text-faint">{client.cat} · {mode === 'personal' ? 'private, on your machine' : 'shared team · one URL'}</p>
        </div>
        <span className="ml-auto rounded-full border border-line px-2.5 py-1 font-mono text-[10.5px] text-faint">{mode === 'personal' ? 'local · your account' : 'remote · one URL'}</span>
      </div>

      {na ? (
        <div className="rounded-2xl border border-line bg-bg/40 p-5 text-sm leading-relaxed text-mut">
          <b className="text-txt">{client.name}</b> can’t run a local server. Deploy your own endpoint (it works
          solo too — switch to <b className="text-rose">My team</b> above and follow “Create your team,” using
          it just for yourself), then add the URL here.
        </div>
      ) : (
        <ol className="space-y-4">
          <li className="step-in flex gap-3">
            <Num n={1} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-txt/90">
                {mode === 'personal'
                  ? 'Sign in once — opens a browser and creates your own private Walrus account. No install, no token:'
                  : 'Grab your team URL from “Create your team” above (your token + a room name).'}
              </p>
              {mode === 'personal' && <CodeBlock code={LOGIN} />}
            </div>
          </li>
          <li className="step-in flex gap-3" style={{ animationDelay: '70ms' }}>
            <Num n={2} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-txt/90">Add it to {client.name}:</p>
              <CodeBlock code={code} />
              {client.uiNote && <p className="mt-2 text-xs leading-relaxed text-faint">{client.uiNote}</p>}
            </div>
          </li>
          <li className="step-in flex gap-3" style={{ animationDelay: '140ms' }}>
            <Num n={3} />
            <p className="flex-1 text-sm leading-relaxed text-txt/90">Restart {client.name} and confirm the <span className="font-mono text-rose/80">engram_*</span> tools appear.</p>
          </li>
          <li className="step-in flex gap-3" style={{ animationDelay: '210ms' }}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-rose/40 bg-rose/10 text-rose"><ArrowRight size={13} /></span>
            <p className="flex-1 text-sm leading-relaxed text-txt/90">
              Paste the <button onClick={() => downloadText('engram-prompt.txt', ENGRAM_PROMPT)} className="text-rose underline decoration-rose/40 underline-offset-2 hover:decoration-rose">Engram prompt</button> into the agent’s rules. Now just talk — it remembers.
            </p>
          </li>
        </ol>
      )}
    </div>
  )
}

function Num({ n }: { n: number }) {
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-bg/50 font-mono text-[11px] text-rose">{n}</span>
}

function PersonalIntro() {
  return (
    <div className="rounded-3xl border border-line glass p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-rose/40 bg-rose/10 text-rose"><User size={19} /></span>
        <div>
          <h3 className="text-xl leading-none">Just me — your own private memory</h3>
          <p className="mt-1.5 text-sm text-mut">Runs on your machine under your own Walrus account. Nothing shared, nothing hosted.</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-mut">
        Connect Engram to every AI on your computer and they all share <b className="text-txt">your</b> memory —
        store a fact in Claude Code, recall it in Cursor. Desktop, IDE and CLI tools connect locally below.
        Want it on your phone too? That needs a hosted endpoint — switch to <b className="text-rose">My team</b> and
        run it solo.
      </p>
    </div>
  )
}

function TeamIntro() {
  const genToken = `node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"`
  const url = `${ENDPOINT}/mcp?token=<YOUR_TOKEN>&room=acme-eng`
  const steps = [
    { icon: Rocket, t: 'Deploy the endpoint (free)', d: 'Fork the repo, then Render → New → Blueprint → pick your fork. It reads render.yaml and builds in ~2 min. (Or use a shared demo endpoint for quick tests.)' },
    { icon: KeyRound, t: 'Generate a team token', d: 'A shared secret that gates your endpoint. Run this, then set it as ENGRAM_TEAM_TOKEN in Render:', code: genToken },
    { icon: User, t: 'Point it at a Walrus account', d: 'Set ENGRAM_CREDS_JSON in Render to the contents of ~/.memwal/credentials.json (run pnpm login:memwal first). This is the account the team’s memories live on.' },
    { icon: Users, t: 'Pick a room name', d: 'Any string — one team can have many rooms (frontend, hackathon…). That’s your team URL:', code: url },
  ]
  return (
    <div className="rounded-3xl border border-line glass p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-rose/40 bg-rose/10 text-rose"><Users size={19} /></span>
        <div>
          <h3 className="text-xl leading-none">Create your team</h3>
          <p className="mt-1.5 text-sm text-mut">One shared endpoint = one shared memory. Set it up once, then share the URL.</p>
        </div>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={i} className="rounded-2xl border border-line bg-bg/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-bg/40 text-rose"><s.icon size={15} /></span>
              <span className="font-mono text-[11px] text-faint">Step {i + 1}</span>
            </div>
            <p className="text-sm font-medium text-txt">{s.t}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-mut">{s.d}</p>
            {s.code && <CodeBlock code={s.code} />}
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-faint">
        Share the finished URL with teammates — they just paste it into their AI (steps below), no install.
        Full deploy guide: <a href={`${REPO}/blob/main/mcp/ENDPOINT.md`} target="_blank" rel="noreferrer" className="text-rose/80 hover:text-rose">mcp/ENDPOINT.md</a>.
      </p>
    </div>
  )
}

function CopyPrompt() {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(ENGRAM_PROMPT); setDone(true); setTimeout(() => setDone(false), 1400) }}
      className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm text-txt transition hover:border-rose/50"
    >
      {done ? <Check size={16} /> : <Copy size={16} />} {done ? 'Copied' : 'Copy prompt'}
    </button>
  )
}
