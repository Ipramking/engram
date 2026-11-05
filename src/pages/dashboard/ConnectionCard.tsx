import { useState } from 'react'
import { Activity, CircleAlert, CircleCheck, KeyRound } from 'lucide-react'
import type { Dashboard } from './data'
import { maskUrl } from './data'
import { Button, CopyButton, Panel, Skeleton, fmtDate } from './ui'

type TestState = { ok: true; ms: number; tools: string[] } | { ok: false; ms: number; error: string } | null

export function ConnectionCard({ d, onCreateKey, compact = false }: { d: Dashboard; onCreateKey: () => void; compact?: boolean }) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestState>(null)
  const cred = d.credential

  async function test() {
    if (!cred) return
    setTesting(true)
    setResult(null)
    setResult(await d.testConnection(cred.url))
    setTesting(false)
  }

  const daysLeft = cred?.expiresAt ? Math.ceil((cred.expiresAt.getTime() - Date.now()) / 86400000) : null

  return (
    <Panel className={compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Your connection link</p>
          <p className="mt-1 text-[13px] leading-relaxed text-mut">
            One link connects any app to your memory. Treat it like a password.
          </p>
        </div>
        {d.keys.length > 1 && (
          <select
            aria-label="Key to connect with"
            value={cred?.key.id || ''}
            onChange={(e) => {
              d.setActiveKeyId(e.target.value)
              setResult(null)
            }}
            className="ring-focus max-w-[46%] shrink-0 truncate rounded-xl border border-line-2 bg-bg/80 px-2.5 py-1.5 text-[12px] text-txt"
          >
            {d.keys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} · {k.scope}
              </option>
            ))}
          </select>
        )}
      </div>

      {d.loading || (cred && !cred.url) ? (
        <Skeleton className="mt-4 h-11" />
      ) : !cred ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line-2 p-4 text-[13px] text-mut">
          You have no active keys.{' '}
          <button type="button" className="text-rose underline-offset-2 hover:underline" onClick={onCreateKey}>
            Create one
          </button>{' '}
          to get a connection link.
        </div>
      ) : (
        <>
          <div className="panel-inset mt-4 rounded-2xl px-3.5 py-3">
            <p className="break-all font-mono text-[12px] leading-relaxed text-champagne/90">{maskUrl(cred.url)}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyButton value={cred.url} label="Copy full link" variant="primary" size="md" />
            <Button onClick={test} disabled={testing}>
              <Activity size={14} /> {testing ? 'Testing…' : 'Test link'}
            </Button>
          </div>

          {result && (
            <p
              role="status"
              className={`mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed ${result.ok ? 'text-mut' : 'text-champagne'}`}
            >
              {result.ok ? (
                <>
                  <CircleCheck size={15} className="mt-px shrink-0 text-rose" />
                  <span>
                    Working — answered in <span className="tabular">{result.ms}</span> ms with {result.tools.length} tools.
                  </span>
                </>
              ) : (
                <>
                  <CircleAlert size={15} className="mt-px shrink-0 text-rose" />
                  <span>Failed: {result.error}. Revoke this key and create a new one, then paste the new link into your apps.</span>
                </>
              )}
            </p>
          )}

          {!compact && (
            <div className="mt-4 flex items-start gap-2.5 border-t border-line/70 pt-4 text-[12.5px] leading-relaxed text-mut">
              <KeyRound size={15} className="mt-px shrink-0 text-violet-soft" />
              {cred.permanent ? (
                <span>
                  <b className="font-medium text-txt">Permanent key “{cred.key.name}”.</b> It never expires; revoke it on the Keys
                  page if it leaks. It is only shown during this visit, so copy it now.
                </span>
              ) : (
                <span>
                  <b className="font-medium text-txt">Valid until {cred.expiresAt ? fmtDate(cred.expiresAt) : '—'}</b>
                  {daysLeft !== null && <> ({daysLeft} days)</>}. Apps stop connecting after that.{' '}
                  <button type="button" className="text-rose underline-offset-2 hover:underline" onClick={onCreateKey}>
                    Create a permanent key
                  </button>{' '}
                  for apps you'll keep using.
                </span>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
