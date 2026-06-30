/**
 * Fit-score badge (DESIGN-SPEC §4). Label-primary, score-secondary, never a
 * bare %. Strong = green, Stretch = blue.
 *  - size="card"   : pill 5px 9px, 6px dot, shows the SCORE only.
 *  - size="detail" : pill 8px 13px, 7px dot, shows "{label} · {score}".
 */
export type FitVariant = 'strong' | 'stretch'

export interface FitBadgeProps {
  label: string
  score: number | string
  variant: FitVariant
  size?: 'card' | 'detail'
}

export function FitBadge({ label, score, variant, size = 'card' }: FitBadgeProps) {
  const bg = variant === 'strong' ? 'var(--alf-strong-bg)' : 'var(--alf-stretch-bg)'
  const fg = variant === 'strong' ? 'var(--alf-strong-fg)' : 'var(--alf-stretch-fg)'
  const isDetail = size === 'detail'
  const dot = isDetail ? 7 : 6
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isDetail ? 7 : 5,
        flexShrink: 0,
        padding: isDetail ? '8px 13px' : '5px 9px',
        borderRadius: 99,
        background: bg,
      }}
    >
      <div style={{ width: dot, height: dot, borderRadius: '50%', background: fg }} />
      <span style={{ fontSize: isDetail ? 13 : 12, fontWeight: isDetail ? 700 : 600, color: fg }}>
        {isDetail ? `${label} · ${score}` : score}
      </span>
    </div>
  )
}
