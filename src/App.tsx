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

const SITE_URL = 'https://engram-pearl.vercel.app'
const MCP_URL = `${SITE_URL}/mcp`
const REPO = 'https://github.com/Ipramking/engram'

const PLATFORMS = [
  {
    icon: Smartphone,
    title: 'On your phone',
    subtitle: 'Claude app, Android share, iPhone Shortcuts',
    description:
      'Add Engram once as a connector on claude.ai and sign in; the Claude phone app uses the same connection. On Android, share any text straight into Engram; on iPhone, a Shortcut does it.',
    tag: 'Sign in with Engram',
  },
  {
    icon: Laptop,
    title: 'Desktop apps & editors',
    subtitle: 'Claude Desktop, Cursor, VS Code, Windsurf',
    description:
      'Run one command. It finds the apps you have installed, asks before changing each one, and backs up every config it touches.',
    tag: 'engram-walrus init',
  },
  {
    icon: Terminal,
    title: 'Terminal agents',
    subtitle: 'Claude Code, Gemini CLI, Codex',
    description:
      'The same setup gives Claude Code memory rules and a short brief at the start of every session, so it opens already knowing your stack.',
    tag: 'Session brief',
  },
  {
    icon: Users,
    title: 'Teams',
    subtitle: 'One shared memory, separate from personal',
    description:
      'Teammates read and write one pool of decisions, configs and conventions. Give each app only what it needs: a key can be read-only or save-only.',
    tag: 'Scoped keys',
  },
]

const CONNECT_TABS = [
  {
    id: 'chat',
    label: 'Claude & ChatGPT',
    note: 'No key to paste. Add the link as a custom connector, click Connect, sign in to Engram and approve.',
    display: `# Claude:  Settings → Connectors → Add custom connector
# ChatGPT: Settings → Apps & Connectors → Developer mode → Create
${MCP_URL}`,
    copy: MCP_URL,
  },
  {
    id: 'terminal',
    label: 'Desktop & terminal',
    note: 'Approve this computer once, then add Engram to Claude Code, Claude Desktop, Cursor, VS Code, Windsurf, Gemini CLI and Codex.',
    display: `npx engram-walrus login    # approve this computer in your browser
npx engram-walrus init     # add Engram to the apps it finds
npx engram-walrus doctor   # check the key, server and scope`,
    copy: 'npx engram-walrus login\nnpx engram-walrus init',
  },
  {
    id: 'mcp',
    label: 'Any MCP app',
    note: 'After login, any app that can run a local MCP command uses this config. It contains no secret.',
    display: `{
  "mcpServers": {
    "engram": { "command": "npx", "args": ["-y", "engram-walrus"] }
  }
}`,
    copy: `{
  "mcpServers": {
    "engram": { "command": "npx", "args": ["-y", "engram-walrus"] }
  }
}`,
  },
  {
    id: 'http',
    label: 'Scripts & shortcuts',
    note: 'Use a save-only key here: it can add memories but never read them.',
    display: `curl -X POST ${SITE_URL}/api/remember \\
  -H "Authorization: Bearer $ENGRAM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Staging uses Neon, production uses Supabase","type":"config"}'`,
    copy: `curl -X POST ${SITE_URL}/api/remember \\
  -H "Authorization: Bearer $ENGRAM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Staging uses Neon, production uses Supabase","type":"config"}'`,
  },
] as const

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
            <span>One memory for Claude, ChatGPT, your editor and terminal</span>
          </div>

          <h1 className="mt-6 text-[2.6rem] leading-[1.04] sm:text-[4.2rem] sm:leading-[1.02]">
            Never re-explain<br />
            your stack <span className="text-gradient italic">again</span>.
          </h1>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-mut sm:text-[18px]">
            Engram gives your AI tools one memory that follows you. Save a decision from Claude on your phone,
            recall it in Cursor on your laptop, and share the context your team keeps re-explaining.
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

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-faint">
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-rose" /> Free for personal use
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-rose" /> Free teams of 3
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-rose" /> Export any time
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
        className="absolute -left-2 -bottom-5 inline-flex -rotate-6 items-center gap-1.5 rounded-2xl border border-line glass px-3.5 py-2 text-xs text-mut animate-float shadow-lg sm:-left-5"
        style={{ animationDelay: '0.8s' }}
      >
        <Lock size={13} className="text-rose" /> Personal Memory
      </div>
    </div>
  )
}

