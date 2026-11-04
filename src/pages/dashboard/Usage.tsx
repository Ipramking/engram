import { Check } from 'lucide-react'
import type { Dashboard } from './data'
import type { QuotaBlock } from './types'
import { Callout, PageHeader, Panel, Skeleton } from './ui'

function countdown(sec?: number) {
  if (!sec || sec <= 0) return 'at midnight UTC'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `in ${h}h ${m}m`
}

function Meter({ title, q, accent }: { title: string; q: QuotaBlock; accent: string }) {
  const pct = q.percentUsed ?? Math.min(100, Math.round((q.saves / Math.max(1, q.dailyLimit)) * 100))
  const left = q.remaining ?? Math.max(0, q.dailyLimit - q.saves)
  return (
    <Panel className="p-5 sm:p-6">
      <p className="eyebrow">{title}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="tabular font-display text-[34px] leading-none text-txt">
          {q.saves}
          <span className="font-sans text-[14px] text-faint"> / {q.dailyLimit} saves</span>
        </p>
        <p className="tabular text-[12.5px] text-mut">{q.recalls} recalls</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg/80" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: accent }} />
      </div>
      <p className="tabular mt-2.5 text-[12px] text-faint">
        {left} left today · resets {countdown(q.secondsUntilReset)}
      </p>
    </Panel>
  )
}

const plans = (personalLimit = 50, teamLimit = 150, seats = 3) => [
  {
    name: 'Personal',
    price: 'Free',
    points: ['Your own memory', `${personalLimit} saves a day, unlimited recalls`, 'Every app: web, desktop, phone, terminal'],
  },
  {
    name: 'Team',
    price: 'Free',
    points: [`Up to ${seats} people`, `${teamLimit} shared saves a day`, 'Separate from personal memory'],
  },
  {
    name: 'Pro',
    price: 'Later',
    points: ['Bigger teams', 'Higher daily limits', 'Audit log and long-term Walrus storage'],
  },
]

export function Usage({ d }: { d: Dashboard }) {
  const u = d.usage
  const p = u?.personal
  const nearLimit = p && p.saves >= p.dailyLimit * 0.8

  return (
    <div>
      <PageHeader
        eyebrow="Usage"
        title="How much you've used today"
        intro="Saves are limited per day so a runaway agent can't flood your memory. Recalls are free. Counters reset at midnight UTC."
      />

      {nearLimit && p && (
        <div className="mb-5">
          <Callout tone="warn" title={p.saves >= p.dailyLimit ? 'Daily save limit reached' : 'Close to today’s limit'}>
            {p.saves >= p.dailyLimit
              ? `Apps can still recall, but new saves are refused until the reset ${countdown(p.secondsUntilReset)}.`
              : `${p.dailyLimit - p.saves} saves left today. If an agent is saving too often, check its memory rules.`}
          </Callout>
        </div>
      )}

      {d.loading || !u ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Meter title="Personal memory" q={u.personal} accent="linear-gradient(90deg,#e4a79c,#f0d0c8)" />
          {u.teams.map((t) => (
            <Meter key={t.teamId} title={`Team · ${t.teamName}`} q={t} accent="linear-gradient(90deg,#7c6cff,#9b8dff)" />
          ))}
          {u.teams.length === 0 && (
            <Panel className="grid place-items-center p-6 text-center text-[13px] text-mut">
              Team usage appears here once you create or join a team.
            </Panel>
          )}
        </div>
      )}

      <h2 className="mb-4 mt-10 font-display text-[22px] text-txt">Plans</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plans(u?.personal.dailyLimit, u?.teams[0]?.dailyLimit, u?.teams[0]?.maxMembers).map((pl) => {
          const current = pl.name === 'Personal' || (pl.name === 'Team' && (u?.teams.length || 0) > 0)
          return (
            <Panel key={pl.name} className={`flex flex-col p-5 sm:p-6 ${current ? 'border-rose/35' : ''}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[22px] text-txt">{pl.name}</h3>
                <span className="font-mono text-[11px] uppercase tracking-wider text-faint">{current ? 'your plan' : pl.price === 'Later' ? 'coming later' : ''}</span>
              </div>
              <p className="mt-1 font-display text-[28px] text-txt">{pl.price}</p>
              <ul className="mt-4 space-y-2">
                {pl.points.map((pt) => (
                  <li key={pt} className="flex gap-2 text-[13px] text-mut">
                    <Check size={14} className="mt-0.5 shrink-0 text-rose" /> {pt}
                  </li>
                ))}
              </ul>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
