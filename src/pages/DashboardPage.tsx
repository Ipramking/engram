import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BarChart3, BookOpen, Brain, House, KeyRound, Layers, LogOut, MoreHorizontal, PlugZap, RefreshCw, Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Wordmark } from '../components/Chrome'
import { useDashboard } from './dashboard/data'
import type { TabId } from './dashboard/types'
import { Button, Callout, Sheet, ToastProvider } from './dashboard/ui'
import { Overview } from './dashboard/Overview'
import { Connect } from './dashboard/Connect'
import { Memories } from './dashboard/Memories'
import { Keys, CreateKeySheet } from './dashboard/Keys'
import { Teams } from './dashboard/Teams'
import { Usage } from './dashboard/Usage'
import { Guide } from './dashboard/Guide'
import { DeviceApproval } from './dashboard/DeviceApproval'

const DEVICE_KEY = 'engram.pendingDevice'

const NAV: Array<{ id: TabId; label: string; hint: string; icon: typeof House; mobile?: boolean }> = [
  { id: 'home', label: 'Home', hint: 'Start here', icon: House, mobile: true },
  { id: 'connect', label: 'Connect', hint: 'Add an app', icon: PlugZap, mobile: true },
  { id: 'memories', label: 'Memories', hint: 'Search & clean', icon: Layers, mobile: true },
  { id: 'keys', label: 'Keys', hint: 'Access control', icon: KeyRound, mobile: true },
  { id: 'teams', label: 'Teams', hint: 'Shared memory', icon: Users },
  { id: 'usage', label: 'Usage', hint: 'Limits & plans', icon: BarChart3 },
  { id: 'guide', label: 'Guide', hint: 'How it works', icon: BookOpen },
]

const isTab = (t: string | null): t is TabId => NAV.some((n) => n.id === t)

export default function DashboardPage() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  )
}

