/**
 * Brief greeting / empty detail state (DESIGN-SPEC §3.1): the halo'd mascot, a
 * mono "{greeting}, {name}" eyebrow, the headline, the real stat row, and the
 * "select a role" prompt.
 *
 * The numbers are honest and dynamic (see computeBriefStats): "postings read" is
 * how many postings Alfred actually evaluated FOR this user, never the static
 * total pool. When there is nothing to show yet, the hero renders a warm
 * warming / genuine-empty state instead of a row of fake-looking zeros.
 */
import Alfred from '../Alfred'
import { Button } from '../ui/alfred'
import { greeting, type BriefStats } from './helpers'

export interface BriefGreetingProps {
  firstName: string
  status: 'loading' | 'ready'
  hasProfile: boolean
  recomputing: boolean
  stats: BriefStats
  onAdjustTargeting: () => void
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 30, fontWeight: 500, color: 'var(--alf-indigo)', lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 13, color: 'var(--alf-muted)', marginTop: 6 }}>{label}</div>
    </div>
  )
}

const SHELL: React.CSSProperties = {
  // minHeight in vh (not height:100%) so the centered hero always shows: a
  // height:100% child of a stretched flex item can resolve to 0 in Chromium.
  minHeight: '100vh',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '60px 48px',
}

const EYEBROW: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--alf-label)',
  marginBottom: 16,
}

const HEADLINE: React.CSSProperties = {
  fontSize: 30,
  lineHeight: 1.3,
  fontWeight: 500,
  maxWidth: 540,
  margin: '0 0 30px',
  letterSpacing: '-.015em',
  color: 'var(--alf-ink)',
}

const HELPER: React.CSSProperties = { fontSize: 14, color: 'var(--alf-helper)', maxWidth: 360, lineHeight: 1.55 }

export function BriefGreeting({ firstName, status, hasProfile, recomputing, stats, onAdjustTargeting }: BriefGreetingProps) {
  const { scanVolume, consideredTotal, readLatestCycle, worth, strong, isFirstBrief } = stats

  // Warming: no verdicts yet (first read in progress, or profile still loading).
  const warming = status === 'loading' || !hasProfile || consideredTotal === 0
  // Genuine empty: Alfred has read postings but none qualified for this user.
  const empty = !warming && worth === 0

  if (warming) {
    return (
      <div style={SHELL}>
        <div style={{ marginBottom: 28 }}>
          <Alfred size="lg" mood="working" halo haloInset={-20} haloDuration={3} />
        </div>
        <div className="mono" style={EYEBROW}>{greeting()}, {firstName}</div>
        <h1 style={HEADLINE}>I&rsquo;m reading the market for you.</h1>
        <div style={HELPER}>
          Your first brief is on its way. I&rsquo;ll have a short, honest list of the roles worth your time in just a moment.
        </div>
      </div>
    )
  }

  if (empty) {
    return (
      <div style={SHELL}>
        <div style={{ marginBottom: 28 }}>
          <Alfred size="lg" halo haloInset={-20} haloDuration={3} />
        </div>
        <div className="mono" style={EYEBROW}>{greeting()}, {firstName}</div>
        <h1 style={HEADLINE}>
          I read {scanVolume.toLocaleString()} {plural(scanVolume, 'posting', 'postings')} for you, but none are a strong enough fit yet.
        </h1>
        <div style={HELPER}>
          Try widening the roles or locations you&rsquo;re open to, and I&rsquo;ll take another look.
        </div>
        <Button variant="soft" tone="tint2" onClick={onAdjustTargeting} style={{ marginTop: 18 }}>
          Adjust your targeting
        </Button>
      </div>
    )
  }

  const worthSentence = `${worth} ${plural(worth, 'is', 'are')} worth your time.`
  const strongSentence = strong > 0 ? ` ${strong} ${plural(strong, 'is a strong fit', 'are strong fits')}.` : ''
  const lead = isFirstBrief
    ? `I've read ${scanVolume.toLocaleString()} ${plural(scanVolume, 'posting', 'postings')} for you.`
    : readLatestCycle > 0
      ? `While you slept I read ${scanVolume.toLocaleString()} ${plural(scanVolume, 'posting', 'postings')} for you.`
      : `Here's your brief.`

  return (
    <div style={SHELL}>
      <div style={{ marginBottom: 28 }}>
        <Alfred size="lg" halo haloInset={-20} haloDuration={3} />
      </div>
      <div className="mono" style={EYEBROW}>{greeting()}, {firstName}</div>
      <h1 style={HEADLINE}>{`${lead} ${worthSentence}${strongSentence}`}</h1>
      <div style={{ display: 'flex', gap: 36, marginBottom: 28 }}>
        <Stat value={scanVolume} label="postings read" />
        <Stat value={worth} label="worth your time" />
        <Stat value={strong} label="strong fits" />
      </div>
      <div style={HELPER}>Select a role on the left and I&rsquo;ll walk you through it. &rarr;</div>
    </div>
  )
}
