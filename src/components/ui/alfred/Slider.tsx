/**
 * Slider (DESIGN-SPEC §4): native range input, indigo accent, with the mono
 * value shown above. Year mode 20-250 step 5 -> "~$Nk"; hour mode 15-120
 * step 1 -> "~$N/hr".
 */
import type { ChangeEvent } from 'react'

export interface SliderProps {
  mode: 'year' | 'hour'
  value: number
  onChange: (value: number) => void
}

export function Slider({ mode, value, onChange }: SliderProps) {
  const isYear = mode === 'year'
  const label = isYear ? `~$${value}k` : `~$${value}/hr`
  const handle = (e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))
  return (
    <div>
      <span className="mono" style={{ fontSize: 24, fontWeight: 500, color: 'var(--alf-indigo)' }}>{label}</span>
      <input
        type="range"
        min={isYear ? 20 : 15}
        max={isYear ? 250 : 120}
        step={isYear ? 5 : 1}
        value={value}
        onChange={handle}
        style={{ width: '100%', marginTop: 10, accentColor: 'var(--alf-indigo)' }}
      />
    </div>
  )
}
