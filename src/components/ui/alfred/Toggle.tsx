/**
 * VisaToggle (DESIGN-SPEC §4): the whole row is a clickable card; a 46x27 pill
 * track with a 21px knob sits on the right. Card border turns indigo when on.
 */
export interface VisaToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  title: string
  description: string
  /** step3 card = radius 16 / 1.5px border; profile card = radius 18 / 1px border. */
  cardRadius?: number
  cardPadding?: string
  borderWidth?: number
}
export function VisaToggle({ checked, onChange, title, description, cardRadius = 16, cardPadding = '18px 20px', borderWidth = 1.5 }: VisaToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '100%',
        fontFamily: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        background: 'var(--alf-surface)',
        border: `${borderWidth}px solid ${checked ? 'var(--alf-indigo)' : 'var(--alf-border)'}`,
        borderRadius: cardRadius,
        padding: cardPadding,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        transition: 'border-color .2s',
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--alf-helper)', marginTop: 2 }}>{description}</div>
      </div>
      <div
        style={{
          width: 46,
          height: 27,
          borderRadius: 99,
          background: checked ? 'var(--alf-indigo)' : 'var(--alf-input-border)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background .2s',
        }}
      >
        <div
          style={{
            width: 21,
            height: 21,
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: 3,
            left: checked ? 22 : 3,
            transition: 'left .2s',
            boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }}
        />
      </div>
    </button>
  )
}
