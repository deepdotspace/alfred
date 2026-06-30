/**
 * ReferenceEditor (DESIGN-SPEC §3.5): full-screen overlay to add/edit a writing
 * reference Alfred studies for voice. Title + description + the full piece, plus
 * the founder-required UPLOAD (doc/PDF) path that extracts text into the body.
 */
import { useRef, useState } from 'react'
import type { WritingReference } from '../../types'
import { Button } from '../ui/alfred'
import { StarIcon } from '../ui/alfred/icons'

const ACCEPT = 'application/pdf,.pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function ReferenceEditor({
  initial,
  isNew,
  onSave,
  onClose,
  onExtract,
}: {
  initial: WritingReference
  isNew: boolean
  onSave: (ref: WritingReference) => void
  onClose: () => void
  onExtract: (file: File) => Promise<{ text: string; key: string | null }>
}) {
  const [title, setTitle] = useState(initial.title)
  const [desc, setDesc] = useState(initial.desc)
  const [content, setContent] = useState(initial.content)
  const [sourceKey, setSourceKey] = useState<string | null>(initial.source_key)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setExtracting(true)
    setError(null)
    const res = await onExtract(file)
    setExtracting(false)
    if (res.text) {
      setContent((c) => (c.trim() ? c + '\n\n' : '') + res.text)
      setSourceKey(res.key)
    } else {
      setError('Could not read that document. You can paste the text instead.')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'var(--alf-bg)', display: 'flex', flexDirection: 'column', animation: 'fadeIn .28s ease both' }}>
      {/* top bar */}
      <div style={{ height: 66, flexShrink: 0, background: 'var(--alf-surface)', borderBottom: '1px solid var(--alf-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px' }}>
        <Button variant="secondary" onClick={onClose}>← Back to settings</Button>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--alf-ink)' }}>{isNew ? 'New writing reference' : 'Edit writing reference'}</div>
        <Button variant="primary-rect" radius={10} style={{ padding: '10px 20px' }} onClick={() => onSave({ id: initial.id, title: title.trim() || 'Untitled reference', desc: desc.trim(), content, source_key: sourceKey })}>
          Save
        </Button>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '34px 24px 80px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--alf-surface)', borderRadius: 8, boxShadow: '0 4px 30px -10px rgba(30,40,80,.22)', padding: '46px 52px' }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={'Give it a title, e.g. "Northstar cover letter"'}
            style={{ width: '100%', fontFamily: 'inherit', fontSize: 23, fontWeight: 700, color: 'var(--alf-ink-doc)', border: 'none', outline: 'none', background: 'transparent', marginBottom: 8 }}
          />
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Add a short description: when would you reach for this voice?"
            style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, color: 'var(--alf-muted)', border: 'none', outline: 'none', background: 'transparent', marginBottom: 18 }}
          />

          <input ref={fileInput} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = '' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={extracting}
              style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--alf-indigo)', background: 'var(--alf-indigo-tint-2)', border: '1px solid var(--alf-chip-border)', padding: '7px 13px', borderRadius: 99, cursor: extracting ? 'default' : 'pointer' }}
            >
              {extracting ? 'Reading the document…' : 'Upload a doc / PDF'}
            </button>
            {error && <span style={{ fontSize: 12.5, color: 'var(--alf-amber-icon)' }}>{error}</span>}
          </div>

          <div style={{ height: 1, background: 'var(--alf-hairline)', margin: '0 0 18px' }} />

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste or write the full piece here…"
            style={{ width: '100%', minHeight: 440, resize: 'vertical', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.8, color: 'var(--alf-body-5)', border: 'none', outline: 'none', background: 'transparent' }}
          />
        </div>

        <div style={{ maxWidth: 720, margin: '18px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--alf-helper)' }}>
          <span style={{ color: 'var(--alf-sparkle-icon)', display: 'inline-flex' }}><StarIcon size={14} /></span>
          <span style={{ fontSize: 12.5 }}>I study this for tone and rhythm only. I never paste your words verbatim into an application.</span>
        </div>
      </div>
    </div>
  )
}
