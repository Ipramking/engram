import { useEffect, useState } from 'react'
import Demo from './components/Demo'

const REPO = 'https://github.com/Ipramking/engram'
const ENDPOINT = 'https://engram-mcp.onrender.com'
const PROOF_BLOB = '2iD9wFtosZo0AwOEmEmHWyjWw6T_gOuY899xrqU2qdI'

// reveal-on-scroll
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

function Copy({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400) }}
      className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-mut transition hover:border-rose/50 hover:text-rose"
    >
      {done ? '✓ Copied' : label}
    </button>
  )
}

const MEM_TYPES = [
  { g: '◆', t: 'Decision', d: 'A choice and the reason behind it.', ex: '“Moved the DB to Neon on Aug 3 — Render free tier expired.”', c: 'from-violet/20' },
  { g: '⚙', t: 'Config', d: 'A concrete value, or where it lives.', ex: '“DATABASE_URL is in the Render env, not .env.”', c: 'from-sky-400/15' },
  { g: '⚠', t: 'Gotcha', d: 'A non-obvious pitfall and its fix.', ex: '“supabase CLI has no win32 binary — use the .exe.”', c: 'from-amber-400/15' },
  { g: '◐', t: 'Person', d: 'A stable fact about a teammate.', ex: '“Ada leads frontend, prefers Tailwind, WAT.”', c: 'from-rose/20' },
  { g: '★', t: 'Preference', d: 'A lasting preference or goal.', ex: '“Every UI must work on phone and desktop.”', c: 'from-pink-400/15' },
]

const STEPS = [
  { n: '01', t: 'It remembers', d: 'As you talk, the agent captures durable facts — following clear rules for what’s worth keeping and what to ignore.' },
  { n: '02', t: 'Stored on Walrus', d: 'Each memory is Seal-encrypted and written to Walrus as a verifiable blob you can inspect on-chain.' },
  { n: '03', t: 'Recalls anywhere', d: 'New session, new device, even a different model — it pulls the right memory back, semantically. No re-explaining.' },
]

const MCP_CONFIG = `{
  "mcpServers": {
    "engram": {
      "url": "${ENDPOINT}/mcp?token=<TEAM_TOKEN>&room=<team>"
    }
  }
}`

export default function App() {
  useReveal()
  return (
    <div className="relative">
      <Nav />
      <Hero />
      <Marquee />
      <Problem />
      <Remembers />
      <How />
      <Team />
      <DemoSection />
      <GetStarted />
      <Footer />
    </div>
  )
}

