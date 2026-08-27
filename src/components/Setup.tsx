import { useMemo, useState } from 'react'
import { Terminal, Monitor, Code2, Globe, Smartphone, Copy, Check, Download, ArrowRight } from 'lucide-react'
import { ENGRAM_PROMPT, downloadText } from '../lib/promptText'

const URL = 'https://engram-mcp.onrender.com/mcp?token=<TOKEN>&room=<team>'

type Cat = 'CLI' | 'App' | 'IDE' | 'Web' | 'Mobile'
type Step = { t: string; code?: string; lang?: string }
type Client = { id: string; name: string; cat: Cat; icon: any; blurb: string; steps: Step[] }

const CLIENTS: Client[] = [
  {
    id: 'claude-code', name: 'Claude Code', cat: 'CLI', icon: Terminal,
    blurb: 'Anthropic’s terminal agent',
    steps: [
      { t: 'Add Engram as a remote MCP server:', code: `claude mcp add --transport http engram "${URL}"` },
      { t: 'Restart Claude Code, then verify the tools are live:', code: `/mcp` },
      { t: 'Drop the Engram prompt into your CLAUDE.md so it knows when to use them (download it below).' },
    ],
  },
  {
    id: 'claude-desktop', name: 'Claude Desktop', cat: 'App', icon: Monitor,
    blurb: 'The Claude app (Mac / Windows)',
    steps: [
      { t: 'Open Settings → Connectors → Add custom connector.' },
      { t: 'Paste the Engram URL and save:', code: URL },
      { t: 'No “Connectors” on your plan? Edit claude_desktop_config.json instead:', code: `{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${URL}"]
    }
  }
}` },
      { t: 'Fully quit and reopen the app.' },
    ],
  },
  {
    id: 'cursor', name: 'Cursor', cat: 'IDE', icon: Code2,
    blurb: 'AI-first code editor',
    steps: [
      { t: 'Settings → Tools & MCP → New MCP server (or edit ~/.cursor/mcp.json):', code: `{
  "mcpServers": {
    "engram": { "url": "${URL}" }
  }
}` },
      { t: 'Reload Cursor — Engram appears under MCP with its three tools.' },
    ],
  },
  {
    id: 'vscode', name: 'VS Code', cat: 'IDE', icon: Code2,
    blurb: 'Copilot agent mode',
    steps: [
      { t: 'Create .vscode/mcp.json in your project:', code: `{
  "servers": {
    "engram": { "type": "http", "url": "${URL}" }
  }
}` },
      { t: 'Open Copilot Chat in Agent mode — the engram tools are available. (Or run “MCP: Add Server” from the Command Palette.)' },
    ],
  },
  {
    id: 'antigravity', name: 'Antigravity', cat: 'IDE', icon: Code2,
    blurb: 'Google’s agentic IDE',
    steps: [
      { t: 'Command Palette (Ctrl/⌘+Shift+P) → search “MCP” → open MCP settings.' },
      { t: 'Add a custom server with the URL, or edit the mcp.json it opens (%APPDATA%\\Antigravity\\User\\mcp.json):', code: `{
  "mcpServers": {
    "engram": { "url": "${URL}" }
  }
}` },
      { t: 'Reload, then ask the agent “what MCP tools do you have?”' },
    ],
  },
  {
    id: 'windsurf', name: 'Windsurf', cat: 'IDE', icon: Code2,
    blurb: 'Codeium’s agentic IDE',
    steps: [
      { t: 'Settings → Cascade → MCP Servers → Add server:', code: `{
  "mcpServers": {
    "engram": { "serverUrl": "${URL}" }
  }
}` },
      { t: 'Refresh MCP servers — Engram’s tools appear in Cascade.' },
    ],
  },
  {
    id: 'codex', name: 'Codex', cat: 'CLI', icon: Terminal,
    blurb: 'OpenAI’s terminal agent',
    steps: [
      { t: 'Codex speaks stdio MCP, so bridge the URL. Edit ~/.codex/config.toml:', code: `[mcp_servers.engram]
command = "npx"
args = ["-y", "mcp-remote", "${URL}"]` },
      { t: 'Restart Codex — the engram tools load on next run.' },
    ],
  },
  {
    id: 'gemini', name: 'Gemini CLI', cat: 'CLI', icon: Terminal,
    blurb: 'Google’s terminal agent',
    steps: [
      { t: 'Edit ~/.gemini/settings.json:', code: `{
  "mcpServers": {
    "engram": { "httpUrl": "${URL}" }
  }
}` },
      { t: 'Launch gemini and run /mcp to confirm.' },
    ],
  },
  {
    id: 'chatgpt', name: 'ChatGPT', cat: 'Web', icon: Globe,
    blurb: 'Web & desktop connectors',
    steps: [
      { t: 'Settings → Connectors (turn on Developer mode if shown) → Add → Model Context Protocol.' },
      { t: 'Paste the Engram URL:', code: URL },
      { t: 'Enable the Engram connector inside a chat. (MCP connectors need a Plus/Pro/Team plan.)' },
    ],
  },
  {
    id: 'mobile', name: 'Mobile', cat: 'Mobile', icon: Smartphone,
    blurb: 'Claude / ChatGPT apps',
    steps: [
      { t: 'Mobile apps connect to a remote MCP the same way: Settings → Connectors → Add custom connector → paste the URL.', code: URL },
      { t: 'If your app doesn’t expose custom connectors yet, connect Engram on desktop with the same account — the memory is shared, so your phone recalls what your laptop stored.' },
    ],
  },
]

