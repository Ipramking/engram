import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Eye, PenLine, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Wordmark } from '../components/Chrome'
import { safeJson } from '../lib/api'
import { setReturnTo } from '../lib/returnTo'

/** Consent screen for "Sign in with Engram" (OAuth authorization endpoint). */
export default function OAuthPage() {
  const { user, token, loading } = useAuth()
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const clientId = params.get('client_id') || ''
  const redirectUri = params.get('redirect_uri') || ''
  const [client, setClient] = useState<{ clientName: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      setReturnTo(window.location.pathname + window.location.search)
      navigate('/login', { replace: true })
    }
  }, [loading, user, navigate])

  useEffect(() => {
    if (!clientId) return setError('This sign-in link is missing its app details. Start again from the app.')
    if (params.get('response_type') !== 'code') return setError('Unsupported sign-in request.')
    fetch(`/api/connect/client?client_id=${encodeURIComponent(clientId)}`)
      .then(async (r) => {
        const d = await safeJson<any>(r)
        if (!r.ok) throw new Error(d?.error_description || d?.error || 'Unknown app.')
        if (!d.redirectUris?.includes(redirectUri)) throw new Error('This app’s return address does not match its registration.')
        setClient({ clientName: d.clientName })
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, redirectUri])

  async function decide(approve: boolean) {
    if (!token) return
    setBusy(true)
    const res = await fetch('/api/connect/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        approve,
        client_id: clientId,
        redirect_uri: redirectUri,
        state: params.get('state') || undefined,
        code_challenge: params.get('code_challenge'),
        code_challenge_method: params.get('code_challenge_method'),
        scope: params.get('scope') || undefined,
      }),
    })
    const d = await safeJson<any>(res)
    if (res.ok && d.redirect) {
      window.location.href = d.redirect
      return
    }
    setBusy(false)
    setError(d?.error_description || d?.error || 'Could not complete sign-in.')
  }

  const appName = client?.clientName || 'This app'

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-txt">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>
        <section className="panel rounded-[26px] p-6 sm:p-8">
          {error ? (
            <>
              <p className="eyebrow">Sign in with Engram</p>
              <h1 className="mt-2 font-display text-[26px] leading-tight">Can’t continue</h1>
              <p className="mt-3 text-[14px] leading-relaxed text-mut">{error}</p>
            </>
          ) : !client || !user ? (
            <div className="space-y-3" aria-busy="true">
              <div className="skeleton h-5 w-32 rounded-lg" />
              <div className="skeleton h-9 w-3/4 rounded-xl" />
              <div className="skeleton h-24 rounded-2xl" />
            </div>
          ) : (
            <>
              <p className="eyebrow">Sign in with Engram</p>
              <h1 className="text-balance mt-2 font-display text-[28px] leading-[1.1]">
                {appName} wants to use your memory
              </h1>
              <ul className="mt-6 space-y-3 text-[14px]">
                <li className="flex gap-3">
                  <Eye size={17} className="mt-0.5 shrink-0 text-rose" /> Recall your personal memories when it answers you
                </li>
                <li className="flex gap-3">
                  <PenLine size={17} className="mt-0.5 shrink-0 text-rose" /> Save new decisions, configs, gotchas and plans
                </li>
                <li className="flex gap-3">
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-rose" /> Revoke it any time on your Keys page
                </li>
              </ul>
              <p className="mt-6 text-[12.5px] text-faint">Signed in as {user.email}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => decide(false)}
                  disabled={busy}
                  className="ring-focus h-11 flex-1 rounded-2xl border border-line-2 text-[14px] text-mut transition hover:text-txt disabled:opacity-50"
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={() => decide(true)}
                  disabled={busy}
                  className="ring-focus inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-[#cfa1d8] text-[14px] font-medium text-bg transition hover:brightness-105 disabled:opacity-50"
                >
                  <Check size={16} /> {busy ? 'Connecting…' : 'Allow'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
