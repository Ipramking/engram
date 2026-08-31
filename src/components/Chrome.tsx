import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Brain } from 'lucide-react'

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
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on)
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <nav className={`sticky top-0 z-50 transition-colors ${scrolled ? 'border-b border-line glass' : 'border-b border-transparent'}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
        <Wordmark />
        <div className="ml-auto hidden items-center gap-7 text-sm text-mut md:flex">
          {isHome ? (
            <>
              <a href="#how" className="transition hover:text-txt">How it works</a>
              <a href="#team" className="transition hover:text-txt">Team</a>
              <a href="#demo" className="transition hover:text-txt">Demo</a>
            </>
          ) : (
            <>
              <Link to="/#how" className="transition hover:text-txt">How it works</Link>
              <Link to="/#team" className="transition hover:text-txt">Team</Link>
              <Link to="/#demo" className="transition hover:text-txt">Demo</Link>
            </>
          )}
          <Link to="/setup" className="transition hover:text-txt">Set up</Link>
          <a href={REPO} target="_blank" rel="noreferrer" className="transition hover:text-txt">GitHub ↗</a>
        </div>
        <Link
          to="/setup"
          className="rounded-full bg-gradient-to-r from-rose to-violet px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90"
        >
          Get started
        </Link>
      </div>
    </nav>
  )
}

export function Footer() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <footer className="hairline-t mt-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center">
        <Wordmark />
        <p className="text-sm text-faint sm:ml-4">Portable, verifiable memory for AI agents — on Walrus.</p>
        <div className="flex items-center gap-6 text-sm text-mut sm:ml-auto">
          {isHome ? (
            <a href="#demo" className="hover:text-txt">Demo</a>
          ) : (
            <Link to="/#demo" className="hover:text-txt">Demo</Link>
          )}
          <Link to="/setup" className="hover:text-txt">Set up</Link>
          <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-txt">GitHub ↗</a>
        </div>
      </div>
      <p className="pb-8 text-center font-mono text-[11px] text-faint">Built for the Walrus Memory hackathon · SuiHub Lagos</p>
    </footer>
  )
}
