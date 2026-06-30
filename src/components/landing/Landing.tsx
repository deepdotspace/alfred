/**
 * Alfred landing -- the public face, a single day-cycle scroll.
 *
 * Design Direction
 *
 * Product: An honest, free career butler for students and new grads; it reads the
 *   early-career job market overnight and returns only roles you truly qualify for.
 * Emotion: The calm relief of waking to a short, honest list someone trustworthy made for you.
 * Metaphor: A butler reading the morning papers through the night so your desk is clear by dawn.
 * References: a planetarium night-to-sunrise show; a hand-set broadsheet front page; the quiet of a hotel concierge desk.
 * Signature: the night-to-morning scroll -- the sky lifts from indigo to periwinkle as the market's noise resolves into a few settled roles.
 * Hero: a luminous mascot reading in a deep-indigo sky, faint listing cards drifting, a mono counter climbing.
 *
 * Style Tile
 * - Color: cool periwinkle day + deep indigo/ink night; the brand indigo as the only accent, no violet.
 * - Type: Figtree display + body, DM Mono for eyebrows/counters; Figtree carries the page in our own voice.
 * - Theme: light day world bookended by two deliberate dark-indigo night bands for contrast.
 * - Art direction: editorial, asymmetric, full-bleed; the design system is the spectacle, not paragraphs.
 * - Motion: one scroll-scrubbed dawn transition; everything else fades in once. Lenis inertial smoothing.
 * - Voice: first-person butler; warm, plain, honest to a fault; never hypey; no em dashes.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import Lenis from 'lenis'
import { AuthOverlay, useAuth } from 'deepspace'
import { NightHero } from './NightHero'
import { DawnResolve } from './DawnResolve'
import { SampleBrief } from './SampleBrief'
import { HowItWorks } from './HowItWorks'
import { TrustMoment } from './TrustMoment'
import { FreeOSS } from './FreeOSS'
import { Faq } from './Faq'
import { ClosingCTA } from './ClosingCTA'
import { LandingFooter } from './LandingFooter'
import { useReducedMotion } from './motion'

export function Landing() {
  const [signInOpen, setSignInOpen] = useState(false)
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const openSignIn = () => (isSignedIn ? navigate('/brief') : setSignInOpen(true))

  // The app shell clamps height for the signed-in client; this is a long
  // scrolling page, so let the document grow while mounted, then restore.
  useEffect(() => {
    const root = document.getElementById('root')
    const shell = document.querySelector<HTMLElement>('[data-testid="app-root"]')
    const prev = { root: root?.style.cssText ?? '', shell: shell?.style.cssText ?? '' }
    if (root) root.style.cssText += ';height:auto;min-height:100vh;overflow:visible;'
    if (shell) shell.style.cssText += ';height:auto;min-height:100vh;overflow:visible;'
    return () => {
      if (root) root.style.cssText = prev.root
      if (shell) shell.style.cssText = prev.shell
    }
  }, [])

  // Lenis inertial smoothing driving the real document scroll, so sticky pins
  // and Framer's useScroll stay correct. Disabled under reduced motion.
  useEffect(() => {
    if (reduced) {
      const el = document.documentElement
      const prev = el.style.scrollBehavior
      el.style.scrollBehavior = 'auto'
      return () => {
        el.style.scrollBehavior = prev
      }
    }
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    let raf = 0
    const loop = (t: number) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest('a[href^="#"]') as HTMLAnchorElement | null
      const id = a?.getAttribute('href')?.slice(1)
      if (!id) return
      const target = id === 'top' ? 0 : document.getElementById(id)
      if (target === 0 || target) {
        e.preventDefault()
        lenis.scrollTo(target as number | HTMLElement, { offset: -64 })
      }
    }
    document.addEventListener('click', onClick)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('click', onClick)
      lenis.destroy()
    }
  }, [reduced])

  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--alf-bg)', color: 'var(--alf-ink)' }}>
        <main>
          <NightHero onGetStarted={openSignIn} />
          <DawnResolve />
          <SampleBrief />
          <HowItWorks />
          <TrustMoment />
          <FreeOSS />
          <Faq />
          <ClosingCTA onGetStarted={openSignIn} />
        </main>
        <LandingFooter />
      </div>
      {signInOpen && <AuthOverlay onClose={() => setSignInOpen(false)} />}
    </MotionConfig>
  )
}
