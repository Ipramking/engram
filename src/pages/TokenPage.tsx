import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  KeyRound, ArrowRight, ShieldCheck, Copy, Check, Sparkles, ChevronDown, ChevronUp,
  Server, Rocket, Share2, AlertCircle, RefreshCw, Layers
} from 'lucide-react'
import { Nav, Footer } from '../components/Chrome'
import { safeJson } from '../lib/api'

const RENDER_DEPLOY = 'https://render.com/deploy?repo=https://github.com/Ipramking/engram'

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

function generateLocalRandomToken(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default function TokenPage() {
  useReveal()

  const [room, setRoom] = useState('my-space')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ token: string; room: string; url: string } | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [canShare] = useState(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function')

  // Self-host collapsible state
  const [showSelfHost, setShowSelfHost] = useState(false)
  const [genSelfHostToken, setGenSelfHostToken] = useState(() => generateLocalRandomToken())
  const [copiedGenToken, setCopiedGenToken] = useState(false)

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: room.trim() || 'my-space' }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        throw new Error(data.error || 'Failed to provision space')
      }
      setResult(data)
      try {
        localStorage.setItem('engram.token', data.token)
        localStorage.setItem('engram.room', data.room)
      } catch {}
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to provision service.')
    } finally {
      setLoading(false)
    }
  }

  const copyToken = () => {
    if (!result) return
    navigator.clipboard?.writeText(result.token)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 1500)
  }

  const copyUrl = () => {
    if (!result) return
    navigator.clipboard?.writeText(result.url)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 1500)
  }

  const shareUrl = () => {
    if (!result) return
    navigator.share?.({
      title: 'Engram Space',
      text: 'Add Engram memory to your AI with this space URL:',
      url: result.url,
    }).catch(() => {})
  }

  const copyGenToken = () => {
    navigator.clipboard?.writeText(genSelfHostToken)
    setCopiedGenToken(true)
    setTimeout(() => setCopiedGenToken(false), 1500)
  }

  return (
    <div className="relative min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
        {/* Header */}
        <div data-reveal className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-3.5 py-1 text-xs text-mut">
            <Sparkles size={13} className="text-rose" /> Instant Space Provisioning · Zero Config
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl">Create your space</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-mut">
            Get an instant signed token for your AI agents. Using it yourself? You’re done.
            Want a team? Share the URL — teammates just paste it.
          </p>
        </div>

        {/* Primary Creation Card */}
        <div data-reveal className="relative overflow-hidden rounded-3xl border border-line glass p-6 sm:p-10 shadow-2xl">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-rose/20 to-violet/20 blur-3xl" />

          {!result ? (
            <form onSubmit={handleCreateSpace} className="relative space-y-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-rose to-violet text-bg">
                  <KeyRound size={20} />
                </span>
                <div>
                  <h2 className="text-2xl font-display">Hosted Space Token</h2>
                  <p className="text-sm text-mut">Stateless, HMAC-signed bearer key. No database, no password, instant setup.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium tracking-wider text-faint uppercase mb-2">
                  Space / Room Name
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="my-space"
                    className="flex-1 rounded-2xl border border-line bg-bg/60 px-4 py-3.5 font-mono text-sm text-txt outline-none transition placeholder:text-faint focus:border-rose/60"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-violet px-7 py-3.5 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Minting token...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Create space token →
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-faint">
                  Rooms isolate memories within your space (e.g. <code>my-space</code>, <code>frontend</code>, <code>research</code>).
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-rose/30 bg-rose/10 p-4 text-sm text-rose">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="grid gap-3 border-t border-line/70 pt-5 sm:grid-cols-3">
                <div className="flex items-start gap-2 text-xs text-mut">
                  <Check size={14} className="mt-0.5 shrink-0 text-rose" />
                  <span>Works on Claude, Cursor, ChatGPT, Codex & Mobile</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-mut">
                  <Check size={14} className="mt-0.5 shrink-0 text-rose" />
                  <span>Stateless HMAC signing: no accounts or logins</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-mut">
                  <Check size={14} className="mt-0.5 shrink-0 text-rose" />
                  <span>Encrypted and verified on Walrus</span>
                </div>
              </div>
            </form>
          ) : (
            <div className="relative space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <h3 className="text-xl font-medium text-txt">Your space is ready!</h3>
                    <p className="text-xs text-faint">Saved to local browser storage & pre-filled in Setup.</p>
                  </div>
                </div>
                <Link
                  to="/setup"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose to-violet px-4 py-2 text-xs font-medium text-bg transition hover:opacity-90"
                >
                  Go to setup <ArrowRight size={13} />
                </Link>
              </div>

              {/* Token Display */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-faint uppercase">Space Token (Keep this safe)</span>
                  <span className="text-[11px] text-rose/80">Stateless bearer key</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg/70 p-3 pr-2 font-mono text-xs">
                  <span className="min-w-0 flex-1 truncate text-txt">{result.token}</span>
                  <button
                    onClick={copyToken}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-txt transition hover:border-rose/50"
                  >
                    {copiedToken ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copiedToken ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Ready Connector URL */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-faint uppercase">Ready-to-paste Connector URL</span>
                </div>
                <div className="rounded-2xl border border-rose/30 bg-rose/[0.05] p-3.5">
                  <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-txt sm:whitespace-pre sm:break-normal">
                    {result.url}
                  </pre>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={copyUrl}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose to-violet px-4 py-2 text-xs font-medium text-bg transition hover:opacity-90"
                    >
                      {copiedUrl ? <Check size={14} /> : <Copy size={14} />} {copiedUrl ? 'Copied Connector URL' : 'Copy Connector URL'}
                    </button>
                    {canShare && (
                      <button
                        onClick={shareUrl}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs text-txt transition hover:border-rose/50"
                      >
                        <Share2 size={13} /> Share with team
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Framing Copy */}
              <div className="rounded-2xl border border-line bg-surface/40 p-4 text-xs leading-relaxed text-mut">
                <p className="font-medium text-txt">Next steps:</p>
                <p className="mt-1">
                  <b>Using it yourself?</b> You’re all set. Head over to <Link to="/setup" className="text-rose underline underline-offset-2">Setup</Link> to connect your tools.
                </p>
                <p className="mt-1">
                  <b>Want a team?</b> Share this URL with your teammates. They just paste it into their AI connector settings — no install required.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setResult(null)}
                  className="text-xs text-faint hover:text-txt transition"
                >
                  ← Mint another token or room
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Self-Hosting Power-User Path */}
        <div data-reveal className="mt-12 rounded-3xl border border-line glass overflow-hidden">
          <button
            onClick={() => setShowSelfHost(!showSelfHost)}
            className="flex w-full items-center justify-between p-6 text-left transition hover:bg-surface/30"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-bg/40 text-mut">
                <Server size={18} />
              </span>
              <div>
                <h3 className="text-lg font-medium text-txt">Prefer to self-host?</h3>
                <p className="text-xs text-faint">Deploy your own private MCP server to Render with custom credentials.</p>
              </div>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full border border-line text-mut">
              {showSelfHost ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showSelfHost && (
            <div className="border-t border-line p-6 sm:p-8 space-y-6 bg-surface/20">
              <p className="text-sm leading-relaxed text-mut">
                If you prefer to run your own infrastructure rather than using our hosted service, you can deploy the Engram MCP endpoint directly onto Render using our blueprint.
              </p>

              {/* Deploy to Render CTA */}
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-bg/40 p-4">
                <div className="flex-1 min-w-[240px]">
                  <p className="text-sm font-medium text-txt">One-click Blueprint Deploy</p>
                  <p className="text-xs text-faint">Reads render.yaml directly from the repository.</p>
                </div>
                <a
                  href={RENDER_DEPLOY}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#00D9A6] px-5 py-2.5 text-xs font-semibold text-black transition hover:opacity-90"
                >
                  <Rocket size={15} /> Deploy to Render ↗
                </a>
              </div>

              {/* In-Browser Token Generator */}
              <div className="rounded-2xl border border-line bg-bg/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-faint uppercase">In-browser Token Generator (for ENGRAM_TEAM_TOKEN)</p>
                  <button
                    onClick={() => setGenSelfHostToken(generateLocalRandomToken())}
                    className="inline-flex items-center gap-1 text-[11px] text-rose hover:underline"
                  >
                    <RefreshCw size={11} /> Regenerate
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 font-mono text-xs">
                  <span className="min-w-0 flex-1 truncate text-txt">{genSelfHostToken}</span>
                  <button
                    onClick={copyGenToken}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-1 text-xs text-txt transition hover:border-rose/50"
                  >
                    {copiedGenToken ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copiedGenToken ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-faint">
                  Set this value as <code>ENGRAM_TEAM_TOKEN</code> in your Render environment variables.
                </p>
              </div>

              {/* Step Summary */}
              <div className="space-y-3 text-xs text-mut">
                <p className="font-medium text-txt text-sm">Self-host checklist:</p>
                <div className="flex items-start gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-rose/10 font-mono text-[10px] text-rose shrink-0">1</span>
                  <span>Deploy to Render using the Blueprint button above.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-rose/10 font-mono text-[10px] text-rose shrink-0">2</span>
                  <span>Set <code>ENGRAM_CREDS_JSON</code> to your <code>~/.memwal/credentials.json</code> content.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-rose/10 font-mono text-[10px] text-rose shrink-0">3</span>
                  <span>Set <code>ENGRAM_SIGNING_SECRET</code> or <code>ENGRAM_TEAM_TOKEN</code> in your Render environment variables.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security & Architecture Caveats */}
        <div data-reveal className="mt-10 rounded-2xl border border-line bg-surface/30 p-5 text-xs text-faint leading-relaxed space-y-2">
          <p className="font-medium text-txt text-[13px] flex items-center gap-1.5">
            <Layers size={14} className="text-rose" /> Multi-Tenant Storage & Security Note
          </p>
          <p>
            Hosted spaces utilize namespace isolation (<code>team:&lt;tenantId&gt;:&lt;room&gt;</code>) stored on Walrus mainnet under our shared storage gateway. Tokens are signed HMAC bearer credentials with no database dependency.
          </p>
          <p>
            For enterprise strict data governance where on-chain per-member keys (ExecutorCap) are required, self-hosting with your own private Walrus account is recommended.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
