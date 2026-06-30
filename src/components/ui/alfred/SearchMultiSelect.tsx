/**
 * SearchMultiSelect (DESIGN-SPEC §4): a magnifier search input over a wrapped,
 * scrollable chip area. Selected chips render first; a leading dashed "+ Add"
 * chip appears when the query matches nothing existing; Enter or the add-chip
 * commits a custom value.
 */
import { type KeyboardEvent } from 'react'
import { SearchIcon } from './icons'
import { Chip, AddChip } from './Chip'

export interface SearchMultiSelectProps {
  placeholder: string
  query: string
  onQueryChange: (value: string) => void
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
  /** Commit the current query as a custom value. */
  onAdd: () => void
  maxHeight?: number
  /** onboarding uses #fff; profile uses the inset #FBFCFF. */
  inputBg?: string
}

export function SearchMultiSelect({
  placeholder,
  query,
  onQueryChange,
  options,
  selected,
  onToggle,
  onAdd,
  maxHeight = 174,
  inputBg = 'var(--alf-surface)',
}: SearchMultiSelectProps) {
  const q = query.trim().toLowerCase()
  const showAdd = q !== '' && ![...options, ...selected].some((o) => o.toLowerCase() === q)
  const unselected = options.filter((o) => !selected.includes(o) && (!q || o.toLowerCase().includes(q)))

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onAdd()
    }
  }

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span style={{ position: 'absolute', left: 13, top: 13, color: 'var(--alf-disabled)' }}>
          <SearchIcon size={16} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            width: '100%',
            fontFamily: 'inherit',
            fontSize: 14,
            padding: '11px 14px 11px 38px',
            borderRadius: 12,
            border: '1.5px solid var(--alf-input-border)',
            outline: 'none',
            background: inputBg,
            color: 'var(--alf-ink)',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, maxHeight, overflowY: 'auto', padding: 2 }}>
        {showAdd && <AddChip query={query.trim()} onClick={onAdd} />}
        {selected.map((o) => (
          <Chip key={o} selected onClick={() => onToggle(o)}>{o}</Chip>
        ))}
        {unselected.map((o) => (
          <Chip key={o} onClick={() => onToggle(o)}>{o}</Chip>
        ))}
      </div>
    </div>
  )
}