const CATS: (Cat | 'All')[] = ['All', 'CLI', 'App', 'IDE', 'Web', 'Mobile']

function CodeBlock({ code }: { code: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="group relative mt-2 rounded-xl border border-line bg-bg/60">
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
  const [cat, setCat] = useState<Cat | 'All'>('All')
  const [active, setActive] = useState('claude-code')
  const list = useMemo(() => (cat === 'All' ? CLIENTS : CLIENTS.filter((c) => c.cat === cat)), [cat])
  const client = CLIENTS.find((c) => c.id === active)!

  return (
    <section id="setup" className="mx-auto max-w-6xl px-5 py-24">
      <div data-reveal className="mb-10 text-center">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Set it up</p>
        <h2 className="text-4xl sm:text-5xl">Connect it to any AI.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-mut">
          Engram works everywhere MCP does. Pick your tool and follow the exact steps — then paste the
          prompt. Store a fact in one AI, recall it in another.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => downloadText('engram-prompt.txt', ENGRAM_PROMPT)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose to-violet px-5 py-2.5 text-sm font-medium text-bg transition hover:opacity-90"
          >
            <Download size={16} /> Download the prompt
          </button>
          <CopyPrompt />
        </div>
      </div>

      <div data-reveal className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* selector */}
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-3 py-1 text-xs transition ${cat === c ? 'bg-rose/15 text-rose ring-1 ring-rose/30' : 'text-faint hover:text-txt'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {list.map((c) => {
              const Icon = c.icon
              const on = c.id === active
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
                    <span className="block truncate text-[11px] text-faint">{c.blurb}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* steps */}
        <div className="rounded-3xl border border-line glass p-6 sm:p-7">
          <div key={client.id} className="step-in">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-rose/40 bg-rose/10 text-rose">
                <client.icon size={19} />
              </span>
              <div>
                <h3 className="text-xl leading-none">{client.name}</h3>
                <p className="mt-1 text-xs text-faint">{client.cat} · {client.blurb}</p>
              </div>
              <span className="ml-auto rounded-full border border-line px-2.5 py-1 font-mono text-[10.5px] text-faint">remote · one URL</span>
            </div>
            <ol className="space-y-4">
              {client.steps.map((s, i) => (
                <li key={i} className="step-in flex gap-3" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-bg/50 font-mono text-[11px] text-rose">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-txt/90">{s.t}</p>
                    {s.code && <CodeBlock code={s.code} />}
                  </div>
                </li>
              ))}
              <li className="step-in flex gap-3" style={{ animationDelay: `${client.steps.length * 70}ms` }}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-rose/40 bg-rose/10 text-rose">
                  <ArrowRight size={13} />
                </span>
                <p className="flex-1 text-sm leading-relaxed text-txt/90">
                  Paste the <button onClick={() => downloadText('engram-prompt.txt', ENGRAM_PROMPT)} className="text-rose underline decoration-rose/40 underline-offset-2 hover:decoration-rose">Engram prompt</button> into the agent’s rules / system prompt. Now just talk — it remembers.
                </p>
              </li>
            </ol>
            <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-faint">
              Replace <span className="font-mono text-rose/80">&lt;TOKEN&gt;</span> with your team token and
              <span className="font-mono text-rose/80"> &lt;team&gt;</span> with a room name. Want your own private
              endpoint? Clone the repo and run it — no token needed for local.
            </p>
          </div>
        </div>
      </div>
    </section>
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
