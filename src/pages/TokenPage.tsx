import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ArrowRight, ShieldCheck } from 'lucide-react'
import { Nav, Footer } from '../components/Chrome'

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

export default function TokenPage() {
  useReveal()
  return (
    <div className="relative min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
        <div data-reveal className="mb-10 text-center">
          <p className="mb-3 font-mono text-xs tracking-widest text-rose uppercase">Spaces · Instant Token</p>
          <h1 className="text-4xl sm:text-5xl">Create your space</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-mut">
            Get an instant signed token for your AI agents. Using it yourself? You’re done.
            Want a team? Share the URL — teammates just paste it.
          </p>
        </div>

        <div data-reveal className="rounded-3xl border border-line glass p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-rose/40 bg-rose/10 text-rose">
              <KeyRound size={20} />
            </span>
            <div>
              <h2 className="text-2xl">Hosted Space Token</h2>
              <p className="text-sm text-mut">Stateless, signed bearer token — no account or login needed.</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-line bg-surface/50 p-6 text-center">
            <ShieldCheck size={32} className="mx-auto text-rose/80" />
            <p className="mt-3 text-sm text-txt font-medium">Token provisioning service is being wired in Phase 2 & 3.</p>
            <p className="mt-1 text-xs text-faint">Visit the setup guide to configure client tools locally or use team URLs.</p>
            <div className="mt-6 flex justify-center">
              <Link
                to="/setup"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose to-violet px-6 py-2.5 text-sm font-medium text-bg transition hover:opacity-90"
              >
                Go to Setup <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
