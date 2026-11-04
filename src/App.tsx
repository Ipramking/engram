import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Lock, Users, GitBranch, Settings2, TriangleAlert, UserRound, Star,
  Link2, Check, Sparkles, Download, ClipboardList, ArrowRight, Smartphone,
  Laptop, Terminal, ExternalLink, Copy
} from 'lucide-react'
import { Nav, Footer } from './components/Chrome'
import { ENGRAM_PROMPT, downloadText } from './lib/promptText'

const PROOF_BLOB = '2iD9wFtosZo0AwOEmEmHWyjWw6T_gOuY899xrqU2qdI'

function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'))
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

const MEM_TYPES = [
  {
    icon: GitBranch,
    t: 'Decision',
    d: 'An architectural choice and the reason behind it.',
    ex: '“Moved DB to Neon Postgres on Aug 3 — Render free tier expired.”',
    c: 'from-violet/25',
  },
  {
    icon: Settings2,
    t: 'Config',
    d: 'A concrete setup value, port, or where a secret lives.',
    ex: '“DATABASE_URL is set in Render dashboard env, not .env.”',
    c: 'from-violet-soft/20',
  },
  {
    icon: TriangleAlert,
    t: 'Gotcha',
    d: 'A non-obvious pitfall and its tested workaround.',
    ex: '“supabase CLI has no win32 binary — use the standalone .exe.”',
    c: 'from-rose/20',
  },
  {
    icon: UserRound,
    t: 'Person',
    d: 'A stable fact about a teammate, lead, or client.',
    ex: '“Ada leads frontend, prefers Tailwind v4, WAT timezone.”',
    c: 'from-rose/25',
  },
  {
    icon: Star,
    t: 'Preference',
    d: 'A lasting engineering preference, style, or rule.',
    ex: '“Every UI must work seamlessly on both phone and desktop.”',
    c: 'from-violet/20',
  },
  {
    icon: ClipboardList,
    t: 'Plan',
    d: 'A spec, multi-step task list, or sprint roadmap.',
    ex: '“Launch plan: 1) Ship MCP, 2) Verify Walrus blobs, 3) Open signups.”',
    c: 'from-rose-deep/20',
  },
]

const PLATFORMS = [
  {
    icon: Smartphone,
    title: 'Mobile Workflows',
    subtitle: 'Claude, ChatGPT & Google Gemini',
    description: 'Save insights on the go during mobile brainstorming. Everything is instantly synced to your cloud memory for laptop and CLI recall.',
    tag: 'Mobile Ready',
  },
  {
    icon: Laptop,
    title: 'IDEs & Desktop AIs',
    subtitle: 'Cursor, Claude Desktop, VS Code',
    description: 'Connect natively using Streamable HTTP MCP. Your code-assistant automatically recalls your stack rules without re-prompting.',
    tag: 'Native MCP',
  },
  {
    icon: Terminal,
    title: 'CLI & Developer Agents',
    subtitle: 'npx engram-walrus, Antigravity, Windsurf',
    description: 'Run the verified npm package in your terminal or CI pipelines. Works in headless agents and automated coding workflows.',
    tag: 'Verified NPM',
  },
  {
    icon: Users,
    title: 'Shared Team Brains',
    subtitle: 'Collaborative engineering workspaces',
    description: 'Team members read and write a shared memory pool. Onboard new developers in minutes without repeating architectural context.',
    tag: 'Team Isolation',
  },
]