function Dashboard() {
  const { user, token, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: TabId = isTab(tabParam) ? tabParam : 'home'
  const [moreOpen, setMoreOpen] = useState(false)
  const [keySheet, setKeySheet] = useState(false)
  const d = useDashboard(token)
  const deviceParam = params.get('device')
  const [deviceCode, setDeviceCode] = useState<string | null>(() => {
    try {
      return deviceParam || sessionStorage.getItem(DEVICE_KEY)
    } catch {
      return deviceParam
    }
  })

  useEffect(() => {
    // Keep a terminal's login code across the sign-in redirect.
    if (deviceParam) {
      try {
        sessionStorage.setItem(DEVICE_KEY, deviceParam)
      } catch {
        /* private mode */
      }
    }
    if (!authLoading && !user) navigate('/login')
  }, [authLoading, user, navigate, deviceParam])

  function closeDevice() {
    try {
      sessionStorage.removeItem(DEVICE_KEY)
    } catch {
      /* private mode */
    }
    setDeviceCode(null)
    if (deviceParam) setParams(tab === 'home' ? {} : { tab })
  }

  function go(t: TabId) {
    setParams(t === 'home' ? {} : { tab: t })
    setMoreOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (authLoading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-rose border-t-transparent" />
          <p className="font-mono text-[12px] text-faint">Opening your memory…</p>
        </div>
      </div>
    )
  }

  const name = user.name || user.email.split('@')[0]
  const signOut = () => {
    try {
      localStorage.removeItem('engram.token')
      localStorage.removeItem('engram.room')
    } catch {
      /* private mode */
    }
    logout()
  }

  const setupDone = [
    d.keys.some((k) => k.last_used_at),
    (d.recentStats?.active ?? d.recent.length) > 0,
    (d.usage?.personal.recalls ?? 0) > 0 || d.keys.filter((k) => k.last_used_at).length > 1,
  ].filter(Boolean).length

  const page: Record<TabId, ReactNode> = {
    home: <Overview d={d} name={name} go={go} onCreateKey={() => setKeySheet(true)} />,
    connect: <Connect d={d} onCreateKey={() => setKeySheet(true)} />,
    memories: <Memories d={d} />,
    keys: <Keys d={d} onCreateKey={() => setKeySheet(true)} />,
    teams: <Teams d={d} onCreateKey={() => setKeySheet(true)} />,
    usage: <Usage d={d} />,
    guide: <Guide go={go} />,
  }

  return (
    <div className="min-h-dvh bg-bg text-txt lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-xl focus:bg-surface-2 focus:px-4 focus:py-2">
        Skip to content
      </a>

      {/* Ambient light */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -top-40 right-[12%] h-[560px] w-[560px] rounded-full bg-violet/[0.09] blur-[140px]" />
        <div className="absolute -left-40 top-[38%] h-[460px] w-[460px] rounded-full bg-rose/[0.08] blur-[130px]" />
      </div>

      {/* Desktop rail */}
      <aside className="sticky top-0 z-30 hidden h-dvh flex-col border-r border-line/70 bg-[#110a14]/80 px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="px-2">
          <Wordmark />
        </div>
        <nav aria-label="Dashboard" className="mt-8 flex-1 space-y-1">
          {NAV.map((n) => {
            const on = n.id === tab
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                aria-current={on ? 'page' : undefined}
                className={`ring-focus group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition duration-200 ${
                  on ? 'bg-surface-2/80 text-txt' : 'text-mut hover:bg-surface/60 hover:text-txt'
                }`}
              >
                {on && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-rose" />}
                <n.icon size={17} className={on ? 'text-rose' : 'text-faint group-hover:text-mut'} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] leading-tight">{n.label}</span>
                  <span className="block text-[11px] leading-tight text-faint">{n.hint}</span>
                </span>
                {n.id === 'home' && setupDone < 3 && (
                  <span className="tabular ml-auto rounded-md border border-rose/30 px-1.5 font-mono text-[10px] text-rose">{setupDone}/3</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="rounded-2xl border border-line/70 bg-bg/40 p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose/80 to-violet/80 font-display text-[15px] text-bg">
              {name[0]?.toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] text-txt">{name}</p>
              <p className="truncate text-[11.5px] text-faint">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">{d.usage?.plan || user.plan_tier || 'free'} plan</span>
            <button type="button" onClick={signOut} className="ring-focus inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-mut transition hover:text-txt">
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-bg/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Wordmark />
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-rose/80 to-violet/80 font-display text-[14px] text-bg" aria-label={`Signed in as ${name}`}>
          {name[0]?.toUpperCase()}
        </span>
      </header>

      <main id="main" className="relative z-10 mx-auto w-full max-w-[1120px] px-4 pb-32 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-16 lg:pt-12">
        {d.sessionExpired ? (
          <Callout
            tone="warn"
            title="Your session has ended"
            action={
              <Button variant="primary" size="sm" onClick={signOut}>
                Sign in again
              </Button>
            }
          >
            For safety, sign-ins expire. Sign in again to see your keys and memories.
          </Callout>
        ) : (
          <>
            {d.loadError && (
              <div className="mb-6">
                <Callout tone="warn" title="Some data didn't load" action={<Button size="sm" onClick={d.refresh}><RefreshCw size={13} /> Retry</Button>}>
                  {d.loadError}
                </Callout>
              </div>
            )}
            <div key={tab} className="step-in">
              {page[tab]}
            </div>
          </>
        )}
      </main>

      {/* Phone tab bar */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line/80 bg-[#110a14]/95 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-xl lg:hidden"
      >
        {NAV.filter((n) => n.mobile).map((n) => {
          const on = n.id === tab
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => go(n.id)}
              aria-current={on ? 'page' : undefined}
              className={`ring-focus flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-[10.5px] transition ${on ? 'text-txt' : 'text-faint'}`}
            >
              <n.icon size={19} className={on ? 'text-rose' : ''} />
              {n.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`ring-focus flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-[10.5px] ${
            ['teams', 'usage', 'guide'].includes(tab) ? 'text-txt' : 'text-faint'
          }`}
        >
          <MoreHorizontal size={19} className={['teams', 'usage', 'guide'].includes(tab) ? 'text-rose' : ''} />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} eyebrow={user.email} title="More">
        <div className="space-y-1.5">
          {NAV.filter((n) => !n.mobile).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => go(n.id)}
              className="ring-focus flex w-full items-center gap-3 rounded-2xl border border-line/70 px-4 py-3.5 text-left transition hover:border-rose/35"
            >
              <n.icon size={18} className="text-rose" />
              <span>
                <span className="block text-[14px] text-txt">{n.label}</span>
                <span className="block text-[12px] text-faint">{n.hint}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={signOut}
            className="ring-focus mt-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-mut transition hover:text-txt"
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
        <p className="mt-6 flex items-center gap-2 text-[11.5px] text-faint">
          <Brain size={13} /> Engram · portable memory for every AI
        </p>
      </Sheet>

      <CreateKeySheet open={keySheet} onClose={() => setKeySheet(false)} d={d} />
      {deviceCode && !d.sessionExpired && <DeviceApproval d={d} code={deviceCode} onDone={closeDevice} />}
    </div>
  )
}
