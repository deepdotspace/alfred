/**
 * DEV-ONLY design-system showcase. Renders the AppShell + every Alfred
 * primitive at every variant so the design foundation can be screenshot-verified
 * against DESIGN-SPEC. Not reachable in a production build.
 */
import { useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import Alfred from '../components/Alfred'
import { AppShell } from '../components/shell/AppShell'
import { useToast } from '../components/ui'
import {
  Button, Chip, AddChip, StageSegmented, PillToggle, MetaPill, ResumeChip, DocSkillChip, RefineChip,
  FitBadge, Card, RoleCard, Tabs, VisaToggle, Slider, ProgressDots, SearchMultiSelect,
  AlfredNote, TrustNote, SkelBar, SkeletonLines, DownloadIcon, RefreshIcon, UploadIcon,
} from '../components/ui/alfred'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div className="mono" style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--alf-label)', marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>{children}</div>
    </section>
  )
}

const ROLE_OPTS = ['Product Design', 'Frontend Engineering', 'Backend Engineering', 'Data Analyst', 'UX Research', 'Product Management']

export default function DevUI() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />
  return <Showcase />
}

function Showcase() {
  const { success } = useToast()
  const [tab, setTab] = useState('fit')
  const [stage, setStage] = useState('both')
  const [payMode, setPayMode] = useState('year')
  const [docTab, setDocTab] = useState('resume')
  const [visa, setVisa] = useState(true)
  const [year, setYear] = useState(60)
  const [hour, setHour] = useState(45)
  const [roleQuery, setRoleQuery] = useState('')
  const [roles, setRoles] = useState<string[]>(['Product Design', 'Frontend Engineering'])

  const toggleRole = (v: string) => setRoles((r) => (r.includes(v) ? r.filter((x) => x !== v) : [...r, v]))
  const addRole = () => {
    const q = roleQuery.trim()
    if (q && !roles.some((r) => r.toLowerCase() === q.toLowerCase())) setRoles((r) => [...r, q])
    setRoleQuery('')
  }

  return (
    <div>
      {/* ── App shell preview ── */}
      <div style={{ height: '100vh' }}>
        <AppShell userInitial="M" activePath="/brief">
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 48px', textAlign: 'center' }}>
            <div style={{ marginBottom: 28 }}>
              <Alfred size="lg" halo haloInset={-20} haloDuration={3} />
            </div>
            <div className="mono" style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--alf-meta)', marginBottom: 18 }}>Good morning, Maya</div>
            <h1 style={{ fontSize: 30, lineHeight: 1.3, fontWeight: 500, maxWidth: 540, margin: 0, letterSpacing: '-.015em' }}>
              The AppShell rail, content area, and base world.
            </h1>
          </div>
        </AppShell>
      </div>

      {/* ── Primitive gallery ── */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '56px 44px 120px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-.02em', margin: '0 0 4px' }}>Alfred design system</h1>
        <p style={{ fontSize: 16, color: 'var(--alf-muted)', margin: '0 0 40px' }}>Every token and primitive, for screenshot verification.</p>

        <Section title="Mascot · 4 sizes · idle / working / halo">
          <Alfred size="lg" />
          <Alfred size="md" />
          <Alfred size="sm" />
          <Alfred size="xs" />
          <Alfred size="md" mood="working" />
          <div style={{ paddingLeft: 24 }}><Alfred size="md" halo /></div>
        </Section>

        <Section title="Buttons">
          <Button variant="primary-lg">Let's begin</Button>
          <Button variant="primary-md">Continue</Button>
          <Button variant="primary-md" elevated>Tailor my resume &amp; cover letter</Button>
          <Button variant="primary-md" disabled>Continue</Button>
          <Button variant="dark-cta">Open application ↗</Button>
          <Button variant="soft">+ Add</Button>
          <Button variant="soft" tone="tint2">View &amp; edit</Button>
          <Button variant="secondary">← Back to role</Button>
          <Button variant="ghost">Back</Button>
          <Button variant="icon" aria-label="Download"><DownloadIcon /></Button>
        </Section>

        <Section title="Buttons · rect (Regenerate / Save) + working">
          <div style={{ width: 320 }}>
            <Button variant="primary-rect" block leftIcon={<RefreshIcon />}>Regenerate</Button>
          </div>
          <div style={{ width: 320, marginTop: 10 }}>
            <Button variant="primary-rect" block working leftIcon={<RefreshIcon />}>Rewriting…</Button>
          </div>
          <Button variant="primary-rect" radius={10} style={{ padding: '10px 20px' }}>Save</Button>
        </Section>

        <Section title="Fit badges">
          <FitBadge label="Strong fit" score={94} variant="strong" size="card" />
          <FitBadge label="Worth a look" score={78} variant="stretch" size="card" />
          <FitBadge label="Strong fit" score={94} variant="strong" size="detail" />
          <FitBadge label="Worth a look" score={78} variant="stretch" size="detail" />
        </Section>

        <Section title="Chips & pills">
          <Chip selected>Product Design</Chip>
          <Chip>Backend Engineering</Chip>
          <AddChip query="Robotics" />
          <MetaPill>Remote</MetaPill>
          <ResumeChip>Design systems</ResumeChip>
          <DocSkillChip>React</DocSkillChip>
          <RefineChip>Make it more concise</RefineChip>
        </Section>

        <Section title="Segmented (stage 4-up) + pill toggles (pay / doc)">
          <div style={{ width: 460 }}>
            <StageSegmented
              options={[{ value: 'intern', label: 'Internship' }, { value: 'coop', label: 'Co-op' }, { value: 'newgrad', label: 'New grad' }, { value: 'both', label: 'Both' }]}
              value={stage}
              onChange={setStage}
            />
          </div>
          <PillToggle variant="pay" options={[{ value: 'year', label: 'Per year' }, { value: 'hour', label: 'Per hour' }]} value={payMode} onChange={setPayMode} />
          <PillToggle variant="doc" options={[{ value: 'resume', label: 'Résumé' }, { value: 'cover', label: 'Cover letter' }]} value={docTab} onChange={setDocTab} />
        </Section>

        <Section title="Tabs">
          <div style={{ width: 460 }}>
            <Tabs tabs={[{ value: 'fit', label: "Alfred's read" }, { value: 'jd', label: 'The role' }, { value: 'tailor', label: 'Tailor & apply' }]} value={tab} onChange={setTab} />
          </div>
        </Section>

        <Section title="Visa toggle + pay slider">
          <div style={{ width: 460 }}>
            <VisaToggle checked={visa} onChange={setVisa} title="I'll need visa sponsorship" description="I'll only show roles where it's possible." />
          </div>
          <Card radius={16} padding="18px 20px" style={{ width: 320 }}>
            <Slider mode={payMode as 'year' | 'hour'} value={payMode === 'year' ? year : hour} onChange={payMode === 'year' ? setYear : setHour} />
          </Card>
        </Section>

        <Section title="Progress dots (6, active 3)">
          <ProgressDots count={6} active={2} />
        </Section>

        <Section title="Search multi-select">
          <div style={{ width: 460 }}>
            <SearchMultiSelect
              placeholder="Search roles, or type your own…"
              query={roleQuery}
              onQueryChange={setRoleQuery}
              options={ROLE_OPTS}
              selected={roles}
              onToggle={toggleRole}
              onAdd={addRole}
            />
          </div>
        </Section>

        <Section title="Role card">
          <div style={{ width: 394 }}>
            <RoleCard
              initial="F" avBg="#E7E1FB" avFg="#6B4FD6"
              title="Product Design Intern" company="Figma"
              reason="Your design-systems work maps almost exactly onto what this team needs."
              metaLine="Hybrid · Internship · Summer 2026 · 6h ago"
              fitLabel="Strong fit" fitScore={94} fitVariant="strong" strong
            />
          </div>
        </Section>

        <Section title="Alfred's note + trust notes">
          <div style={{ width: 520 }}>
            <AlfredNote>Your design-systems work maps almost exactly onto what this team needs. I'd send you in with confidence.</AlfredNote>
          </div>
          <div style={{ width: 360 }}>
            <TrustNote tone="soft">I'll only rephrase and reorder what's true. I won't invent skills, numbers, or titles you don't have.</TrustNote>
          </div>
          <div style={{ width: 520 }}>
            <TrustNote tone="amber"><b>Before you send:</b> this role asks for production motion design. I left these out rather than fake them.</TrustNote>
          </div>
          <div style={{ width: 360 }}>
            <TrustNote tone="success" label="LAST CHANGE">Leaned it toward: &ldquo;tighter, lead with impact&rdquo;.</TrustNote>
          </div>
        </Section>

        <Section title="Skeletons + upload icon + toast">
          <div style={{ width: 360 }}>
            <SkeletonLines widths={['70%', '90%', '55%']} />
          </div>
          <SkelBar width={120} />
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--alf-indigo-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--alf-indigo)' }}>
            <UploadIcon />
          </div>
          <Button variant="primary-md" onClick={() => success('Reference saved')}>Fire a toast</Button>
        </Section>
      </div>
    </div>
  )
}
