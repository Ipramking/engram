import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Lock, Mail, ArrowRight, Eye, EyeOff, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Wordmark } from '../components/Chrome'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please provide both email and password.')
      return
    }

    setLoading(true)
    setError(null)
    const res = await login(email.trim(), password)
    setLoading(false)

    if (res.ok) {
      navigate('/dashboard')
    } else {
      setError(res.error || 'Invalid email or password.')
    }
  }

  const fillQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('EngramDemo2026!')
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-bg text-txt">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[450px] w-[550px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-rose/15 via-violet/15 to-transparent blur-3xl" />
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
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface/80 text-rose shadow-inner shadow-rose/10">
              <Brain size={24} />
            </div>
            <h1 className="text-3xl font-display tracking-tight text-txt">Welcome back</h1>
            <p className="mt-2 text-sm text-mut">
              Sign in to manage your cross-platform memory, API keys, and team spaces.
            </p>
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
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@team.xyz"
                  required
                  className="w-full rounded-2xl border border-line bg-bg/70 pl-10 pr-4 py-3 text-sm text-txt placeholder:text-faint focus:border-rose/60 focus:outline-none focus:ring-1 focus:ring-rose/40 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-mono tracking-wider text-mut uppercase">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
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
                  Signing in…
                </span>
              ) : (
                <>
                  Sign in to Engram <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login helper */}
          <div className="mt-6 border-t border-line/80 pt-5">
            <p className="text-[11px] font-mono tracking-wide text-faint text-center mb-2.5 uppercase">
              Quick test accounts
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fillQuickDemo('developer@engram.memory')}
                className="flex-1 rounded-xl border border-line/60 bg-surface/40 py-2 px-2 text-[11px] text-mut hover:text-txt hover:border-line transition"
              >
                Developer Demo
              </button>
              <button
                type="button"
                onClick={() => fillQuickDemo('teamlead@engram.memory')}
                className="flex-1 rounded-xl border border-line/60 bg-surface/40 py-2 px-2 text-[11px] text-mut hover:text-txt hover:border-line transition"
              >
                Team Lead Demo
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-mut">
            Don't have an account yet?{' '}
            <Link to="/register" className="text-rose font-medium hover:underline">
              Create account
            </Link>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="relative z-10 py-6 text-center text-xs text-faint font-mono">
        Seal-encrypted · Verifiable on Walrus & Sui
      </footer>
    </div>
  )
}
