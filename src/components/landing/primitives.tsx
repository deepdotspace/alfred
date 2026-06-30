/**
 * Shared landing primitives: the reveal vocabulary, a count-up number, the mono
 * eyebrow, a section container, and the full-bleed night band. Colors flow
 * through --alf-* tokens (incl. the --alf-night-* register) so the landing reads
 * as one product with the app and stays clear of raw hex.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from 'framer-motion'
import {
  EASE,
  itemVariants,
  revealVariants,
  staggerVariants,
  useReducedMotion,
} from './motion'

/** Fade + rise into view once. */
export function Reveal({
  children,
  className,
  style,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  delay?: number
  as?: 'div' | 'section'
}) {
  const reduced = useReducedMotion()
  const Comp = as === 'section' ? motion.section : motion.div
  return (
    <Comp
      className={className}
      style={style}
      variants={revealVariants(reduced)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.35 }}
      transition={{ delay }}
    >
      {children}
    </Comp>
  )
}

/** Stagger group + item, for lists that reveal in sequence. */
export function Stagger({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      style={style}
      variants={staggerVariants(reduced)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </motion.div>
  )
}

export function Item({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const reduced = useReducedMotion()
  return (
    <motion.div className={className} style={style} variants={itemVariants(reduced)}>
      {children}
    </motion.div>
  )
}

/** A number that counts up to its real value once on view. */
export function CountUp({
  value,
  className,
  style,
}: {
  value: number
  className?: string
  style?: CSSProperties
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const mv = useMotionValue(reduced ? value : 0)
  const text = useTransform(mv, (n) => Math.round(n).toLocaleString())

  useEffect(() => {
    if (reduced || !inView) return
    const controls = animate(mv, value, { duration: 1.1, ease: EASE })
    return controls.stop
  }, [inView, reduced, value, mv])

  return (
    <motion.span ref={ref} className={className} style={style}>
      {reduced ? value.toLocaleString() : text}
    </motion.span>
  )
}

/** Mono uppercase eyebrow. tone switches the color for night vs day bands. */
export function MonoEyebrow({
  children,
  tone = 'day',
  style,
}: {
  children: ReactNode
  tone?: 'day' | 'night'
  style?: CSSProperties
}) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: tone === 'night' ? 'var(--alf-on-night-dim)' : 'var(--alf-label)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Centered max-width content column with generous vertical rhythm. */
export function Section({
  children,
  max = 1120,
  className,
  style,
}: {
  children: ReactNode
  max?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={className} style={{ maxWidth: max, margin: '0 auto', padding: '0 24px', ...style }}>
      {children}
    </div>
  )
}

/** A full-bleed deep-indigo "night" band (hero / trust / closing). */
export function NightBand({
  children,
  style,
  id,
}: {
  children: ReactNode
  style?: CSSProperties
  id?: string
}) {
  return (
    <section
      id={id}
      style={{
        position: 'relative',
        background:
          'radial-gradient(120% 80% at 50% -10%, var(--alf-night-glow), transparent 60%), linear-gradient(180deg, var(--alf-night-2), var(--alf-night-1))',
        color: 'var(--alf-on-night)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </section>
  )
}
