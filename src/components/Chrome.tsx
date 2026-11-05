import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Brain, LogOut, LayoutDashboard, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const REPO = 'https://github.com/Ipramking/engram'

export function Wordmark({ size = 'text-lg' }: { size?: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-90">
      <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-rose to-violet text-bg shadow-lg shadow-violet/20">
        <Brain size={17} strokeWidth={2.2} />
      </div>
      <span className={`font-display ${size} tracking-tight text-txt`}>Engram</span>
    </Link>
  )
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'
  const { user, logout } = useAuth()

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on)
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.hash])

  return (
    <nav className={`sticky top-0 z-50 transition-colors ${scrolled || mobileOpen ? 'border-b border-line glass' : 'border-b border-transparent'}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5">
        <Wordmark />
        <div className="ml-auto hidden items-center gap-7 text-sm text-mut md:flex">
          {isHome ? (
            <>
              <a href="#how" className="transition hover:text-txt">How it works</a>
              <a href="#taxonomy" className="transition hover:text-txt">Memory Types</a>
              <a href="#platforms" className="transition hover:text-txt">Platforms & Mobile</a>
              <a href="#pricing" className="transition hover:text-txt">Plans & Limits</a>
            </>
          ) : (
            <>
              <Link to="/#how" className="transition hover:text-txt">How it works</Link>
              <Link to="/#taxonomy" className="transition hover:text-txt">Memory Types</Link>
              <Link to="/#platforms" className="transition hover:text-txt">Platforms & Mobile</Link>
              <Link to="/#pricing" className="transition hover:text-txt">Plans & Limits</Link>
            </>
          )}
          <Link to="/docs" className="transition hover:text-txt">Docs</Link>
          <a href={REPO} target="_blank" rel="noreferrer" className="transition hover:text-txt">GitHub ↗</a>
        </div>

        <div className="ml-auto md:ml-0 flex items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose to-violet px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-bg shadow hover:opacity-90 transition"
              >
                <LayoutDashboard size={14} />
                <span>Dashboard</span>
              </Link>
              <button
                onClick={() => logout()}
                className="hidden sm:flex items-center justify-center rounded-full border border-line p-2 text-mut hover:text-txt hover:border-rose/40 transition"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="text-xs sm:text-sm font-medium text-mut hover:text-txt transition px-2 py-1"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-gradient-to-r from-rose to-violet px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-bg transition hover:opacity-90 shadow-sm"
              >
                Get started
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            className="flex md:hidden items-center justify-center rounded-xl border border-line bg-surface/70 p-2 text-mut hover:text-txt transition"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Drawer */}
      {mobileOpen && (
        <div className="border-t border-line bg-bg/95 px-5 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-3 text-sm text-mut">
            {isHome ? (
              <>
                <a href="#how" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-txt">How it works</a>
                <a href="#taxonomy" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-txt">Memory Types</a>
                <a href="#platforms" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-txt">Platforms & Mobile</a>
                <a href="#pricing" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-txt">Plans & Limits</a>
              </>
            ) : (
              <>
                <Link to="/#how" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-txt">How it works</Link>
                <Link to="/#taxonomy" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-txt">Memory Types</Link>
                <Link to="/#platforms" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-txt">Platforms & Mobile</Link>
                <Link to="/#pricing" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-txt">Plans & Limits</Link>
              </>
            )}
            <Link to="/docs" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-txt">Documentation</Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="py-1.5 hover:text-txt">GitHub Repository ↗</a>
            {user && (
              <button
                onClick={() => {
                  setMobileOpen(false)
                  logout()
                }}
                className="mt-2 flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/10 px-3.5 py-2.5 text-left text-xs font-medium text-rose"
              >
                <LogOut size={14} />
                Sign out ({user.email})
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

export function Footer() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <footer className="hairline-t mt-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center">
        <Wordmark />
        <p className="text-sm text-faint sm:ml-4">
          Portable, verifiable persistent memory for AI agents — on Walrus.
        </p>
        <div className="flex flex-wrap items-center gap-5 text-sm text-mut sm:ml-auto">
          {isHome ? (
            <>
              <a href="#how" className="hover:text-txt">How it works</a>
              <a href="#pricing" className="hover:text-txt">Pricing</a>
            </>
          ) : (
            <>
              <Link to="/#how" className="hover:text-txt">How it works</Link>
              <Link to="/#pricing" className="hover:text-txt">Pricing</Link>
            </>
          )}
          <Link to="/docs" className="hover:text-txt">Docs</Link>
          <Link to="/login" className="hover:text-txt">Sign In</Link>
          <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-txt">GitHub ↗</a>
        </div>
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-8 text-center font-mono text-[11px] text-faint">
        <Link to="/privacy" className="hover:text-txt">Privacy</Link>
        <Link to="/terms" className="hover:text-txt">Terms</Link>
        <span>© {new Date().getFullYear()} Engram</span>
      </p>
    </footer>
  )
}