export default function App() {
  useReveal()

  return (
    <div className="relative min-h-screen">
      <Nav />
      <Hero />
      <Marquee />
      <Problem />
      <Taxonomy />
      <HowItWorks />
      <Platforms />
      <QuickConnectPreview />
      <TeamIsolation />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}

function Hero() {
  return (
    <header className="relative mx-auto max-w-6xl px-5 pt-10 pb-16 sm:pt-24 sm:pb-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <div data-reveal className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-3 py-1 text-xs text-mut">
            <Sparkles size={13} className="text-rose" />
            <span>Decentralized Cross-Platform Memory · Backed by Walrus</span>
          </div>

          <h1 className="mt-6 text-[2.6rem] leading-[1.04] sm:text-[4.2rem] sm:leading-[1.02]">
            Never re-explain<br />
            your stack <span className="text-gradient italic">again</span>.
          </h1>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-mut sm:text-[18px]">
            Engram gives your AI agents a persistent, portable memory across mobile, desktop, and CLI.
            Save a decision on your phone in Claude or Gemini, recall it in Cursor on your laptop, and share context
            seamlessly across your engineering team.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/register"
              className="rounded-full bg-gradient-to-r from-rose to-violet px-7 py-3.5 text-center text-sm font-medium text-bg shadow-lg shadow-violet/20 transition hover:opacity-90 sm:w-auto"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3.5 text-center text-sm text-txt transition hover:border-rose/50 sm:w-auto"
            >
              Go to Dashboard <ArrowRight size={15} />
            </Link>
            <button
              onClick={() => downloadText('engram-memory-prompt.txt', ENGRAM_PROMPT)}
              className="inline-flex items-center justify-center gap-2 px-2 py-3 text-sm text-mut transition hover:text-rose sm:justify-start"
            >
              <Download size={15} /> System Prompt
            </button>
          </div>

          <div className="mt-8 flex items-center gap-6 text-xs font-mono text-faint">
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-rose" /> Free Personal Plan
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-rose" /> 3-Member Free Team
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-rose" /> Seal Encrypted
            </span>
          </div>
        </div>

        <div data-reveal className="relative">
          <HeroCard />
        </div>
      </div>
    </header>
  )
}

function HeroCard() {
  return (
    <div className="relative mx-auto max-w-sm sm:max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-rose/20 via-violet/15 to-transparent blur-3xl" />
      <div className="animate-float rounded-3xl border border-line glass p-6 shadow-2xl shadow-black/70">
        <div className="flex items-center justify-between mb-3 border-b border-line/60 pb-2.5">
          <span className="font-mono text-[11px] text-faint flex items-center gap-1.5">
            <Smartphone size={12} className="text-rose" /> Claude iOS · memory written
          </span>
          <span className="flex items-center gap-1 text-[11px] text-violet-soft font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-soft animate-pulse" /> synced
          </span>
        </div>

        <div className="rounded-2xl border border-violet/30 bg-violet/10 px-4 py-3 text-sm text-txt leading-relaxed">
          “We moved the database to Neon Postgres because Render free tier expired. Connection string in dashboard env.”
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-rose/30 bg-rose/[0.07] px-3.5 py-2.5">
          <Brain size={16} className="text-rose" />
          <span className="rounded-full border border-violet/30 bg-violet/15 px-2 py-0.5 text-[10px] tracking-wider text-violet-200 uppercase font-mono">
            decision
          </span>
          <span className="ml-auto font-mono text-[11px] text-faint">Walrus blob: 2iD9wF…</span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line/80 pt-3">
          <span className="font-mono text-[11px] text-mut flex items-center gap-1.5">
            <Laptop size={13} className="text-violet-soft" /> Cursor recall: “db setup?”
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-rose font-medium">
            <Check size={13} /> Active in IDE
          </span>
        </div>
      </div>

      <div
        className="absolute -right-2 -top-4 inline-flex rotate-6 items-center gap-1.5 rounded-2xl border border-line glass px-3.5 py-2 text-xs text-mut animate-float shadow-lg sm:-right-4"
        style={{ animationDelay: '1.5s' }}
      >
        <Users size={13} className="text-violet-soft" /> Team Shared
      </div>
      <div
        className="absolute -left-2 bottom-6 inline-flex -rotate-6 items-center gap-1.5 rounded-2xl border border-line glass px-3.5 py-2 text-xs text-mut animate-float shadow-lg sm:-left-5"
        style={{ animationDelay: '0.8s' }}
      >
        <Lock size={13} className="text-rose" /> Personal Memory
      </div>
    </div>
  )
}

function Marquee() {
  const tools = [
    'Cursor', 'Claude Desktop', 'ChatGPT Mobile', 'Google Gemini', 'VS Code', 'Antigravity CLI',
    'Claude iOS', 'Windsurf', 'Walrus Storage', 'Sui Network', 'GitHub Actions'
  ]
  const row = [...tools, ...tools]
  return (
    <div className="relative overflow-hidden border-y border-line/80 py-4.5 bg-surface/20">
      <p className="mb-2.5 text-center text-[10.5px] tracking-widest text-faint uppercase font-mono">
        One unified memory across every platform you use
      </p>
      <div className="flex w-max gap-12 whitespace-nowrap" style={{ animation: 'marquee 36s linear infinite' }}>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-3 font-display text-lg text-mut/80">
            {t} <Sparkles size={12} className="text-rose/50" />
          </span>
        ))}
      </div>
    </div>
  )
}

