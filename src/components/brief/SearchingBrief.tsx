/**
 * SearchingBrief -- what the brief shows while Alfred is actually reading.
 *
 * This screen exists because the first-run search takes minutes (80 postings, ten
 * per Haiku call, across DO alarm ticks) and the app used to spend those minutes
 * claiming it had finished and found nothing. The shape is borrowed from Scout's
 * "Laila is in the field": a radar on the left, a live line, a phase label, real
 * counters, a progress bar, and a rolling log on the right.
 *
 * The difference from Scout is the honesty. Scout animates a script (a fixed
 * 14-beat timeline, a hardcoded 214). Alfred cannot: an app whose whole promise is
 * that its numbers are real cannot open with a fake one. So every figure here is
 * the Job's own cursor, and the counters simply sit at zero until the run reports
 * its first tick. The waiting is honest about being waiting.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { MarketRadar } from './MarketRadar'
import { useReducedMotion } from '../landing/motion'
import { PHASE_LABEL, searchLogLines, type SearchState } from './search'

const SHELL: React.CSSProperties = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 48px',
}

const EYEBROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  fontSize: 11,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: 'var(--alf-label)',
}

const HEADLINE: React.CSSProperties = {
  fontSize: 28,
  lineHeight: 1.3,
  fontWeight: 500,
  letterSpacing: '-.015em',
  color: 'var(--alf-ink)',
  margin: '10px 0 26px',
}

const HELPER: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
  color: 'var(--alf-helper)',
  maxWidth: 340,
  marginTop: 22,
}

function Stat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 30,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-.02em',
          color: accent ? 'var(--alf-indigo)' : 'var(--alf-ink)',
        }}
      >
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: 'var(--alf-muted)', marginTop: 6 }}>{label}</div>
    </div>
  )
}

export interface SearchingBriefProps {
  firstName: string
  search: SearchState
}

export function SearchingBrief({ firstName, search }: SearchingBriefProps) {
  const reduced = useReducedMotion()
  const log = searchLogLines(search)
  const label = PHASE_LABEL[search.phase]
  // Until the run reports its first tick there is nothing true to count. Show no
  // counters at all rather than a row of zeros, which reads as a broken result
  // rather than as work in progress.
  const hasCounters = search.total > 0

  return (
    <div style={SHELL}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 44, maxWidth: 720, width: '100%' }}>
        <div style={{ flex: 'none' }} className="radar-col">
          <MarketRadar
            phase={search.phase}
            total={search.total}
            read={search.read}
            kept={search.kept}
            reduced={reduced}
          />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="mono" style={EYEBROW}>
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: 'var(--alf-indigo)',
                animation: reduced ? undefined : 'alfDotBlink 1.4s infinite',
              }}
            />
            Alfred is reading the market for {firstName}
          </div>

          <h1 style={HEADLINE}>
            <AnimatePresence mode="wait">
              <motion.span
                key={label}
                style={{ display: 'block' }}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              >
                {label}.
              </motion.span>
            </AnimatePresence>
          </h1>

          {hasCounters && (
            <>
              <div style={{ display: 'flex', gap: 34, marginBottom: 22 }}>
                <Stat value={search.total} label="in your space" />
                <Stat value={search.read} label="read" />
                <Stat value={search.kept} label="worth your time" accent />
              </div>

              <div
                role="progressbar"
                aria-label="Alfred is reading the market"
                aria-valuenow={Math.round(search.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{
                  height: 3,
                  borderRadius: 3,
                  overflow: 'hidden',
                  background: 'var(--alf-doc-track)',
                  marginBottom: 20,
                }}
              >
                <motion.div
                  style={{ height: '100%', borderRadius: 3, background: 'var(--alf-indigo)' }}
                  initial={false}
                  animate={{ width: `${Math.round(search.progress * 100)}%` }}
                  transition={{ duration: reduced ? 0 : 0.5, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
            </>
          )}

          {/* The rolling log. Every line restates a number the run reported. Held
              back until there are numbers: before that it would only echo the
              headline back at the reader. */}
          {hasCounters && (
            <div
              className="mono"
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap: 7,
                // Fixed, so lines scroll up under the mask instead of shoving the
                // helper text around as they accumulate.
                height: 108,
                overflow: 'hidden',
                fontSize: 12.5,
                WebkitMaskImage: 'linear-gradient(transparent, #000 38%)',
                maskImage: 'linear-gradient(transparent, #000 38%)',
              }}
            >
              {log.map((line, i) => (
                <div
                  key={`${i}-${line}`}
                  style={{
                    color: i === log.length - 1 ? 'var(--alf-ink)' : 'var(--alf-muted)',
                    transition: 'color .3s',
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}

          <div style={HELPER}>
            This usually takes a minute or two. You can leave this page open or come back later. I&rsquo;ll keep reading
            either way, and your roles will appear as I find them.
          </div>
        </div>
      </div>
    </div>
  )
}
