import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Lock, Mail, User, ArrowRight, Eye, EyeOff, Sparkles, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Wordmark } from '../components/Chrome'

export default function RegisterPage() {
  const { user, loading: authLoading, register } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, user, navigate])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please provide email and password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError(null)
    const res = await register(email.trim(), password, name.trim())
    setLoading(false)

    if (res.ok) {
      navigate('/dashboard')
    } else {
      setError(res.error || 'Failed to create account.')
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-bg text-txt">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-violet/15 via-rose/15 to-transparent blur-3xl" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Wordmark />
        <Link
          to="/"
          className="text-sm text-mut transition hover:text-txt"
        >
          ← Back to home
        </Link>
      </header>

      {/* Form Container */}
      <main className="relative z-10 mx-auto my-auto w-full max-w-md px-5 py-8">
        <div className="rounded-3xl border border-line glass p-7 sm:p-9 shadow-2xl shadow-black/60">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface/80 text-rose shadow-inner shadow-rose/10">
              <Brain size={24} />
            </div>
            <h1 className="text-3xl font-display tracking-tight text-txt">Start with Engram</h1>
            <p className="mt-2 text-sm text-mut">
              Personal persistent memory for you, shared memory for your team.
            </p>
          </div>

          {/* Included Plan Features Banner */}
          <div className="mb-6 rounded-2xl border border-line/80 bg-surface/50 p-3.5 text-xs">
            <p className="font-mono text-[11px] text-rose font-medium uppercase tracking-wider mb-2">
              Free plan includes:
            </p>
            <ul className="space-y-1 text-mut">
              <li className="flex items-center gap-2">
                <Check size={13} className="text-emerald-400 shrink-0" />
                <span><strong>Personal Plan:</strong> 50 saves/day, cross-device sync</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={13} className="text-emerald-400 shrink-0" />
                <span><strong>Free Team:</strong> Up to 3 members, 150 shared saves/day</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={13} className="text-emerald-400 shrink-0" />
                <span>Walrus on-chain verification & Seal encryption</span>
              </li>
            </ul>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono tracking-wider text-mut uppercase mb-1.5">
                Full Name or Alias
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full rounded-2xl border border-line bg-bg/70 pl-10 pr-4 py-3 text-sm text-txt placeholder:text-faint focus:border-rose/60 focus:outline-none focus:ring-1 focus:ring-rose/40 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono tracking-wider text-mut uppercase mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ada@team.xyz"
                  required
                  className="w-full rounded-2xl border border-line bg-bg/70 pl-10 pr-4 py-3 text-sm text-txt placeholder:text-faint focus:border-rose/60 focus:outline-none focus:ring-1 focus:ring-rose/40 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono tracking-wider text-mut uppercase mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full rounded-2xl border border-line bg-bg/70 pl-10 pr-10 py-3 text-sm text-txt placeholder:text-faint focus:border-rose/60 focus:outline-none focus:ring-1 focus:ring-rose/40 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint hover:text-txt transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose to-violet py-3.5 text-sm font-medium text-bg shadow-lg shadow-violet/20 transition hover:opacity-95 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" />
                  Creating account…
                </span>
              ) : (
                <>
                  Create free account <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-mut">
            Already have an account?{' '}
            <Link to="/login" className="text-rose font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="relative z-10 py-6 text-center text-xs text-faint font-mono">
        Verifiable decentralized memory infrastructure for autonomous agents.
      </footer>
    </div>
  )
}
