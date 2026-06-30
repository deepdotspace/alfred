/**
 * Landing motion helpers. One place to read prefers-reduced-motion + the narrow
 * breakpoint, and to share the reveal vocabulary so every section moves the same
 * way. The whole landing is also wrapped in <MotionConfig reducedMotion="user">;
 * these hooks gate the manual cases (scroll scrub, timers, CSS loops).
 */
import { useEffect, useState } from 'react'
import type { Variants } from 'framer-motion'

export const EASE = [0.16, 1, 0.3, 1] as const

/** Live prefers-reduced-motion. When true, sections drop transforms and hold still. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduced
}

/** True below a width threshold: scroll-scrub scenes collapse to their static form. */
export function useIsNarrow(threshold = 760): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${threshold}px)`)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [threshold])
  return narrow
}

/** Scroll-reveal for a section: fade + small rise, settling once in view. */
export function revealVariants(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  }
}

/** Stagger container: children reveal in sequence as the group enters. */
export function staggerVariants(reduced: boolean): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.08, delayChildren: 0.05 } },
  }
}

/** A single staggered item (rise + fade), paired with staggerVariants. */
export function itemVariants(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  }
}