function Problem() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div data-reveal>
          <span className="font-mono text-xs text-rose uppercase tracking-widest">The Core Problem</span>
          <h2 className="mt-3 text-3xl leading-tight sm:text-5xl font-display">
            Every new session,<br />
            your agent starts from <span className="text-mut italic">scratch</span>.
          </h2>
        </div>
        <div data-reveal className="space-y-4 text-base sm:text-lg leading-relaxed text-mut">
          <p>
            You painstakingly explain your architecture, environment configurations, and quirks in one chat.
            Ten minutes later, in Cursor or on your phone, you have to explain it all over again.
          </p>
          <p>
            Engram separates memory from the ephemeral chat session. Stored securely on Walrus, memories
            persist forever, belong to you, and travel across every AI client you connect.
          </p>
        </div>
      </div>
    </section>
  )
}

function Taxonomy() {
  return (
    <section id="taxonomy" className="mx-auto max-w-6xl px-5 py-16">
      <div data-reveal className="mb-12 max-w-2xl">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Signal, not noise</p>
        <h2 className="text-3xl sm:text-5xl font-display">What Engram remembers.</h2>
        <p className="mt-4 text-base sm:text-lg text-mut">
          Never spam or throwaway chatter. Engram captures structured, durable facts worth reusing weeks later
          and recalls them semantically — matching by concept rather than just keywords.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MEM_TYPES.map((m, i) => (
          <div
            key={m.t}
            data-reveal
            style={{ transitionDelay: `${i * 60}ms` }}
            className="group relative overflow-hidden rounded-3xl border border-line bg-surface/30 p-6 transition hover:border-rose/40 hover:bg-surface/50"
          >
            <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${m.c} to-transparent opacity-0 blur-2xl transition group-hover:opacity-100`} />
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-line bg-bg/60 text-rose">
              <m.icon size={19} />
            </div>
            <h3 className="text-xl font-display text-txt">{m.t}</h3>
            <p className="mt-1.5 text-xs sm:text-sm text-mut leading-relaxed">{m.d}</p>
            <p className="mt-4 border-t border-line/70 pt-3 font-mono text-[11.5px] leading-relaxed text-faint">
              {m.ex}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Durable Capture',
      desc: 'As you work, your connected AI recognizes important facts (or captures explicit plans on request) and calls engram_remember.',
    },
    {
      num: '02',
      title: 'Seal-Encrypted on Walrus',
      desc: 'Each memory is encrypted with Seal and committed to Walrus as a verifiable, decentralized blob anchored on Sui.',
    },
    {
      num: '03',
      title: 'Zero-Effort Recall',
      desc: 'Open any AI client, phone, or IDE weeks later. The agent automatically retrieves relevant context before answering.',
    },
  ]

  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <div data-reveal className="mb-14 max-w-2xl">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Architecture</p>
        <h2 className="text-3xl sm:text-5xl font-display">Remember once. Recall everywhere.</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.num}
            data-reveal
            style={{ transitionDelay: `${i * 80}ms` }}
            className="rounded-3xl border border-line bg-surface/30 p-7 flex flex-col justify-between"
          >
            <div>
              <span className="font-display text-5xl text-gradient">{s.num}</span>
              <h3 className="mt-5 text-2xl font-display text-txt">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mut">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div data-reveal className="mt-8 flex flex-wrap items-center gap-4 rounded-3xl border border-line glass p-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-bg/60 text-rose">
          <Link2 size={19} />
        </span>
        <div>
          <p className="text-sm font-medium text-txt">Every memory is an immutable, verifiable Walrus blob.</p>
          <p className="text-xs text-faint">Cryptographically verified on Sui mainnet.</p>
        </div>
        <a
          href={`https://walruscan.com/mainnet/blob/${PROOF_BLOB}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-4 py-2 font-mono text-xs text-rose transition hover:border-rose/50"
        >
          {PROOF_BLOB.slice(0, 10)}… · inspect on Walruscan <ExternalLink size={12} />
        </a>
      </div>
    </section>
  )
}

function Platforms() {
  return (
    <section id="platforms" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <div data-reveal className="mb-14 max-w-2xl">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Cross-Platform</p>
        <h2 className="text-3xl sm:text-5xl font-display">Built for your entire workflow.</h2>
        <p className="mt-4 text-base sm:text-lg text-mut">
          Not just desktop or terminal. Engram connects all the surfaces where you interact with AI.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {PLATFORMS.map((p, i) => (
          <div
            key={p.title}
            data-reveal
            style={{ transitionDelay: `${i * 70}ms` }}
            className="rounded-3xl border border-line bg-surface/30 p-7 hover:border-line-2 transition"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-bg/60 text-rose">
                <p.icon size={22} />
              </div>
              <span className="rounded-full border border-line bg-surface/50 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-mut">
                {p.tag}
              </span>
            </div>
            <h3 className="text-2xl font-display text-txt">{p.title}</h3>
            <p className="font-mono text-xs text-rose mt-1 mb-3">{p.subtitle}</p>
            <p className="text-sm leading-relaxed text-mut">{p.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function QuickConnectPreview() {
  const [tab, setTab] = useState<'cursor' | 'claude' | 'gemini' | 'antigravity' | 'cli'>('cursor')
  const [copied, setCopied] = useState(false)

  const configs = {
    cursor: `{
  "mcpServers": {
    "engram": {
      "url": "https://engram-pearl.vercel.app/mcp?token=YOUR_API_KEY&room=my-space"
    }
  }
}`,
    claude: `{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://engram-pearl.vercel.app/mcp?token=YOUR_API_KEY&room=my-space"]
    }
  }
}`,
    gemini: `// ~/.gemini/settings.json (Gemini CLI)
{
  "mcpServers": {
    "engram": { "httpUrl": "https://engram-pearl.vercel.app/mcp?token=YOUR_API_KEY&room=my-space" }
  }
}

# Or create a custom Gem at gemini.google.com/gems for 1-tap memory sync!`,
    antigravity: `// Antigravity: Agent panel → MCP Servers → View raw config
{
  "mcpServers": {
    "engram": { "command": "npx", "args": ["-y", "mcp-remote", "https://engram-pearl.vercel.app/mcp?token=YOUR_API_KEY&room=my-space"] }
  }
}`,
    cli: `# Direct terminal execution (or CI/CD pipelines)
ENGRAM_API_KEY=YOUR_API_KEY npx -y engram-walrus@0.2`,
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(configs[tab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="connect" className="mx-auto max-w-6xl px-5 py-16">
      <div data-reveal className="rounded-3xl border border-line glass p-7 sm:p-10 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-rose">Zero-Friction Setup</p>
            <h2 className="text-2xl sm:text-3xl font-display text-txt mt-1">Connect in 30 seconds.</h2>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-surface/70 rounded-2xl p-1.5 border border-line/80">
            {(['cursor', 'claude', 'gemini', 'antigravity', 'cli'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-mono rounded-xl transition uppercase ${
                  tab === t
                    ? 'bg-rose/15 text-rose font-medium border border-rose/30'
                    : 'text-mut hover:text-txt'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="relative rounded-2xl border border-line/90 bg-bg p-4 font-mono text-xs text-txt overflow-x-auto">
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 flex items-center gap-1.5 rounded-xl border border-line bg-surface/80 px-3 py-1.5 text-xs text-mut hover:text-txt transition"
          >
            {copied ? <Check size={13} className="text-rose" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <pre className="text-mut leading-relaxed">{configs[tab]}</pre>
        </div>
      </div>
    </section>
  )
}

function TeamIsolation() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div data-reveal>
          <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Security & Separation</p>
          <h2 className="text-3xl sm:text-5xl font-display leading-tight">
            Personal memory stays private.<br />
            Team memory is shared.
          </h2>
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-mut">
            Every memory is strictly partitioned by cryptographic namespaces. Your personal API keys access
            only your private notes, preferences, and personal facts.
          </p>
          <p className="mt-3 text-base sm:text-lg leading-relaxed text-mut">
            Switching to team scope allows all authorized teammates to read architectural decisions,
            stack configurations, and team roles without copying tokens manually.
          </p>
          <div className="mt-7 flex gap-4">
            <Link
              to="/register"
              className="rounded-full bg-gradient-to-r from-rose to-violet px-5 py-2.5 text-xs font-medium text-bg shadow hover:opacity-90"
            >
              Create Free Workspace
            </Link>
          </div>
        </div>

        <div data-reveal className="space-y-4">
          <div className="rounded-3xl border border-rose/30 bg-rose/[0.04] p-6">
            <div className="flex items-center gap-2.5 text-rose mb-2">
              <Lock size={18} />
              <h4 className="font-display text-lg text-txt">Personal Memory Scope</h4>
            </div>
            <p className="text-xs sm:text-sm text-mut leading-relaxed">
              Bound to <code className="text-rose font-mono">usr_&lt;id&gt;</code>. Private credentials, personal preferences,
              individual workflow notes. Never visible to teammates.
            </p>
          </div>

          <div className="rounded-3xl border border-violet/30 bg-violet/[0.04] p-6">
            <div className="flex items-center gap-2.5 text-violet-soft mb-2">
              <Users size={18} />
              <h4 className="font-display text-lg text-txt">Team Memory Scope</h4>
            </div>
            <p className="text-xs sm:text-sm text-mut leading-relaxed">
              Bound to <code className="text-violet-soft font-mono">team_&lt;id&gt;</code>. Shared tech stack decisions,
              conventions, API rules, and team member roles. Accessible to authorized teammates (up to 3 free).
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <div data-reveal className="mb-14 text-center max-w-2xl mx-auto">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Simple Plans</p>
        <h2 className="text-3xl sm:text-5xl font-display">Transparent usage limits.</h2>
        <p className="mt-4 text-base sm:text-lg text-mut">
          Generous free limits for individual builders and small teams. Scale to Pro when you need unlimited capacity.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Personal Free */}
        <div data-reveal className="rounded-3xl border border-line bg-surface/30 p-7 flex flex-col justify-between">
          <div>
            <span className="font-mono text-xs text-rose uppercase tracking-wider">Individual</span>
            <h3 className="mt-2 text-2xl font-display text-txt">Personal Free</h3>
            <p className="mt-4 text-4xl font-display text-txt">$0</p>
            <p className="text-xs text-faint font-mono mt-1 mb-6">Free forever for everyday use</p>
            <ul className="space-y-3 text-xs sm:text-sm text-mut">
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span><strong>50 memory saves</strong> per day</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span>1 user account & personal API keys</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span>Cross-device sync (Mobile, Desktop, CLI)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span>Seal-encrypted Walrus storage</span>
              </li>
            </ul>
          </div>
          <Link
            to="/register"
            className="mt-8 block w-full rounded-full border border-line py-3 text-center text-xs font-medium text-txt hover:border-rose/50 transition"
          >
            Start free
          </Link>
        </div>

        {/* Free Team Plan */}
        <div data-reveal style={{ transitionDelay: '80ms' }} className="rounded-3xl border border-rose/50 bg-surface/60 p-7 flex flex-col justify-between relative shadow-xl shadow-rose/5">
          <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-rose to-violet px-3 py-0.5 text-[10.5px] font-mono uppercase text-bg font-bold">
            Popular
          </span>
          <div>
            <span className="font-mono text-xs text-rose uppercase tracking-wider">Small Teams</span>
            <h3 className="mt-2 text-2xl font-display text-txt">Free Team Plan</h3>
            <p className="mt-4 text-4xl font-display text-txt">$0</p>
            <p className="text-xs text-faint font-mono mt-1 mb-6">For small engineering pods</p>
            <ul className="space-y-3 text-xs sm:text-sm text-mut">
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span><strong>Maximum 3 team members</strong></span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span><strong>150 shared saves</strong> per day</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span>1 shared team memory pool</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span>Role controls (Owner, Member)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span>Team MCP connector endpoints</span>
              </li>
            </ul>
          </div>
          <Link
            to="/register"
            className="mt-8 block w-full rounded-full bg-gradient-to-r from-rose to-violet py-3 text-center text-xs font-medium text-bg shadow hover:opacity-90 transition"
          >
            Create free team
          </Link>
        </div>

        {/* Paid / Enterprise Plan */}
        <div data-reveal style={{ transitionDelay: '160ms' }} className="rounded-3xl border border-line bg-surface/30 p-7 flex flex-col justify-between">
          <div>
            <span className="font-mono text-xs text-violet-soft uppercase tracking-wider">Scale</span>
            <h3 className="mt-2 text-2xl font-display text-txt">Pro & Enterprise</h3>
            <p className="mt-4 text-4xl font-display text-txt">$29</p>
            <p className="text-xs text-faint font-mono mt-1 mb-6">per member / month</p>
            <ul className="space-y-3 text-xs sm:text-sm text-mut">
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span><strong>Unlimited team members</strong></span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span><strong>2,000+ saves</strong> per day</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span>Multiple dedicated team spaces</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span>Permanent multi-epoch Walrus storage</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-rose mt-0.5 shrink-0" />
                <span>Priority relayer & SLA</span>
              </li>
            </ul>
          </div>
          <Link
            to="/register"
            className="mt-8 block w-full rounded-full border border-line py-3 text-center text-xs font-medium text-mut hover:text-txt hover:border-line-2 transition"
          >
            Contact sales
          </Link>
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div data-reveal className="relative rounded-3xl border border-line glass p-8 sm:p-14 text-center overflow-hidden">
        <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-r from-rose/10 via-violet/10 to-transparent blur-3xl pointer-events-none" />
        <h2 className="text-3xl sm:text-5xl font-display text-txt">
          Give your agents a permanent brain today.
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-sm sm:text-base text-mut leading-relaxed">
          Sign up in 30 seconds, grab your API key, and connect your favorite AI chatbot or developer tool.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/register"
            className="w-full sm:w-auto rounded-full bg-gradient-to-r from-rose to-violet px-8 py-3.5 text-sm font-medium text-bg shadow-lg shadow-violet/20 hover:opacity-95 transition"
          >
            Create free account
          </Link>
          <Link
            to="/docs"
            className="w-full sm:w-auto rounded-full border border-line px-6 py-3.5 text-sm font-medium text-txt hover:border-rose/50 transition"
          >
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  )
}