function Wordmark({ size = 'text-lg' }: { size?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-rose to-violet text-bg shadow-lg shadow-violet/20">
        <span className="font-display text-lg leading-none">E</span>
      </div>
      <span className={`font-display ${size} tracking-tight text-txt`}>Engram</span>
    </div>
  )
}

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on(); window.addEventListener('scroll', on)
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <nav className={`sticky top-0 z-50 transition-colors ${scrolled ? 'border-b border-line glass' : 'border-b border-transparent'}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
        <Wordmark />
        <div className="ml-auto hidden items-center gap-7 text-sm text-mut md:flex">
          <a href="#how" className="transition hover:text-txt">How it works</a>
          <a href="#team" className="transition hover:text-txt">Team</a>
          <a href="#demo" className="transition hover:text-txt">Demo</a>
          <a href={REPO} target="_blank" rel="noreferrer" className="transition hover:text-txt">GitHub ↗</a>
        </div>
        <a href="#start" className="rounded-full bg-gradient-to-r from-rose to-violet px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 md:ml-0">
          Get started
        </a>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <header className="relative mx-auto max-w-6xl px-5 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div data-reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-3 py-1 text-xs text-mut">
            <span className="h-1.5 w-1.5 rounded-full bg-rose" /> Portable memory for AI agents · on Walrus
          </span>
          <h1 className="mt-6 text-[3.1rem] leading-[1.02] sm:text-[4.4rem]">
            Your agent<br />finally <span className="text-gradient italic">remembers</span>.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-mut">
            Engram gives any AI agent a memory it actually keeps — portable across sessions, devices and
            models, <span className="text-txt">verifiable on Walrus</span>, and shareable with your whole team.
            One prompt, any agent. It stops re-asking for context you already gave it.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#demo" className="rounded-full bg-gradient-to-r from-rose to-violet px-6 py-3 text-sm font-medium text-bg transition hover:opacity-90">
              Try the live demo
            </a>
            <a href="#start" className="rounded-full border border-line px-6 py-3 text-sm text-txt transition hover:border-rose/50">
              Add to your agent →
            </a>
          </div>
          <p className="mt-6 font-mono text-xs text-faint">Backed by Walrus · Verifiable on Sui · Seal-encrypted</p>
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
    <div className="relative mx-auto max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-rose/20 via-violet/10 to-transparent blur-2xl" />
      <div className="animate-float rounded-3xl border border-line glass p-5 shadow-2xl shadow-black/50">
        <p className="mb-3 font-mono text-[11px] text-faint">agent · memory written</p>
        <div className="rounded-2xl border border-violet/25 bg-violet/10 px-4 py-3 text-sm text-txt">
          We moved the DB to Neon Postgres today because the Render free tier expired.
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-rose/25 bg-rose/[0.06] px-3 py-2.5">
          <span>🧠</span>
          <span className="rounded-full border border-violet/30 bg-violet/10 px-2 py-0.5 text-[10px] tracking-wide text-violet-200 uppercase">decision</span>
          <span className="ml-auto font-mono text-[10.5px] text-faint">2iD9wF…U2qdI</span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="font-mono text-[11px] text-faint">recall · “db setup?”</span>
          <span className="text-[11px] text-rose">✓ remembered</span>
        </div>
      </div>
      <div className="absolute -right-4 -top-4 rotate-6 rounded-xl border border-line glass px-3 py-1.5 text-[11px] text-mut animate-float" style={{ animationDelay: '1.5s' }}>👥 team scope</div>
      <div className="absolute -left-5 bottom-6 -rotate-6 rounded-xl border border-line glass px-3 py-1.5 text-[11px] text-mut animate-float" style={{ animationDelay: '0.8s' }}>🔒 personal</div>
    </div>
  )
}

function Marquee() {
  const items = ['Backed by Walrus', 'Verifiable on Sui', 'Seal-encrypted', 'Portable across models', 'Personal & team scope', 'One prompt, any agent']
  const row = [...items, ...items]
  return (
    <div className="relative overflow-hidden border-y border-line py-4">
      <div className="flex w-max gap-10 whitespace-nowrap" style={{ animation: 'marquee 34s linear infinite' }}>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-3 font-display text-lg text-faint">
            {t} <span className="text-rose/50">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function Problem() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
        <h2 data-reveal className="text-4xl leading-tight sm:text-5xl">
          Every new session,<br />your agent <span className="text-mut italic">forgets</span> everything.
        </h2>
        <p data-reveal className="text-lg leading-relaxed text-mut">
          You re-explain your stack, your decisions, who’s who — again and again. The context you gave it
          yesterday is gone. Engram fixes the missing piece: a memory that lives outside the chat, on
          Walrus, so it survives every session and travels with you.
        </p>
      </div>
    </section>
  )
}

function Remembers() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div data-reveal className="mb-12 max-w-2xl">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">What it keeps</p>
        <h2 className="text-4xl sm:text-5xl">Signal, not noise.</h2>
        <p className="mt-4 text-lg text-mut">
          Engram only stores durable facts worth reusing weeks later — never secrets, small talk, or
          this-session detail. Five kinds, each tagged and self-contained.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MEM_TYPES.map((m, i) => (
          <div
            key={m.t}
            data-reveal
            style={{ transitionDelay: `${i * 60}ms` }}
            className={`group relative overflow-hidden rounded-3xl border border-line bg-surface/40 p-6 transition hover:border-rose/40`}
          >
            <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${m.c} to-transparent opacity-0 blur-2xl transition group-hover:opacity-100`} />
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-line bg-bg/40 text-lg text-rose">{m.g}</div>
            <h3 className="text-xl">{m.t}</h3>
            <p className="mt-1.5 text-sm text-mut">{m.d}</p>
            <p className="mt-4 border-t border-line pt-3 font-mono text-[12px] leading-relaxed text-faint">{m.ex}</p>
          </div>
        ))}
        <div data-reveal style={{ transitionDelay: '300ms' }} className="grid place-items-center rounded-3xl border border-dashed border-line p-6 text-center">
          <div>
            <p className="font-display text-2xl text-txt">Personal <span className="text-faint">/</span> Team</p>
            <p className="mt-2 text-sm text-mut">Each memory is private to you, or shared with your team’s agents.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function How() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-24">
      <div data-reveal className="mb-14 max-w-2xl">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">How it works</p>
        <h2 className="text-4xl sm:text-5xl">Remember once. Recall forever.</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.n} data-reveal style={{ transitionDelay: `${i * 80}ms` }} className="rounded-3xl border border-line bg-surface/40 p-7">
            <span className="font-display text-5xl text-gradient">{s.n}</span>
            <h3 className="mt-5 text-2xl">{s.t}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-mut">{s.d}</p>
          </div>
        ))}
      </div>
      <div data-reveal className="mt-8 flex flex-wrap items-center gap-4 rounded-3xl border border-line glass p-6">
        <span className="text-2xl">🔗</span>
        <div>
          <p className="text-sm text-txt">Every memory is a real, inspectable Walrus blob.</p>
          <p className="text-xs text-faint">Proof from a live mainnet write.</p>
        </div>
        <a
          href={`https://walruscan.com/mainnet/blob/${PROOF_BLOB}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-full border border-line px-4 py-2 font-mono text-xs text-rose transition hover:border-rose/50"
        >
          {PROOF_BLOB.slice(0, 10)}… · inspect ↗
        </a>
      </div>
    </section>
  )
}

function Team() {
  return (
    <section id="team" className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div data-reveal>
          <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Shared memory</p>
          <h2 className="text-4xl sm:text-5xl">One brain for<br />your whole team.</h2>
          <p className="mt-5 text-lg leading-relaxed text-mut">
            Flip to team scope and every teammate’s agent reads and writes the same pool — shared decisions,
            conventions, who-owns-what. Onboard someone in seconds; nobody re-explains the architecture.
            Personal memory stays private.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-mut">
            {['One URL — no install for teammates', 'Scoped by a room, gated by a token', 'Personal ↔ team, never mixed'].map((f) => (
              <li key={f} className="flex items-center gap-2.5"><span className="text-rose">✦</span>{f}</li>
            ))}
          </ul>
        </div>
        <div data-reveal className="rounded-3xl border border-line glass p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] text-faint">team endpoint · live</span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online</span>
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-line bg-bg/50 p-4 font-mono text-[12px] leading-relaxed text-txt/90">{MCP_CONFIG}</pre>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-xs text-faint">{ENDPOINT}</span>
            <Copy text={MCP_CONFIG} label="Copy config" />
          </div>
        </div>
      </div>
    </section>
  )
}

function DemoSection() {
  return (
    <section id="demo" className="mx-auto max-w-6xl px-5 py-24">
      <div data-reveal className="mb-10 text-center">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Interactive tutorial</p>
        <h2 className="text-4xl sm:text-5xl">See it for yourself.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-mut">
          Follow the guided tour, or just talk to it. Watch durable facts get captured — and recalled —
          in real time.
        </p>
      </div>
      <div data-reveal>
        <Demo />
      </div>
    </section>
  )
}

function GetStarted() {
  const [tab, setTab] = useState<'mcp' | 'web'>('mcp')
  return (
    <section id="start" className="mx-auto max-w-6xl px-5 py-24">
      <div data-reveal className="mb-10 text-center">
        <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Get started</p>
        <h2 className="text-4xl sm:text-5xl">Two minutes to memory.</h2>
      </div>
      <div data-reveal className="mx-auto max-w-3xl">
        <div className="mb-4 flex justify-center gap-2">
          {(['mcp', 'web'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm transition ${tab === t ? 'bg-gradient-to-r from-rose to-violet text-bg font-medium' : 'border border-line text-mut hover:text-txt'}`}
            >
              {t === 'mcp' ? 'In your agent (MCP)' : 'As a web app'}
            </button>
          ))}
        </div>
        {tab === 'mcp' ? (
          <div className="rounded-3xl border border-line glass p-6">
            <ol className="space-y-4 text-sm text-mut">
              <li><span className="mr-2 font-mono text-rose">1</span> Add the endpoint to Claude Code, Cursor or Antigravity:</li>
            </ol>
            <div className="my-3 flex items-start gap-3 rounded-2xl border border-line bg-bg/50 p-4">
              <pre className="flex-1 overflow-x-auto font-mono text-[12px] leading-relaxed text-txt/90">{MCP_CONFIG}</pre>
              <Copy text={MCP_CONFIG} />
            </div>
            <ol className="space-y-4 text-sm text-mut" start={2}>
              <li><span className="mr-2 font-mono text-rose">2</span> Paste the Engram memory prompt into your agent’s rules.</li>
              <li><span className="mr-2 font-mono text-rose">3</span> Just talk. It remembers.</li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={`${REPO}/blob/main/PROMPT.md`} target="_blank" rel="noreferrer" className="rounded-full bg-gradient-to-r from-rose to-violet px-5 py-2.5 text-sm font-medium text-bg">Get the prompt →</a>
              <a href={REPO} target="_blank" rel="noreferrer" className="rounded-full border border-line px-5 py-2.5 text-sm text-txt hover:border-rose/50">View on GitHub</a>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-line glass p-6">
            <p className="text-sm text-mut">Run the full Engram web app locally — zero keys needed (offline demo mode built in).</p>
            <div className="my-3 flex items-center gap-3 rounded-2xl border border-line bg-bg/50 p-4">
              <pre className="flex-1 font-mono text-[12.5px] whitespace-pre text-txt/90">{`git clone ${REPO}\ncd engram && pnpm install\npnpm dev`}</pre>
              <Copy text={`git clone ${REPO}\ncd engram && pnpm install && pnpm dev`} />
            </div>
            <a href="#demo" className="mt-2 inline-block rounded-full border border-line px-5 py-2.5 text-sm text-txt hover:border-rose/50">Or try the demo above ↑</a>
          </div>
        )}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="hairline-t mt-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center">
        <Wordmark />
        <p className="text-sm text-faint sm:ml-4">Portable, verifiable memory for AI agents — on Walrus.</p>
        <div className="flex items-center gap-6 text-sm text-mut sm:ml-auto">
          <a href="#demo" className="hover:text-txt">Demo</a>
          <a href="#start" className="hover:text-txt">Get started</a>
          <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-txt">GitHub ↗</a>
        </div>
      </div>
      <p className="pb-8 text-center font-mono text-[11px] text-faint">Built for the Walrus Memory hackathon · SuiHub Lagos</p>
    </footer>
  )
}
