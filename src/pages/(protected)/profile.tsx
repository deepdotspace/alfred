/**
 * Profile & preferences (DESIGN-SPEC §3.4) + founder-required additions.
 *
 * Reads the single owner-scoped `profile` row and edits it in place. Every edit
 * writes back via useMutations.put (debounced, with updated_at bumped). Changes
 * to TARGETING also enqueue a match recompute (P3's `match-recompute` action) so
 * tomorrow's brief reflects the new preferences.
 *
 * Sections: Identity, Basics (editable), Experience (editable master profile),
 * Roles, Stage, Locations, Work auth, Pay, In your own words, Writing references
 * (with the Reference Editor overlay + upload), and Settings.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutations, useQuery, useR2Files, signOut } from 'deepspace'
import { LogOut } from 'lucide-react'
import type { ProfileData, TargetingPrefs, WritingReference } from '../../types'
import {
  SearchMultiSelect, StageMultiSelect, VisaToggle, Slider, PillToggle, Button,
} from '../../components/ui/alfred'
import { TextInput, Field, SectionCard, Row } from '../../components/profile/fields'
import { ExperienceEditor } from '../../components/profile/ExperienceEditor'
import { ReferenceEditor } from '../../components/profile/ReferenceEditor'
import { Toast, useToast } from '../../components/profile/Toast'
import {
  ROLE_OPTION_LABELS, LOCATION_OPTIONS, STAGE_TYPE_OPTIONS, type PayMode,
  roleIdsToLabels, toggleRole, addCustomRole, toggleIntent, normalizeIntent,
  payToFloor, floorToPay, visaToWorkAuth, needsSponsorship, newId, fileToBase64, callAction,
} from '../../components/profile/shared'

const half: React.CSSProperties = { flex: '1 1 200px', minWidth: 0 }

function scrub(p: ProfileData): ProfileData {
  const clean = (a: string[]) => a.map((s) => s.trim()).filter(Boolean)
  return {
    ...p,
    education: p.education.map((e) => ({ ...e, details: clean(e.details) })),
    work: p.work.map((w) => ({ ...w, bullets: clean(w.bullets) })),
    projects: p.projects.map((pr) => ({ ...pr, bullets: clean(pr.bullets) })),
    skills: p.skills.map((s) => ({ ...s, items: clean(s.items) })),
    achievements: clean(p.achievements),
  }
}

export default function ProfilePage() {
  const profile = useQuery<ProfileData>('profile')
  const row = profile.records[0]
  const { put } = useMutations<ProfileData>('profile')
  const { upload } = useR2Files()
  const { toast, showToast } = useToast()

  const [draft, setDraft] = useState<ProfileData | null>(null)
  const initRef = useRef<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recomputeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [roleQuery, setRoleQuery] = useState('')
  const [locQuery, setLocQuery] = useState('')
  const [editing, setEditing] = useState<{ ref: WritingReference; isNew: boolean } | null>(null)

  // Initialize the draft once per record (don't clobber local edits on WS echo).
  useEffect(() => {
    if (row && initRef.current !== row.recordId) {
      initRef.current = row.recordId
      setDraft(row.data)
    }
  }, [row])

  function persist(next: ProfileData) {
    if (!row) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void put(row.recordId, scrub({ ...next, updated_at: new Date().toISOString() }))
    }, 600)
  }
  function update(patch: Partial<ProfileData>) {
    setDraft((d) => {
      if (!d) return d
      const nd = { ...d, ...patch }
      persist(nd)
      return nd
    })
  }
  function recompute() {
    if (recomputeTimer.current) clearTimeout(recomputeTimer.current)
    recomputeTimer.current = setTimeout(() => { void callAction('match-recompute', { mode: 'full' }) }, 1500)
  }
  function setTargeting(patch: Partial<TargetingPrefs>) {
    if (!draft) return
    update({ targeting: { ...draft.targeting, ...patch } })
    recompute()
  }

  async function extractDoc(file: File): Promise<{ text: string; key: string | null }> {
    let key: string | null = null
    try {
      const r = await upload(file)
      if (r.success && r.key) key = r.key
    } catch {
      /* best-effort */
    }
    const base64 = await fileToBase64(file)
    const res = await callAction<{ text: string }>('profile-extract-text', { file: { name: file.name, mime: file.type, base64 } })
    return { text: res.success && res.data?.text ? res.data.text : '', key }
  }

  if (!draft) {
    return <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--alf-bg)' }} />
  }

  const t = draft.targeting
  const pay = floorToPay(t.pay_floor)
  const refs = draft.voice.writing_references ?? []
  const eduHeadline = draft.education[0]
    ? [draft.education[0].degree, draft.education[0].field].filter(Boolean).join(' ') +
      (draft.education[0].end ? ` · graduating ${draft.education[0].end}` : '')
    : draft.basics.location || 'Your master profile, parsed from your resume'
  const nameInitial = (draft.basics.name || 'A').trim().charAt(0).toUpperCase() || 'A'

  function saveReference(ref: WritingReference) {
    const exists = refs.some((r) => r.id === ref.id)
    const nextRefs = exists ? refs.map((r) => (r.id === ref.id ? ref : r)) : [...refs, ref]
    update({ voice: { ...draft!.voice, writing_references: nextRefs } })
    setEditing(null)
    showToast('Reference saved')
  }
  function removeReference(id: string) {
    update({ voice: { ...draft!.voice, writing_references: refs.filter((r) => r.id !== id) } })
  }

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--alf-bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 44px 96px' }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-.02em' }}>Profile &amp; preferences</h1>
        <p style={{ fontSize: 14, color: 'var(--alf-muted)', margin: '0 0 28px' }}>
          Everything I remember about you. Change anything and I'll adjust tomorrow's brief.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Identity */}
          <div style={{ background: 'var(--alf-surface)', border: '1px solid var(--alf-border)', borderRadius: 18, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--alf-avatar-a), var(--alf-avatar-b))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 20 }}>
              {nameInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{draft.basics.name || 'Your name'}</div>
              <div style={{ fontSize: 13.5, color: 'var(--alf-muted)', marginTop: 2 }}>{eduHeadline}</div>
            </div>
          </div>

          {/* Basics (editable) */}
          <SectionCard title="Basics">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Row>
                <Field label="Name" style={half}><TextInput value={draft.basics.name} onChange={(v) => update({ basics: { ...draft.basics, name: v } })} placeholder="Your name" /></Field>
                <Field label="Email" style={half}><TextInput value={draft.basics.email} onChange={(v) => update({ basics: { ...draft.basics, email: v } })} placeholder="you@email.com" /></Field>
              </Row>
              <Row>
                <Field label="Phone" style={half}><TextInput value={draft.basics.phone} onChange={(v) => update({ basics: { ...draft.basics, phone: v } })} placeholder="(555) 000-0000" /></Field>
                <Field label="Location" style={half}><TextInput value={draft.basics.location} onChange={(v) => update({ basics: { ...draft.basics, location: v } })} placeholder="City, State" /></Field>
              </Row>
              <Row>
                <Field label="GitHub" style={half}><TextInput value={draft.basics.links.github ?? ''} onChange={(v) => update({ basics: { ...draft.basics, links: { ...draft.basics.links, github: v } } })} placeholder="github.com/you" /></Field>
                <Field label="LinkedIn" style={half}><TextInput value={draft.basics.links.linkedin ?? ''} onChange={(v) => update({ basics: { ...draft.basics, links: { ...draft.basics.links, linkedin: v } } })} placeholder="linkedin.com/in/you" /></Field>
              </Row>
              <Field label="Portfolio"><TextInput value={draft.basics.links.portfolio ?? ''} onChange={(v) => update({ basics: { ...draft.basics, links: { ...draft.basics.links, portfolio: v } } })} placeholder="yoursite.com" /></Field>
            </div>
          </SectionCard>

          {/* Experience (editable master profile) */}
          <SectionCard title="Experience" subtitle="What I'll draw from when I tailor. Correct anything I misread from your resume.">
            <ExperienceEditor
              value={{ education: draft.education, work: draft.work, projects: draft.projects, skills: draft.skills, achievements: draft.achievements }}
              onChange={(patch) => update(patch)}
            />
          </SectionCard>

          {/* Roles */}
          <SectionCard title="Roles I'm looking for">
            <SearchMultiSelect
              placeholder="Search roles, or type your own…"
              query={roleQuery}
              onQueryChange={setRoleQuery}
              options={ROLE_OPTION_LABELS}
              selected={roleIdsToLabels(t.role_families)}
              onToggle={(label) => setTargeting({ role_families: toggleRole(t.role_families, label) })}
              onAdd={() => { setTargeting({ role_families: addCustomRole(t.role_families, roleQuery) }); setRoleQuery('') }}
              inputBg="var(--alf-inset)"
            />
          </SectionCard>

          {/* Stage */}
          <SectionCard title="Stage">
            <StageMultiSelect
              options={STAGE_TYPE_OPTIONS}
              values={normalizeIntent(t.intent)}
              onToggle={(v) => setTargeting({ intent: toggleIntent(normalizeIntent(t.intent), v) })}
              wrap
            />
          </SectionCard>

          {/* Locations */}
          <SectionCard title="Locations">
            <SearchMultiSelect
              placeholder="Search cities, or type your own…"
              query={locQuery}
              onQueryChange={setLocQuery}
              options={LOCATION_OPTIONS}
              selected={t.locations}
              onToggle={(loc) => setTargeting({ locations: t.locations.includes(loc) ? t.locations.filter((l) => l !== loc) : [...t.locations, loc] })}
              onAdd={() => { const q = locQuery.trim(); if (q && !t.locations.includes(q)) setTargeting({ locations: [...t.locations, q] }); setLocQuery('') }}
              maxHeight={138}
              inputBg="var(--alf-inset)"
            />
          </SectionCard>

          {/* Work auth (the toggle card is the section) */}
          <VisaToggle
            checked={needsSponsorship(t.work_authorization)}
            onChange={(on) => setTargeting({ work_authorization: visaToWorkAuth(on) })}
            title="I'll need visa sponsorship"
            description="When on, I only surface roles where sponsorship is possible."
            cardRadius={18}
            cardPadding="20px 22px"
            borderWidth={1}
          />

          {/* Pay */}
          <SectionCard title="Pay I'm hoping for" action={
            <PillToggle
              variant="pay"
              options={[{ value: 'year', label: 'Per year' }, { value: 'hour', label: 'Per hour' }]}
              value={pay.mode}
              onChange={(v) => {
                const mode = v as PayMode
                setTargeting({ pay_floor: payToFloor(mode, mode === pay.mode ? pay.value : mode === 'year' ? 60 : 45) })
              }}
            />
          }>
            <Slider
              mode={pay.mode}
              value={pay.value}
              onChange={(v) => setTargeting({ pay_floor: payToFloor(pay.mode, v) })}
            />
          </SectionCard>

          {/* In your own words */}
          <SectionCard title="In your own words" subtitle="Preferences, dealbreakers, the kind of team you thrive on. I weigh this when I rank roles.">
            <textarea
              value={t.requirements_freetext}
              onChange={(e) => setTargeting({ requirements_freetext: e.target.value })}
              placeholder="Tell me anything that helps me judge fit…"
              style={{ width: '100%', minHeight: 96, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, color: 'var(--alf-ink)', background: 'var(--alf-inset)', border: '1px solid var(--alf-input-border)', borderRadius: 12, padding: '12px 14px', outline: 'none' }}
            />
          </SectionCard>

          {/* Writing references */}
          <SectionCard
            title="Writing references"
            subtitle="Cover letters or samples I'll study for your voice when I draft. I never copy them. I learn the tone."
            action={<button onClick={() => setEditing({ ref: { id: newId(), title: '', desc: '', content: '', source_key: null }, isNew: true })} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--alf-indigo)', background: 'var(--alf-indigo-tint)', border: 'none', padding: '8px 14px', borderRadius: 10, cursor: 'pointer' }}>+ Add</button>}
          >
            {refs.length === 0 ? (
              <div style={{ border: '1.5px dashed var(--alf-dash-border)', borderRadius: 14, padding: '22px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--alf-faint-2)' }}>
                No references yet. Add a cover letter you're proud of and I'll match your voice.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {refs.map((r) => (
                  <div key={r.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 4px', borderTop: '1px solid var(--alf-hairline)' }}>
                    <div style={{ width: 34, height: 42, flexShrink: 0, background: 'var(--alf-chip-soft)', borderRadius: 6, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '0 6px' }}>
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--alf-dot-inactive)', width: '100%' }} />
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--alf-dot-inactive)', width: '80%' }} />
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--alf-dot-inactive)', width: '90%' }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--alf-ink-doc)' }}>{r.title}</div>
                      {r.desc && <div style={{ fontSize: 13, color: 'var(--alf-helper)', marginTop: 2 }}>{r.desc}</div>}
                      {r.content && (
                        <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--alf-faint)', marginTop: 4 }}>
                          {r.content.replace(/\s+/g, ' ').slice(0, 120)}{r.content.length > 120 ? '…' : ''}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                        <button onClick={() => setEditing({ ref: r, isNew: false })} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--alf-indigo)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>View &amp; edit</button>
                        <button onClick={() => removeReference(r.id)} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--alf-muted)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Settings */}
          <SectionCard title="Settings">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Digest cadence</div>
                  <div style={{ fontSize: 13, color: 'var(--alf-helper)', marginTop: 2 }}>How often I send your brief by email.</div>
                </div>
                <PillToggle
                  variant="pay"
                  options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]}
                  value={draft.settings.digest_cadence}
                  onChange={(v) => update({ settings: { ...draft.settings, digest_cadence: v as 'daily' | 'weekly' } })}
                />
              </div>
              <VisaToggle
                checked={draft.settings.email_enabled}
                onChange={(on) => update({ settings: { ...draft.settings, email_enabled: on } })}
                title="Email me my brief"
                description={`Send the digest to ${draft.basics.email || 'your inbox'}.`}
                cardRadius={14}
              />
              <VisaToggle
                checked={draft.settings.notifications_enabled}
                onChange={(on) => update({ settings: { ...draft.settings, notifications_enabled: on } })}
                title="In-app notifications"
                description="Nudge me when new roles land."
                cardRadius={14}
              />
            </div>
          </SectionCard>
        </div>

        {/* Sign out */}
        <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--alf-hairline)', display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="secondary"
            leftIcon={<LogOut size={15} aria-hidden />}
            onClick={() => { void signOut() }}
          >
            Sign out
          </Button>
        </div>
      </div>

      {editing && (
        <ReferenceEditor
          initial={editing.ref}
          isNew={editing.isNew}
          onSave={saveReference}
          onClose={() => setEditing(null)}
          onExtract={extractDoc}
        />
      )}
      <Toast message={toast} />
    </div>
  )
}
