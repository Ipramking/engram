import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Lock, Users, GitBranch, Settings2, TriangleAlert, UserRound, Star,
  Link2, Check, Sparkles, Download, ClipboardList, ArrowRight, Smartphone,
  Laptop, Terminal, Shield, Zap, ExternalLink, KeyRound, Cpu, Layers, Copy,
  CheckCircle2, ChevronRight, Server, Radio, ArrowUpRight
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
    d: 'An architectural choice and the underlying reason.',
    ex: '“Moved DB to Neon Postgres on Aug 3 — Render free tier expired.”',
    tag: 'ARCHITECTURE',
    c: 'from-violet/25',
  },
  {
    icon: Settings2,
    t: 'Config',
    d: 'A concrete setup value, port, or where an env variable lives.',
    ex: '“DATABASE_URL is set in Render dashboard env, not in .env file.”',
    tag: 'INFRASTRUCTURE',
    c: 'from-sky-400/20',
  },
  {
    icon: TriangleAlert,
    t: 'Gotcha',
    d: 'A non-obvious engineering pitfall and its tested fix.',
    ex: '“Chromium sticky breaks with overflow-x: hidden; use overflow-x: clip.”',
    tag: 'DEFENSIVE CODE',
    c: 'from-amber-400/20',
  },
  {
    icon: UserRound,
    t: 'Person',
    d: 'A stable fact about a teammate, lead, or client preference.',
    ex: '“Ada leads frontend, prefers Tailwind v4, in WAT timezone.”',
    tag: 'TEAM COLLAB',
    c: 'from-rose/25',
  },
  {
    icon: Star,
    t: 'Preference',
    d: 'A lasting coding preference, UX principle, or design rule.',
    ex: '“User wants every UI to work seamlessly on both phone and desktop.”',
    tag: 'DESIGN RULE',
    c: 'from-pink-400/20',
  },
  {
    icon: ClipboardList,
    t: 'Plan',
    d: 'A multi-step spec, task list, or continuous working roadmap.',
    ex: '“Launch plan: 1) Ship MCP gateway, 2) Commit Walrus blobs, 3) Open signups.”',
    tag: 'EXECUTION',
    c: 'from-emerald-400/20',
  },
]

