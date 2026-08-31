import { useEffect } from 'react'
import { Nav, Footer } from '../components/Chrome'
import Setup from '../components/Setup'

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

export default function SetupPage() {
  useReveal()
  return (
    <div className="relative min-h-screen">
      <Nav />
      <main>
        <Setup />
      </main>
      <Footer />
    </div>
  )
}
