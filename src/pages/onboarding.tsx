/**
 * /onboarding -- the 6-screen setup flow (DESIGN-SPEC §3.0-3.5), full-screen
 * OUTSIDE the AppShell rail. Gated to signed-in users; renders the gradient
 * shell + halo'd Alfred + the current step. On finish it writes the master
 * `profile` row (which is what marks onboarding complete) and routes to /brief.
 *
 * The key feature is the real resume upload + AI parse: the file(s) are read in
 * the browser, stored in R2 (best-effort), and sent to the `profile-parse-resume`
 * server action, which returns a merged structured profile + a ROLE_TAXONOMY
 * pre-selection shown on the targeting step.
 */
import { useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthGate, useUser, useMutations, useQuery, useR2Files } from 'deepspace'
import type { ProfileData } from '../types'
import type { ParseResumeResult } from '../server/profile/parse'
import {
  Button, SearchMultiSelect, StageMultiSelect, VisaToggle, Slider, PillToggle, ResumeChip, SkeletonLines,
} from '../components/ui/alfred'
import { UploadIcon, CheckIcon, WarnCircleIcon } from '../components/ui/alfred/icons'
import { OnboardingShell, FieldLabel, StepFooter } from '../components/onboarding/OnboardingShell'
import {
  ROLE_OPTION_LABELS, LOCATION_OPTIONS, STAGE_TYPE_OPTIONS, type PayMode,
  roleIdsToLabels, toggleRole, addCustomRole, toggleIntent, defaultProfile, defaultTargeting,
  payToFloor, visaToWorkAuth, greeting, newId, fileToBase64, callAction,
} from '../components/profile/shared'
import type { RoleType } from '../types'

const ACCEPT = 'application/pdf,.pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export default function OnboardingPage() {
  return (
    <AuthGate>
      <OnboardingFlow />
    </AuthGate>
  )
}