export default function App() {
  useReveal()

  return (
    <div className="relative min-h-screen bg-bg text-txt">
      <Nav />
      <Hero />
      <Marquee />
      <FrictionMatrix />
      <Taxonomy />
      <AgentOSProtocol />
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
    <header className="relative mx-auto max-w-6xl px-5 pt-8 pb-16 sm:pt-20 sm:pb-24">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-violet/20 via-rose/15 to-transparent blur-3xl opacity-70" />
      </div>

      <div className="relative z-10 grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <div data-reveal className="min-w-0">
          {/* Telemetry pill */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-[11px] font-mono text-mut backdrop-blur-md">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-txt font-semibold">WALRUS MAINNET</span>
            <span className="text-line-2">|</span>
            <span className="text-rose">SEAL-256 CIPHER</span>
            <span className="text-line-2">|</span>
            <span className="text-emerald-400">OPERATIONAL</span>
          </div>

          <h1 className="mt-6 text-[2.7rem] leading-[1.03] sm:text-[4.2rem] sm:leading-[1.02] tracking-tight">
            Permanent memory for your <span className="text-gradient italic">autonomous agents</span>.
          </h1>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-mut sm:text-[18px]">
            Engram decouples agent knowledge from ephemeral chat sessions. Save a technical choice during
            mobile brainstorming on Claude, recall it automatically in Cursor on your laptop, and sync
            team conventions across every developer in your pod.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/register"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose to-violet px-7 py-3.5 text-center text-sm font-medium text-bg shadow-lg shadow-violet/20 transition hover:opacity-95 sm:w-auto"
            >
              Get started free
              <span className="grid h-5 w-5 place-items-center rounded-full bg-black/15 transition group-hover:translate-x-0.5">
                <ArrowRight size={13} />
              </span>
            </Link>

            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3.5 text-center text-sm text-txt transition hover:border-rose/50 hover:bg-surface/40 sm:w-auto"
            >
              Open Dashboard
            </Link>

            <button
              onClick={() => downloadText('engram-memory-prompt.txt', ENGRAM_PROMPT)}
              className="inline-flex items-center justify-center gap-2 px-3 py-3 text-xs font-mono text-mut transition hover:text-rose sm:justify-start"
            >
              <Download size={14} /> System Prompt (.txt)
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-5 text-xs font-mono text-faint">
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400" /> 50 Saves/Day Free
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400" /> 3-Member Free Team
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400" /> Cryptographic Proofs
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400" /> Zero-Install MCP
            </span>
          </div>
        </div>

        {/* Interactive Live Memory Pipeline Simulator */}
        <div data-reveal className="relative">
          <HeroSimulator />
        </div>
      </div>
    </header>
  )
}

function HeroSimulator() {
  const [activeScenario, setActiveScenario] = useState(0)

  const scenarios = [
    {
      title: 'Mobile → Laptop IDE',
      source: 'Claude iOS (Mobile)',
      sourceIcon: Smartphone,
      target: 'Cursor (Work Laptop)',
      targetIcon: Laptop,
      input: '“We switched auth to Supabase Admin createUser to bypass unconfigured SMTP domain checks.”',
      type: 'decision',
      scope: 'personal',
      blobId: '2iD9wFtosZo0AwOEmEmHWyjWw6T_gOuY899xrqU2qdI',
      query: '“Why is registration failing on test emails?”',
      recall: '“Per your note: use supabaseAdmin.auth.admin.createUser({ email_confirm: true }) to bypass SMTP blocks.”',
    },
    {
      title: 'Bug Gotcha → Zero Regress',
      source: 'Antigravity CLI (Terminal)',
      sourceIcon: Terminal,
      target: 'Claude Desktop',
      targetIcon: Laptop,
      input: '“In Chromium, overflow-x: hidden on body breaks position: sticky; use overflow-x: clip instead.”',
      type: 'gotcha',
      scope: 'personal',
      blobId: '7XqP2kLM1n9aBbCcDdEeFfGgHhIiJjKkLlMmNnOoPp',
      query: '“Sidebar moves when user scrolls the page”',
      recall: '“Gotcha: Replace overflow-x: hidden with overflow-x: clip on html, body to restore sticky nav.”',
    },
    {
      title: 'Team Stack Rule → Sync',
      source: 'Tech Lead (Sarah)',
      sourceIcon: Users,
      target: 'New Engineer (Alex)',
      targetIcon: Laptop,
      input: '“All API keys must follow format eng_usr_<hash> or eng_team_<hash> with SHA-256 validation.”',
      type: 'config',
      scope: 'team',
      blobId: '9WvT4sRQ3m8zYxWvUtSrQpOnMlKjIhGfEdCbAz',
      query: '“How do we structure new service tokens?”',
      recall: '“Team convention: Keys use eng_ prefix with SHA-256 HMAC and SHA-256 lookup in api_keys table.”',
    },
  ]

  const current = scenarios[activeScenario]

  return (
    <div className="relative mx-auto max-w-lg">
      {/* Glow aura */}
      <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-rose/25 via-violet/20 to-transparent blur-2xl" />

      {/* Double-Bezel Hardware Wrapper */}
      <div className="rounded-[2.2rem] border border-line/80 bg-surface/40 p-2 shadow-2xl shadow-black/80 backdrop-blur-xl">
        <div className="rounded-[1.7rem] border border-line bg-bg/95 p-5 sm:p-6 shadow-inner">
          {/* Header Scenario Switcher */}
          <div className="flex items-center justify-between border-b border-line/70 pb-3 mb-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-faint flex items-center gap-1.5">
              <Radio size={13} className="text-rose animate-pulse" /> Live Memory Protocol
            </span>
            <div className="flex gap-1 bg-surface/60 rounded-xl p-1 border border-line/60">
              {scenarios.map((s, idx) => (
                <button
                  key={s.title}
                  onClick={() => setActiveScenario(idx)}
                  className={`px-2.5 py-1 text-[10.5px] font-mono rounded-lg transition ${
                    activeScenario === idx
                      ? 'bg-rose/15 text-rose font-medium border border-rose/30'
                      : 'text-mut hover:text-txt'
                  }`}
                >
                  0{idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Step 1: Ingestion */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-mut">
              <span className="flex items-center gap-1.5 text-txt">
                <current.sourceIcon size={13} className="text-rose" /> {current.source}
              </span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-faint border border-line">
                WRITE PIPELINE
              </span>
            </div>

            <div className="rounded-2xl border border-line/80 bg-surface/50 p-3 text-xs text-txt leading-relaxed font-sans">
              {current.input}
            </div>

            {/* Step 2: Protocol Engine */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/60 bg-bg p-2.5 text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                <Brain size={14} className="text-rose" />
                <span className="rounded bg-rose/15 px-1.5 py-0.5 text-[10px] uppercase text-rose font-medium">
                  {current.type}
                </span>
                <span className="text-faint">·</span>
                <span className="text-mut capitalize">{current.scope}</span>
              </div>
              <a
                href={`https://walruscan.com/mainnet/blob/${PROOF_BLOB}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-faint hover:text-rose transition"
              >
                <span>Blob: {current.blobId.slice(0, 8)}…</span>
                <ExternalLink size={10} />
              </a>
            </div>

            {/* Connecting visual beam */}
            <div className="relative py-1 flex items-center justify-center">
              <div className="h-6 w-[1.5px] bg-gradient-to-b from-rose to-violet" />
            </div>

            {/* Step 3: IDE Zero-Effort Recall */}
            <div className="flex items-center justify-between text-[11px] font-mono text-mut">
              <span className="flex items-center gap-1.5 text-txt">
                <current.targetIcon size={13} className="text-violet-soft" /> {current.target}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> RECALLED
              </span>
            </div>

            <div className="rounded-2xl border border-violet/30 bg-violet/[0.08] p-3 text-xs text-violet-100 leading-relaxed font-sans">
              <p className="text-[11px] font-mono text-violet-300/80 mb-1">Agent Query: {current.query}</p>
              <p className="text-txt font-medium">{current.recall}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Marquee() {
  const tools = [
    'Cursor', 'Claude Desktop', 'ChatGPT Mobile', 'VS Code', 'Antigravity CLI',
    'Claude iOS', 'Windsurf', 'Walrus Storage', 'Sui Network', 'GitHub Actions',
    'OpenCode', 'Zed Editor', 'Docker Dev Environments'
  ]
  const row = [...tools, ...tools]
  return (
    <div className="relative overflow-hidden border-y border-line/80 py-4 bg-surface/20">
      <div className="flex w-max gap-12 whitespace-nowrap" style={{ animation: 'marquee 40s linear infinite' }}>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-3 font-display text-base text-mut/80">
            {t} <Sparkles size={11} className="text-rose/40" />
          </span>
        ))}
      </div>
    </div>
  )
}

function FrictionMatrix() {
  const comparisons = [
    {
      feature: 'Session Boundaries',
      without: 'Context evaporates after 10 minutes or window refresh; zero memory across chats.',
      withEngram: 'Infinite lifetime. Memories are persisted to Walrus and recalled semantically weeks later.',
    },
    {
      feature: 'Cross-Device Portability',
      without: 'Siloed on one laptop. Mobile brainstorming cannot reach your IDE without copy-pasting.',
      withEngram: 'Universal Streamable HTTP MCP. Save on iOS/Android, recall in Cursor, CLI, and desktop.',
    },
    {
      feature: 'Engineering Pod Sync',
      without: 'Every teammate repeats questions: “What port was the DB?”, “How do we deploy?”.',
      withEngram: 'Shared Team Brain. Decisions & configs sync across all developers in real time.',
    },
    {
      feature: 'Cryptographic Provenance',
      without: 'Stored in black-box corporate silos subject to silent model fine-tuning and deletion.',
      withEngram: 'Seal-encrypted, immutable Walrus blobs with decentralized provenance verified on Sui.',
    },
  ]

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <div data-reveal className="mb-14 text-center max-w-2xl mx-auto">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">The Core Difference</p>
        <h2 className="text-3xl sm:text-5xl font-display">Why agents forget, and how Engram fixes it.</h2>
        <p className="mt-4 text-base sm:text-lg text-mut">
          LLMs are stateless engines. Engram provides the durable long-term cortex they’ve been missing.
        </p>
      </div>

      <div data-reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {comparisons.map((c, i) => (
          <div
            key={c.feature}
            style={{ transitionDelay: `${i * 60}ms` }}
            className="rounded-3xl border border-line bg-surface/30 p-6 flex flex-col justify-between"
          >
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-rose">{c.feature}</span>
              
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-200/90 leading-relaxed">
                <span className="block font-mono text-[10px] uppercase text-rose-400 font-semibold mb-1">
                  ✕ Without Engram
                </span>
                {c.without}
              </div>

              <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-xs text-emerald-200/90 leading-relaxed">
                <span className="block font-mono text-[10px] uppercase text-emerald-400 font-semibold mb-1">
                  ✓ With Engram
                </span>
                {c.withEngram}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Taxonomy() {
  return (
    <section id="taxonomy" className="mx-auto max-w-6xl px-5 py-16">
      <div data-reveal className="mb-12 max-w-2xl">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Signal, not noise</p>
        <h2 className="text-3xl sm:text-5xl font-display">Six high-signal memory types.</h2>
        <p className="mt-4 text-base sm:text-lg text-mut">
          Engram filters out throwaway banter and captures structured engineering signal.
          Recall operates semantically — matching by concept rather than exact keywords.
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
            <div className="flex items-center justify-between mb-4">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-bg/60 text-rose">
                <m.icon size={19} />
              </div>
              <span className="rounded-full border border-line/60 bg-surface px-2.5 py-0.5 font-mono text-[10px] tracking-wider text-faint uppercase">
                {m.tag}
              </span>
            </div>
            <h3 className="text-xl font-display text-txt">{m.t}</h3>
            <p className="mt-1.5 text-xs sm:text-sm text-mut leading-relaxed">{m.d}</p>
            <p className="mt-4 border-t border-line/70 pt-3 font-mono text-[11px] leading-relaxed text-faint">
              {m.ex}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AgentOSProtocol() {
  const layers = [
    {
      num: 'LAYER 01',
      title: 'Agent Interfaces',
      desc: 'Cursor, Claude Desktop, ChatGPT Mobile, Antigravity, and Terminal CLI communicate via JSON-RPC 2.0.',
      badge: 'Zero-Install MCP',
    },
    {
      num: 'LAYER 02',
      title: 'Streamable HTTP Gateway',
      desc: 'Bearer tokens route to isolated personal (usr_) or team (team_) namespaces with quota enforcement.',
      badge: 'Multi-Tenant Router',
    },
    {
      num: 'LAYER 03',
      title: 'Seal Cryptographic Engine',
      desc: 'Client-held or host-held keys encrypt memory payloads before any blob is broadcast to network nodes.',
      badge: 'Seal-256 Encryption',
    },
    {
      num: 'LAYER 04',
      title: 'Walrus & Sui Network',
      desc: 'Epoch-based decentralized storage nodes guarantee permanent durability with Sui-anchored verification.',
      badge: 'Immutable Blobs',
    },
  ]

  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <div data-reveal className="mb-14 max-w-2xl">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Agent-OS Architecture</p>
        <h2 className="text-3xl sm:text-5xl font-display">Decentralized memory stack.</h2>
        <p className="mt-4 text-base sm:text-lg text-mut">
          Engineered like an operating system: modular client transports, cryptographic namespaces, and decentralized persistence.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {layers.map((l, i) => (
          <div
            key={l.num}
            data-reveal
            style={{ transitionDelay: `${i * 70}ms` }}
            className="rounded-3xl border border-line bg-surface/30 p-6 flex flex-col justify-between relative overflow-hidden"
          >
            <div>
              <span className="font-mono text-xs text-rose uppercase tracking-wider">{l.num}</span>
              <h3 className="mt-3 text-xl font-display text-txt">{l.title}</h3>
              <p className="mt-2 text-xs sm:text-sm text-mut leading-relaxed">{l.desc}</p>
            </div>
            <div className="mt-6 border-t border-line/60 pt-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-faint">
                <CheckCircle2 size={12} className="text-emerald-400" /> {l.badge}
              </span>
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
          <p className="text-xs text-faint">Decentralized proof anchored on Sui mainnet.</p>
        </div>
        <a
          href={`https://walruscan.com/mainnet/blob/${PROOF_BLOB}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-4 py-2 font-mono text-xs text-rose transition hover:border-rose/50"
        >
          {PROOF_BLOB.slice(0, 10)}… · view on Walruscan <ExternalLink size={12} />
        </a>
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
      "args": ["-y", "engram-walrus", "--key=YOUR_API_KEY", "--room=my-space"]
    }
  }
}`,
    gemini: `# Google Gemini CLI & Antigravity (MCP)
mcp_servers:
  engram:
    url: "https://engram-pearl.vercel.app/mcp?token=YOUR_API_KEY&room=my-space"

# Or create a custom Gem at gemini.google.com/gems for 1-tap memory sync!`,
    antigravity: `# Antigravity IDE & Gemini CLI Configuration
mcp_servers:
  engram:
    url: "https://engram-pearl.vercel.app/mcp?token=YOUR_API_KEY&room=my-space"`,
    cli: `# Direct terminal execution (or CI/CD pipelines)
npx engram-walrus --key=YOUR_API_KEY --room=my-space`,
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(configs[tab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="platforms" className="mx-auto max-w-6xl px-5 py-16">
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
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <pre className="text-mut leading-relaxed">{configs[tab]}</pre>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-faint font-mono">
          <span>Get your live token on the dashboard in 1 click.</span>
          <Link to="/register" className="text-rose hover:underline flex items-center gap-1">
            Generate Free Key <ArrowRight size={12} />
          </Link>
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
                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span><strong>50 memory saves</strong> per day</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span>1 user account & personal API keys</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span>Cross-device sync (Mobile, Desktop, CLI)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
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
                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span><strong>Maximum 3 team members</strong></span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span><strong>150 shared saves</strong> per day</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span>1 shared team memory pool</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span>Role controls (Owner, Member)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
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
                <span><strong>5,000 saves</strong> per day</span>
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
