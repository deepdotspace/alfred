/**
 * ExperienceEditor -- the founder-required editable master profile: education,
 * work roles (with bullets), projects, skills, achievements. The parsed resume
 * pre-fills these; the user can correct anything inline. Stays in the Alfred
 * design language (inset inputs, nested entry cards).
 *
 * Bullets / details are edited one-per-line; skill items are comma-separated.
 */
import type { EducationEntry, WorkEntry, ProjectEntry, SkillGroup } from '../../types'
import { TextInput, TextArea, Field, SubCard, AddBtn, Row } from './fields'

const half: React.CSSProperties = { flex: '1 1 160px', minWidth: 0 }
const linesToArr = (s: string) => s.split('\n')
const arrToLines = (a: string[]) => a.join('\n')
const csvToArr = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

export interface ExperienceValue {
  education: EducationEntry[]
  work: WorkEntry[]
  projects: ProjectEntry[]
  skills: SkillGroup[]
  achievements: string[]
}

export function ExperienceEditor({ value, onChange }: { value: ExperienceValue; onChange: (patch: Partial<ExperienceValue>) => void }) {
  const setEdu = (i: number, patch: Partial<EducationEntry>) =>
    onChange({ education: value.education.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) })
  const setWork = (i: number, patch: Partial<WorkEntry>) =>
    onChange({ work: value.work.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) })
  const setProj = (i: number, patch: Partial<ProjectEntry>) =>
    onChange({ projects: value.projects.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) })
  const setSkill = (i: number, patch: Partial<SkillGroup>) =>
    onChange({ skills: value.skills.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* EDUCATION */}
      <Group label="Education" onAdd={() => onChange({ education: [...value.education, { school: '', degree: '', field: '', start: '', end: '', gpa: null, details: [] }] })}>
        {value.education.map((e, i) => (
          <SubCard key={i} onRemove={() => onChange({ education: value.education.filter((_, idx) => idx !== i) })}>
            <Field label="School"><TextInput value={e.school} onChange={(v) => setEdu(i, { school: v })} placeholder="University" /></Field>
            <Row>
              <Field label="Degree" style={half}><TextInput value={e.degree} onChange={(v) => setEdu(i, { degree: v })} placeholder="B.S." /></Field>
              <Field label="Field" style={half}><TextInput value={e.field} onChange={(v) => setEdu(i, { field: v })} placeholder="Computer Science" /></Field>
            </Row>
            <Row>
              <Field label="Start" style={half}><TextInput value={e.start} onChange={(v) => setEdu(i, { start: v })} placeholder="2022" /></Field>
              <Field label="End" style={half}><TextInput value={e.end} onChange={(v) => setEdu(i, { end: v })} placeholder="2026" /></Field>
              <Field label="GPA" style={half}><TextInput value={e.gpa ?? ''} onChange={(v) => setEdu(i, { gpa: v || null })} placeholder="3.8" /></Field>
            </Row>
          </SubCard>
        ))}
      </Group>

      {/* WORK */}
      <Group label="Work experience" onAdd={() => onChange({ work: [...value.work, { title: '', company: '', location: '', start: '', end: '', bullets: [] }] })}>
        {value.work.map((w, i) => (
          <SubCard key={i} onRemove={() => onChange({ work: value.work.filter((_, idx) => idx !== i) })}>
            <Row>
              <Field label="Title" style={half}><TextInput value={w.title} onChange={(v) => setWork(i, { title: v })} placeholder="Software Engineer Intern" /></Field>
              <Field label="Company" style={half}><TextInput value={w.company} onChange={(v) => setWork(i, { company: v })} placeholder="Company" /></Field>
            </Row>
            <Row>
              <Field label="Location" style={half}><TextInput value={w.location} onChange={(v) => setWork(i, { location: v })} placeholder="City" /></Field>
              <Field label="Start" style={half}><TextInput value={w.start} onChange={(v) => setWork(i, { start: v })} placeholder="Jun 2025" /></Field>
              <Field label="End" style={half}><TextInput value={w.end} onChange={(v) => setWork(i, { end: v })} placeholder="Present" /></Field>
            </Row>
            <Field label="Highlights (one per line)">
              <TextArea value={arrToLines(w.bullets)} onChange={(v) => setWork(i, { bullets: linesToArr(v) })} minHeight={92} placeholder="Shipped..." />
            </Field>
          </SubCard>
        ))}
      </Group>

      {/* PROJECTS */}
      <Group label="Projects" onAdd={() => onChange({ projects: [...value.projects, { name: '', description: '', link: null, bullets: [] }] })}>
        {value.projects.map((p, i) => (
          <SubCard key={i} onRemove={() => onChange({ projects: value.projects.filter((_, idx) => idx !== i) })}>
            <Row>
              <Field label="Name" style={half}><TextInput value={p.name} onChange={(v) => setProj(i, { name: v })} placeholder="Project" /></Field>
              <Field label="Link" style={half}><TextInput value={p.link ?? ''} onChange={(v) => setProj(i, { link: v || null })} placeholder="github.com/..." /></Field>
            </Row>
            <Field label="Description"><TextInput value={p.description} onChange={(v) => setProj(i, { description: v })} placeholder="What it is" /></Field>
            <Field label="Highlights (one per line)">
              <TextArea value={arrToLines(p.bullets)} onChange={(v) => setProj(i, { bullets: linesToArr(v) })} minHeight={72} />
            </Field>
          </SubCard>
        ))}
      </Group>

      {/* SKILLS */}
      <Group label="Skills" onAdd={() => onChange({ skills: [...value.skills, { category: '', items: [] }] })}>
        {value.skills.map((s, i) => (
          <SubCard key={i} onRemove={() => onChange({ skills: value.skills.filter((_, idx) => idx !== i) })}>
            <Field label="Category"><TextInput value={s.category} onChange={(v) => setSkill(i, { category: v })} placeholder="Languages" /></Field>
            <Field label="Skills (comma separated)">
              <TextArea value={s.items.join(', ')} onChange={(v) => setSkill(i, { items: csvToArr(v) })} minHeight={52} placeholder="TypeScript, Python, SQL" />
            </Field>
          </SubCard>
        ))}
      </Group>

      {/* ACHIEVEMENTS */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--alf-label)', marginBottom: 10 }}>Achievements (one per line)</div>
        <TextArea value={arrToLines(value.achievements)} onChange={(v) => onChange({ achievements: linesToArr(v) })} minHeight={64} placeholder="Awards, scholarships, honors…" />
      </div>
    </div>
  )
}

function Group({ label, onAdd, children }: { label: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--alf-label)' }}>{label}</div>
        <AddBtn onClick={onAdd}>+ Add</AddBtn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
}