function Marquee() {
  const tools = [
    'Claude', 'ChatGPT', 'Claude Code', 'Cursor', 'VS Code', 'Windsurf',
    'Claude Desktop', 'Gemini CLI', 'Codex', 'Antigravity', 'Android share', 'iPhone Shortcuts'
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
            Engram keeps memory outside the chat. Your memories stay in your account until you delete them,
            you can export them whenever you like, and every AI app you connect reads the same set.
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
          No throwaway chatter. Engram keeps typed, durable facts worth reusing weeks later, and finds them again
          when you word the question differently: word forms, typos and related terms all match.
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
      title: 'Capture',
      desc: 'As you work, your AI spots durable facts (or saves what you ask it to) and calls engram_remember. Text that looks like an API key or private key is refused.',
    },
    {
      num: '02',
      title: 'Keep',
      desc: 'Each memory goes into your personal or team space, ready to search straight away. When a new decision contradicts an old one, the old one is marked as replaced.',
    },
    {
      num: '03',
      title: 'Recall',
      desc: 'Weeks later, in any connected app, your AI calls engram_recall before answering. Claude Code can load a short brief at the start of every session.',
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
        <div className="min-w-0">
          <p className="text-sm font-medium text-txt">Engram also keeps copies on Walrus, decentralized storage on Sui.</p>
          <p className="text-xs text-faint">Memories that reached Walrus show a blob id anyone can check. Here is one of ours.</p>
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
  const [tabId, setTabId] = useState<(typeof CONNECT_TABS)[number]['id']>('chat')
  const [copied, setCopied] = useState(false)
  const tab = CONNECT_TABS.find((t) => t.id === tabId) ?? CONNECT_TABS[0]

  const handleCopy = () => {
    navigator.clipboard?.writeText(tab.copy).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => {},
    )
  }

  return (
    <section id="connect" className="mx-auto max-w-6xl px-5 py-16">
      <div data-reveal className="rounded-3xl border border-line glass p-6 sm:p-10 shadow-2xl">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-rose">Setup</p>
            <h2 className="mt-1 text-2xl font-display text-txt sm:text-3xl">Connect in about a minute.</h2>
          </div>
          <div role="tablist" aria-label="Where you use AI" className="flex flex-wrap gap-1.5 rounded-2xl border border-line/80 bg-surface/70 p-1.5">
            {CONNECT_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tabId === t.id}
                onClick={() => {
                  setTabId(t.id)
                  setCopied(false)
                }}
                className={`rounded-xl px-3 py-1.5 text-xs transition ${
                  tabId === t.id ? 'border border-rose/30 bg-rose/15 font-medium text-rose' : 'text-mut hover:text-txt'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-mut">{tab.note}</p>

        <div className="relative rounded-2xl border border-line/90 bg-bg p-4 pr-24 font-mono text-xs text-txt">
          <button
            onClick={handleCopy}
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-xl border border-line bg-surface/80 px-3 py-1.5 text-xs text-mut transition hover:text-txt"
          >
            {copied ? <Check size={13} className="text-rose" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : tab.id === 'chat' ? 'Copy link' : 'Copy'}</span>
          </button>
          <pre className="whitespace-pre-wrap break-all leading-relaxed text-mut sm:whitespace-pre sm:break-normal sm:overflow-x-auto">{tab.display}</pre>
        </div>

        <p className="mt-5 text-xs text-faint">
          Step-by-step guides for 15 apps, with a check that the connection works, are in your{' '}
          <Link to="/dashboard?tab=connect" className="text-rose hover:underline">dashboard</Link>.
        </p>
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
            Every memory belongs to one person or one team, and the server checks that on every request.
            Personal keys reach only your own memory; team keys reach only that team's.
          </p>
          <p className="mt-3 text-base sm:text-lg leading-relaxed text-mut">
            Each app gets its own key, which you can make read-only or save-only and revoke on its own.
            Apps connected with Sign in with Engram show up on your Keys page too.
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
              Only you. Your preferences, personal projects and working notes. Never visible to teammates.
            </p>
          </div>

          <div className="rounded-3xl border border-violet/30 bg-violet/[0.04] p-6">
            <div className="flex items-center gap-2.5 text-violet-soft mb-2">
              <Users size={18} />
              <h4 className="font-display text-lg text-txt">Team Memory Scope</h4>
            </div>
            <p className="text-xs sm:text-sm text-mut leading-relaxed">
              Everyone you invite (3 seats free). Shared stack decisions, conventions, API rules and who owns what.
              Invite people by email from the dashboard.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const PLAN_CARDS = [
  {
    eyebrow: 'Individual',
    name: 'Personal',
    price: 'Free',
    sub: 'Your own memory, in every app',
    points: [
      ['50 saves a day', ', unlimited recall'],
      ['Phone, desktop, editor and terminal', ''],
      ['Read-only and save-only keys', ''],
      ['Export as Markdown or JSON', ''],
    ],
    cta: { label: 'Start free', to: '/register' },
    featured: false,
  },
  {
    eyebrow: 'Small teams',
    name: 'Team',
    price: 'Free',
    sub: 'One shared memory for up to 3 people',
    points: [
      ['Up to 3 people', ''],
      ['150 shared saves a day', ''],
      ['Separate from personal memory', ''],
      ['Owner and member roles', ''],
    ],
    cta: { label: 'Create a free team', to: '/register' },
    featured: true,
  },
  {
    eyebrow: 'Later',
    name: 'Pro',
    price: 'Not yet',
    sub: 'For bigger teams, when they need it',
    points: [
      ['Bigger teams', ''],
      ['Higher daily limits', ''],
      ['Audit log', ''],
      ['Longer Walrus storage', ''],
    ],
    cta: { label: 'Tell us what you need', href: `${REPO}/issues/new?title=Plan%20request` },
    featured: false,
  },
] as const

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <div data-reveal className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-rose">Plans</p>
        <h2 className="text-3xl font-display sm:text-5xl">Free while we grow.</h2>
        <p className="mt-4 text-base text-mut sm:text-lg">
          Personal and team memory are both free. Daily limits reset at midnight UTC, and recall doesn't count against them.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLAN_CARDS.map((p, i) => (
          <div
            key={p.name}
            data-reveal
            style={{ transitionDelay: `${i * 80}ms` }}
            className={`relative flex flex-col justify-between rounded-3xl border p-7 ${
              p.featured ? 'border-rose/50 bg-surface/60 shadow-xl shadow-rose/5' : 'border-line bg-surface/30'
            }`}
          >
            <div>
              <span className={`font-mono text-xs uppercase tracking-wider ${p.name === 'Pro' ? 'text-violet-soft' : 'text-rose'}`}>
                {p.eyebrow}
              </span>
              <h3 className="mt-2 text-2xl font-display text-txt">{p.name}</h3>
              <p className="mt-4 text-4xl font-display text-txt">{p.price}</p>
              <p className="mb-6 mt-1 font-mono text-xs text-faint">{p.sub}</p>
              <ul className="space-y-3 text-xs text-mut sm:text-sm">
                {p.points.map(([strong, rest]) => (
                  <li key={strong} className="flex items-start gap-2.5">
                    <Check size={16} className={`mt-0.5 shrink-0 ${p.name === 'Pro' ? 'text-faint' : 'text-rose'}`} />
                    <span>
                      {rest ? <strong>{strong}</strong> : strong}
                      {rest}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {'to' in p.cta ? (
              <Link
                to={p.cta.to}
                className={`mt-8 block w-full rounded-full py-3 text-center text-xs font-medium transition ${
                  p.featured
                    ? 'bg-gradient-to-r from-rose to-violet text-bg shadow hover:opacity-90'
                    : 'border border-line text-txt hover:border-rose/50'
                }`}
              >
                {p.cta.label}
              </Link>
            ) : (
              <a
                href={p.cta.href}
                target="_blank"
                rel="noreferrer"
                className="mt-8 block w-full rounded-full border border-line py-3 text-center text-xs font-medium text-mut transition hover:border-line-2 hover:text-txt"
              >
                {p.cta.label}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div data-reveal className="relative overflow-hidden rounded-3xl border border-line glass p-8 text-center sm:p-14">
        <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-gradient-to-r from-rose/10 via-violet/10 to-transparent blur-3xl" />
        <h2 className="text-3xl font-display text-txt sm:text-5xl">Give your AI a memory that follows you.</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-mut sm:text-base">
          Create an account, then connect Claude, ChatGPT or your editor. Claude and ChatGPT need no key at all.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="w-full rounded-full bg-gradient-to-r from-rose to-violet px-8 py-3.5 text-sm font-medium text-bg shadow-lg shadow-violet/20 transition hover:opacity-95 sm:w-auto"
          >
            Create free account
          </Link>
          <Link
            to="/docs"
            className="w-full rounded-full border border-line px-6 py-3.5 text-sm font-medium text-txt transition hover:border-rose/50 sm:w-auto"
          >
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  )
}
