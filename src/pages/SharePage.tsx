import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleCheck, CloudOff, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Wordmark } from '../components/Chrome'
import { safeJson } from '../lib/api'
import { setReturnTo } from '../lib/returnTo'
import { enqueue, flushQueue, readQueue } from '../lib/shareQueue'
import { TYPE_META } from './dashboard/ui'

const TYPES = ['decision', 'config', 'gotcha', 'person', 'preference', 'plan']

/** Share target: text shared from any app on the phone lands here, ready to save. */
export default function SharePage() {
  const { user, token, loading } = useAuth()
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const shared = [params.get('title'), params.get('text'), params.get('url')]
    .map((s) => (s || '').trim())
    .filter((s, i, all) => s && all.indexOf(s) === i)
    .join('\n')
  const [text, setText] = useState(shared)
  const [type, setType] = useState('decision')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'queued'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState(readQueue().length)

  useEffect(() => {
    if (!loading && !user) {
      setReturnTo(window.location.pathname + window.location.search)
      navigate('/login', { replace: true })
    }
  }, [loading, user, navigate])

  useEffect(() => {
    if (!token) return
    const flush = () => flushQueue(token).then(() => setQueued(readQueue().length))
    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [token])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!token || !text.trim()) return
    setError(null)
    if (!navigator.onLine) {
      enqueue({ text: text.trim(), type, queuedAt: new Date().toISOString() })
      setQueued(readQueue().length)
      return setState('queued')
    }
    setState('saving')
    try {
      const res = await fetch('/api/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: text.trim(), type, scope: 'personal' }),
      })
      const d = await safeJson<any>(res)
      if (!res.ok) {
        setState('idle')
        return setError(d?.error || 'Could not save. Try again.')
      }
      setState('saved')
    } catch {
      enqueue({ text: text.trim(), type, queuedAt: new Date().toISOString() })
      setQueued(readQueue().length)
      setState('queued')
    }
  }

  return (
    <main className="min-h-dvh bg-bg px-4 py-8 text-txt">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="mb-6 flex items-center justify-between">
          <Wordmark />
          <Link to="/dashboard" className="text-[13px] text-mut hover:text-txt">
            Dashboard
          </Link>
        </div>

        {state === 'saved' || state === 'queued' ? (
          <section className="panel rounded-[26px] p-6 text-center">
            {state === 'saved' ? (
              <CircleCheck size={28} className="mx-auto text-rose" />
            ) : (
              <CloudOff size={28} className="mx-auto text-champagne" />
            )}
            <h1 className="mt-3 font-display text-[26px]">{state === 'saved' ? 'Saved to Engram' : 'Saved on this phone'}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-mut">
              {state === 'saved'
                ? 'Every AI you connect can recall it now.'
                : 'You’re offline. It will sync automatically when you’re back online.'}
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setText('')
                  setState('idle')
                }}
                className="ring-focus h-11 flex-1 rounded-2xl border border-line-2 text-[14px] text-mut hover:text-txt"
              >
                Save another
              </button>
              <Link to="/dashboard?tab=memories" className="ring-focus grid h-11 flex-1 place-items-center rounded-2xl bg-gradient-to-r from-rose to-[#cfa1d8] text-[14px] font-medium text-bg">
                See memories
              </Link>
            </div>
          </section>
        ) : (
          <form onSubmit={save} className="panel space-y-5 rounded-[26px] p-5 sm:p-6">
            <div>
              <p className="eyebrow">Save to Engram</p>
              <h1 className="mt-1 font-display text-[26px] leading-tight">What should your AIs remember?</h1>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={4000}
              autoFocus
              placeholder="Paste or type one fact, with the reason."
              className="ring-focus w-full resize-none rounded-2xl border border-line-2 bg-bg/80 px-3.5 py-3 text-[15px] leading-relaxed text-txt placeholder:text-faint"
            />
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`ring-focus shrink-0 rounded-xl border px-3 py-2 text-[13px] transition ${
                    type === t ? 'border-rose/50 bg-rose/10 text-txt' : 'border-line-2 text-mut'
                  }`}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
            {error && <p className="text-[13px] text-rose">{error}</p>}
            <button
              type="submit"
              disabled={state === 'saving' || !text.trim()}
              className="ring-focus inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-[#cfa1d8] text-[15px] font-medium text-bg transition disabled:opacity-50"
            >
              <Send size={16} /> {state === 'saving' ? 'Saving…' : 'Save memory'}
            </button>
            {queued > 0 && <p className="text-center text-[12px] text-faint">{queued} saved offline, waiting to sync</p>}
          </form>
        )}
      </div>
    </main>
  )
}