function OnboardingFlow() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { upload } = useR2Files()
  const { createConfirmed } = useMutations<ProfileData>('profile')

  // If a profile already exists, onboarding is done -> go to the brief.
  const existing = useQuery<ProfileData>('profile')
  const alreadyDone = existing.status === 'ready' && existing.records.length > 0

  const [step, setStep] = useState(0)
  const next = () => setStep((s) => Math.min(s + 1, 5))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  // resume
  const fileInput = useRef<HTMLInputElement>(null)
  const [resumeState, setResumeState] = useState<'idle' | 'reading' | 'done' | 'fail'>('idle')
  const [resumeFiles, setResumeFiles] = useState<File[]>([])
  const [resumeKeys, setResumeKeys] = useState<string[]>([])
  const [parsed, setParsed] = useState<ParseResumeResult | null>(null)
  const [chips, setChips] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  // targeting
  const [roleFamilies, setRoleFamilies] = useState<string[]>([])
  const [roleQuery, setRoleQuery] = useState('')
  // Stage = role-type intent, multi-select. Default to all three early-career stages.
  const [intent, setIntent] = useState<RoleType[]>(['internship', 'co-op', 'new-grad-ft'])
  const [locations, setLocations] = useState<string[]>(['Remote', 'San Francisco'])
  const [locQuery, setLocQuery] = useState('')

  // logistics
  const [needsSponsor, setNeedsSponsor] = useState(false)
  const [payMode, setPayMode] = useState<PayMode>('year')
  const [payYear, setPayYear] = useState(60)
  const [payHour, setPayHour] = useState(45)
  const [words, setWords] = useState('')

  // writing reference
  const [writing, setWriting] = useState('')
  const [writingKey, setWritingKey] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [writingError, setWritingError] = useState<string | null>(null)
  const writingInput = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)

  const userName = useMemo(() => (user?.name ?? '').trim().split(' ')[0] || 'there', [user])

  async function handleResumeFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const incoming = Array.from(list)
    const allFiles = [...resumeFiles, ...incoming]
    setResumeFiles(allFiles)
    setResumeState('reading')
    setParseError(null)

    // Best-effort R2 storage (scope='self'). Local dev lacks APP_IDENTITY_TOKEN
    // so this can 401 -- parse still works from base64 either way.
    for (const f of incoming) {
      try {
        const r = await upload(f)
        if (r.success && r.key) setResumeKeys((k) => [...k, r.key as string])
      } catch {
        /* ignore -- keys are best-effort */
      }
    }

    try {
      const files = await Promise.all(
        allFiles.map(async (f) => ({ name: f.name, mime: f.type, base64: await fileToBase64(f) })),
      )
      const res = await callAction<ParseResumeResult>('profile-parse-resume', { files })
      if (res.success && res.data) {
        setParsed(res.data)
        setChips(res.data.chips)
        setRoleFamilies(res.data.suggested_role_families)
        setResumeState('done')
      } else {
        setResumeState('fail')
        setParseError(res.error ?? 'Something went wrong while reading it.')
      }
    } catch (e) {
      setResumeState('fail')
      setParseError(e instanceof Error ? e.message : 'Something went wrong while reading it.')
    }
  }

  async function handleWritingUpload(file: File) {
    setExtracting(true)
    setWritingError(null)
    let key: string | null = null
    try {
      const r = await upload(file)
      if (r.success && r.key) key = r.key
    } catch {
      /* best-effort */
    }
    const base64 = await fileToBase64(file)
    const res = await callAction<{ text: string }>('profile-extract-text', { file: { name: file.name, mime: file.type, base64 } })
    setExtracting(false)
    if (res.success && res.data?.text) {
      setWriting((p) => (p.trim() ? p + '\n\n' : '') + res.data!.text)
      setWritingKey(key)
    } else {
      setWritingError(res.error ?? 'Could not read that document. You can paste the text instead.')
    }
  }

  async function finish() {
    if (saving) return
    setSaving(true)
    const uid = user?.id ?? ''
    const profile = defaultProfile(uid, user?.name ?? '', user?.email ?? '')

    if (parsed) {
      profile.basics = {
        name: parsed.basics.name || (user?.name ?? ''),
        email: parsed.basics.email || (user?.email ?? ''),
        phone: parsed.basics.phone,
        location: parsed.basics.location,
        links: parsed.basics.links,
      }
      profile.education = parsed.education
      profile.work = parsed.work
      profile.projects = parsed.projects
      profile.skills = parsed.skills
      profile.achievements = parsed.achievements
    }

    profile.targeting = {
      ...defaultTargeting(),
      role_families: roleFamilies,
      intent,
      locations,
      work_authorization: visaToWorkAuth(needsSponsor),
      pay_floor: payToFloor(payMode, payMode === 'year' ? payYear : payHour),
      requirements_freetext: words.trim(),
    }

    const writingContent = writing.trim()
    profile.voice = {
      resume_keys: resumeKeys,
      cover_letter_keys: writingKey ? [writingKey] : [],
      writing_sample: '',
      writing_references: writingContent
        ? [{ id: newId(), title: 'Writing sample (from setup)', desc: 'Voice reference you shared during onboarding.', content: writingContent, source_key: writingKey }]
        : [],
      stories_freetext: '',
    }

    const now = new Date().toISOString()
    profile.created_at = now
    profile.updated_at = now

    try {
      await createConfirmed(profile)
      navigate('/brief', { replace: true })
    } catch {
      setSaving(false)
    }
  }

  if (alreadyDone) return <Navigate to="/brief" replace />

  const writingCta = writing.trim() || writingKey ? 'Save & continue' : 'Skip for now'

  return (
    <OnboardingShell step={step}>
      {step === 0 && (
        <div style={{ animation: 'fadeUp .5s ease both' }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--alf-label)', marginBottom: 14 }}>
            Your career butler
          </div>
          <h1 style={{ fontSize: 34, lineHeight: 1.15, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-.02em' }}>
            {greeting()}.<br />I'm Alfred.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--alf-muted-2)', maxWidth: 400, margin: '0 auto 30px' }}>
            Tonight, while you rest, I'll begin reading the job market for you. First, a few quiet questions, so I bring back only roles worth your time.
          </p>
          <Button variant="primary-lg" onClick={next}>Let's begin</Button>
        </div>
      )}

      {step === 1 && (
        <div style={{ width: '100%', animation: 'fadeUp .5s ease both' }}>
          <h1 style={{ fontSize: 27, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-.02em' }}>Hand me your resume</h1>
          <p style={{ fontSize: 16, color: 'var(--alf-muted-2)', margin: '0 0 26px' }}>
            I'll read it once, carefully, and remember everything, so you never paste it again.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { void handleResumeFiles(e.target.files); e.target.value = '' }}
          />

          {resumeState === 'idle' && <ResumeDropzone onClick={() => fileInput.current?.click()} />}

          {resumeState === 'reading' && (
            <div style={{ background: 'var(--alf-surface)', borderRadius: 20, padding: 30, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              <div className="mono" style={{ fontSize: 13, color: 'var(--alf-indigo)' }}>Alfred is reading…</div>
              <div style={{ width: '100%' }}>
                <SkeletonLines widths={['70%', '90%', '55%']} />
              </div>
            </div>
          )}

          {resumeState === 'done' && (
            <div style={{ background: 'var(--alf-surface)', borderRadius: 20, padding: 26, textAlign: 'left', animation: 'fadeUp .4s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--alf-strong-bg)', color: 'var(--alf-strong-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckIcon size={14} />
                </span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Read. Here's what I learned:</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {chips.map((c, i) => <ResumeChip key={i}>{c}</ResumeChip>)}
              </div>
              <button
                onClick={() => fileInput.current?.click()}
                style={{ marginTop: 16, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--alf-indigo)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                + Add another resume
              </button>
            </div>
          )}

          {resumeState === 'fail' && (
            <div style={{ background: 'var(--alf-surface)', borderRadius: 20, padding: 26, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: 'var(--alf-amber-icon)' }}>
                <WarnCircleIcon size={20} />
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--alf-ink)' }}>I couldn't read that one.</span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--alf-helper)', margin: '0 0 16px', lineHeight: 1.5 }}>
                {parseError} Try a PDF or DOCX export, and I'll give it another go.
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Button variant="soft" tone="tint" onClick={() => { setResumeState('idle'); setResumeFiles([]) }}>Try again</Button>
                <button
                  onClick={next}
                  style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'var(--alf-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Continue without it
                </button>
              </div>
            </div>
          )}

          <StepFooter>
            <Button variant="ghost" onClick={back}>Back</Button>
            <Button variant="primary-md" disabled={resumeState !== 'done'} onClick={next}>Continue</Button>
          </StepFooter>
        </div>
      )}

      {step === 2 && (
        <div style={{ width: '100%', textAlign: 'left', animation: 'fadeUp .5s ease both' }}>
          <h1 style={{ fontSize: 27, fontWeight: 600, margin: '0 0 8px', textAlign: 'center', letterSpacing: '-.02em' }}>What should I look for?</h1>
          <p style={{ fontSize: 16, color: 'var(--alf-muted-2)', margin: '0 0 26px', textAlign: 'center' }}>Pick what fits. You can change any of this later.</p>

          <FieldLabel>Roles I'm drawn to</FieldLabel>
          <div style={{ marginBottom: 24 }}>
            <SearchMultiSelect
              placeholder="Search roles, or type your own…"
              query={roleQuery}
              onQueryChange={setRoleQuery}
              options={ROLE_OPTION_LABELS}
              selected={roleIdsToLabels(roleFamilies)}
              onToggle={(label) => setRoleFamilies(toggleRole(roleFamilies, label))}
              onAdd={() => { setRoleFamilies(addCustomRole(roleFamilies, roleQuery)); setRoleQuery('') }}
            />
          </div>

          <FieldLabel>Stage</FieldLabel>
          <div style={{ marginBottom: 24 }}>
            <StageMultiSelect
              options={STAGE_TYPE_OPTIONS}
              values={intent}
              onToggle={(v) => setIntent((prev) => toggleIntent(prev, v))}
            />
          </div>

          <FieldLabel>Where</FieldLabel>
          <SearchMultiSelect
            placeholder="Search cities, or type your own…"
            query={locQuery}
            onQueryChange={setLocQuery}
            options={LOCATION_OPTIONS}
            selected={locations}
            onToggle={(loc) => setLocations(locations.includes(loc) ? locations.filter((l) => l !== loc) : [...locations, loc])}
            onAdd={() => { const q = locQuery.trim(); if (q && !locations.includes(q)) setLocations([...locations, q]); setLocQuery('') }}
            maxHeight={138}
          />

          <StepFooter>
            <Button variant="ghost" onClick={back}>Back</Button>
            <Button variant="primary-md" onClick={next}>Continue</Button>
          </StepFooter>
        </div>
      )}

      {step === 3 && (
        <div style={{ width: '100%', textAlign: 'left', animation: 'fadeUp .5s ease both' }}>
          <h1 style={{ fontSize: 27, fontWeight: 600, margin: '0 0 8px', textAlign: 'center', letterSpacing: '-.02em' }}>A few honest details</h1>
          <p style={{ fontSize: 16, color: 'var(--alf-muted-2)', margin: '0 0 26px', textAlign: 'center' }}>These help me filter out roles that would waste your time.</p>

          <div style={{ marginBottom: 14 }}>
            <VisaToggle
              checked={needsSponsor}
              onChange={setNeedsSponsor}
              title="I'll need visa sponsorship"
              description="I'll only show roles where it's possible."
            />
          </div>

          <div style={{ background: 'var(--alf-surface)', border: '1.5px solid var(--alf-border)', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Pay I'm hoping for</div>
              <PillToggle
                variant="pay"
                options={[{ value: 'year', label: 'Per year' }, { value: 'hour', label: 'Per hour' }]}
                value={payMode}
                onChange={(v) => setPayMode(v as PayMode)}
              />
            </div>
            <Slider
              mode={payMode}
              value={payMode === 'year' ? payYear : payHour}
              onChange={(v) => (payMode === 'year' ? setPayYear(v) : setPayHour(v))}
            />
          </div>

          <div style={{ background: 'var(--alf-surface)', border: '1.5px solid var(--alf-border)', borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              In your own words <span style={{ color: 'var(--alf-faint-2)', fontWeight: 400 }}>(optional)</span>
            </div>
            <textarea
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder="Dealbreakers, dream companies, the kind of team you thrive on…"
              style={{ width: '100%', minHeight: 72, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, color: 'var(--alf-ink)', border: 'none', outline: 'none', background: 'transparent', lineHeight: 1.5 }}
            />
          </div>

          <StepFooter>
            <Button variant="ghost" onClick={back}>Back</Button>
            <Button variant="primary-md" onClick={next}>Almost done</Button>
          </StepFooter>
        </div>
      )}

      {step === 4 && (
        <div style={{ width: '100%', textAlign: 'left', animation: 'fadeUp .5s ease both' }}>
          <h1 style={{ fontSize: 27, fontWeight: 600, margin: '0 0 8px', textAlign: 'center', letterSpacing: '-.02em' }}>Have a cover letter you love?</h1>
          <p style={{ fontSize: 16, color: 'var(--alf-muted-2)', margin: '0 0 8px', textAlign: 'center' }}>
            Paste one you've written and I'll learn your voice from it: your rhythm, your honesty, the way you open.
          </p>
          <p style={{ fontSize: 13.5, color: 'var(--alf-faint)', margin: '0 0 22px', textAlign: 'center' }}>Entirely optional. Skip it and I'll write from scratch.</p>

          <div style={{ background: 'var(--alf-surface)', border: '1.5px solid var(--alf-border)', borderRadius: 16, padding: '6px 6px 0' }}>
            <textarea
              value={writing}
              onChange={(e) => setWriting(e.target.value)}
              placeholder="Paste a cover letter or writing sample here…"
              style={{ width: '100%', minHeight: 170, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, color: 'var(--alf-ink)', border: 'none', outline: 'none', background: 'transparent', padding: 14 }}
            />
          </div>

          <input
            ref={writingInput}
            type="file"
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleWritingUpload(f); e.target.value = '' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => writingInput.current?.click()}
              disabled={extracting}
              style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--alf-indigo)', background: 'var(--alf-indigo-tint-2)', border: '1px solid var(--alf-chip-border)', padding: '7px 13px', borderRadius: 99, cursor: extracting ? 'default' : 'pointer' }}
            >
              {extracting ? 'Reading the document…' : 'Or upload a doc / PDF'}
            </button>
            {writingError && <span style={{ fontSize: 12.5, color: 'var(--alf-amber-icon)' }}>{writingError}</span>}
          </div>

          <StepFooter>
            <Button variant="ghost" onClick={back}>Back</Button>
            <Button variant="primary-md" onClick={next}>{writingCta}</Button>
          </StepFooter>
        </div>
      )}

      {step === 5 && (
        <div style={{ animation: 'fadeUp .5s ease both' }}>
          <h1 style={{ fontSize: 30, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-.02em' }}>Wonderful.</h1>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--alf-muted-2)', maxWidth: 400, margin: '0 auto 30px' }}>
            Get some rest, {userName}. I'll read through the night and have a short, honest brief waiting for you by morning.
          </p>
          <Button variant="primary-lg" working={saving} onClick={finish}>
            {saving ? 'Getting things ready…' : "Wake me when it's ready →"}
          </Button>
        </div>
      )}
    </OnboardingShell>
  )
}

function ResumeDropzone({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        fontFamily: 'inherit',
        cursor: 'pointer',
        background: hover ? 'var(--alf-dropzone-hover)' : 'var(--alf-surface)',
        border: `2px dashed ${hover ? 'var(--alf-indigo)' : 'var(--alf-dropzone-dash)'}`,
        borderRadius: 20,
        padding: '38px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        transition: 'border-color .2s, background .2s',
      }}
    >
      <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--alf-indigo-tint)', color: 'var(--alf-indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <UploadIcon size={22} />
      </span>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--alf-ink)' }}>Drop your resume, or click to upload</span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--alf-helper)' }}>PDF · DOCX · up to 10MB</span>
    </button>
  )
}
