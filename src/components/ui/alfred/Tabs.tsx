/**
 * Tabs (DESIGN-SPEC §4): a 1px bottom-divider row with 2.5px-underline tabs.
 * Active = ink text + indigo underline; inactive = #9098BC + transparent.
 */
export interface TabsOption<T extends string = string> {
  value: T
  label: string
}
export interface TabsProps<T extends string = string> {
  tabs: TabsOption<T>[]
  value: T
  onChange: (value: T) => void
}
export function Tabs<T extends string = string>({ tabs, value, onChange }: TabsProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--alf-border)' }}>
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            style={{
              fontFamily: 'inherit',
              fontSize: 14.5,
              fontWeight: 600,
              color: active ? 'var(--alf-ink)' : 'var(--alf-disabled)',
              background: 'transparent',
              border: 'none',
              borderBottom: `2.5px solid ${active ? 'var(--alf-indigo)' : 'transparent'}`,
              padding: '11px 14px',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'all .15s',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
