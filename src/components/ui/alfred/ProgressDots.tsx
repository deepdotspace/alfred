/**
 * ProgressDots (DESIGN-SPEC §3.0 / §4): a row of pills; the active step's dot
 * widens to 26px. Every dot up to and including `active` is filled indigo.
 */
export interface ProgressDotsProps {
  count?: number
  active: number
}
export function ProgressDots({ count = 6, active }: ProgressDotsProps) {
  return (
    <div style={{ display: 'flex', gap: 7, justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 6,
            borderRadius: 99,
            transition: 'all .4s cubic-bezier(.4,0,.2,1)',
            width: i === active ? 26 : 6,
            background: i <= active ? 'var(--alf-indigo)' : 'var(--alf-dot-inactive)',
          }}
        />
      ))}
    </div>
  )
}
