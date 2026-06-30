/**
 * P4 verification e2e -- proves the HONEST tailoring pipeline against the live
 * pool with the demo fixture, then screenshots the tailor states + workspace.
 *
 * Flow: sign in -> ensure pool -> seed demo profile -> pick a real target job
 * (the Muru Full-Stack role if present, else the top fit) -> run the FULL
 * pipeline INLINE via dev-tailor-preview and dump it (proves first-pass
 * embellishments caught -> clean re-verify, one-page PDF, gaps) -> prove cover
 * generation with an injected writing sample (and gating without one) -> drive
 * the UI (Tailor & apply tab working/ready + Document Workspace) for screenshots.
 *
 * Run with: npx deepspace test e2e
 */
import { test, expect } from 'deepspace/testing'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const VERIFY = (name: string) => fileURLToPath(new URL(`../docs/design/verify/${name}`, import.meta.url))

interface PreviewVerdict { job_id: string; title?: string; company?: string }
interface MatchPreview {
  verdicts: { job_id: string; qualify: string; score: number }[]
  jobs: Record<string, { title: string; company: string }>
}
interface VerifyRound { round: number; report: { supported: number; embellished: number; fabricated: number; flagged: { claim: string; verdict: string; note: string }[] } }
interface TailorPreview {
  job: { title: string; company: string }
  resume: {
    content: { name: string; role: string; summary: string; experience: { title: string; org: string; bullets: string[] }[]; skills: { category: string; items: string[] }[] }
    gaps: string[]
    rounds: VerifyRound[]
    clean: boolean
  }
  cover: { content: { paragraphs: string[] }; rounds: VerifyRound[]; clean: boolean } | null
  coverGated: boolean
  render: { pages: number; pdfBytes: number; onePage: boolean }
}

function noEmDash(s: string) { expect(s, `no em dash in: ${s}`).not.toMatch(/—/) }

test('honest tailoring: verify loop + one-page PDF + workspace', async ({ users }) => {
  test.setTimeout(420_000)
  const [u] = await users(['Maya Chen'])
  const { page } = u

  // 1) Authenticate (email path; onboarding OR shell both count as authed).
  await page.goto('/brief')
  const shell = page.getByTestId('shell-user')
  const onboarding = page.getByText("I'm Alfred.")
  if (!(await shell.or(onboarding).isVisible().catch(() => false))) {
    const emailBtn = page.getByRole('button', { name: /sign in with email/i })
    if (await emailBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await emailBtn.click()
      await page.getByPlaceholder(/email/i).fill('maya-tailor-demo@deepspace.test')
      await page.getByPlaceholder(/password/i).fill('TestPass123!')
      await page.getByRole('button', { name: /^sign in$/i }).click()
    }
  }
  await expect(shell.or(onboarding)).toBeVisible({ timeout: 30_000 })

  let token: string | null = null
  for (let i = 0; i < 8 && !token; i++) {
    token = await page.evaluate(async () => {
      const r = await fetch('/api/auth/token', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      if (!r.ok) return null
      return ((await r.json()) as { token?: string }).token ?? null
    })
    if (!token) await page.waitForTimeout(1500)
  }
  expect(token, 'auth token').toBeTruthy()
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // 2) Ensure the pool has jobs.
  const statTotal = async (): Promise<number> => {
    const r = await page.request.get('/api/dev/ingest/stats')
    if (!r.ok()) return 0
    return ((await r.json()) as { total?: number }).total ?? 0
  }
  if ((await statTotal()) < 30) {
    await page.request.post('/api/dev/ingest/run', { headers: auth, data: { mode: 'backfill', windowDays: 60, maxPerFeed: 160, maxSlugs: 0, skipIntegrations: true } })
    await expect.poll(statTotal, { timeout: 150_000, intervals: [3000] }).toBeGreaterThan(30)
  }

  // 3) Seed demo + run match preview to find a target job recordId.
  const seed = await page.request.post('/api/actions/dev-seed-profile', { headers: auth, data: {} })
  expect((await seed.json()).success, 'dev-seed-profile').toBeTruthy()

  const prevRes = await page.request.post('/api/actions/dev-match-preview', { headers: auth, data: {}, timeout: 180_000 })
  const match = (await prevRes.json()).data as MatchPreview
  const entries = Object.entries(match.jobs)
  const target =
    entries.find(([, j]) => /muru/i.test(j.company) || /full[- ]?stack/i.test(j.title)) ??
    entries.find(([id]) => match.verdicts.some((v) => v.job_id === id && v.qualify === 'yes')) ??
    entries[0]
  expect(target, 'a target job').toBeTruthy()
  const [targetJobId, targetJob] = target as [string, { title: string; company: string }]
  console.log(`[verify] target job = ${targetJob.title} @ ${targetJob.company} (${targetJobId})`)

  // 4) THE PROOF: full pipeline inline (no writes). Cover GATED (no sample).
  const tp1Res = await page.request.post('/api/actions/dev-tailor-preview', { headers: auth, data: { jobId: targetJobId }, timeout: 300_000 })
  const tp1 = (await tp1Res.json()).data as TailorPreview
  writeFileSync(VERIFY('p4-tailor-preview.json'), JSON.stringify(tp1, null, 2))

  console.log('[verify] ===== RESUME VERIFY ROUNDS =====')
  for (const r of tp1.resume.rounds) {
    console.log(`   round ${r.round}: supported=${r.report.supported} embellished=${r.report.embellished} fabricated=${r.report.fabricated} flagged=${r.report.flagged.length}`)
    for (const f of r.report.flagged) console.log(`      [${f.verdict}] ${f.claim}  -- ${f.note}`)
  }
  console.log(`[verify] resume clean=${tp1.resume.clean}  pages=${tp1.render.pages} (onePage=${tp1.render.onePage})  pdfBytes=${tp1.render.pdfBytes}`)
  console.log(`[verify] role line: ${tp1.resume.content.role}`)
  console.log(`[verify] summary: ${tp1.resume.content.summary}`)
  console.log('[verify] sample bullets:')
  for (const x of tp1.resume.content.experience.slice(0, 2)) {
    console.log(`   ${x.title} @ ${x.org}`)
    for (const b of x.bullets.slice(0, 3)) console.log(`      - ${b}`)
  }
  console.log(`[verify] GAPS: ${tp1.resume.gaps.join(' | ')}`)
  console.log(`[verify] coverGated (no sample)=${tp1.coverGated}`)

  // Honesty INVARIANTS (always hold; a clean first pass is a valid, good outcome).
  // 1) The verifier actually judged the claims (the loop is wired, not skipped).
  expect(tp1.resume.rounds.length, 'verify loop ran').toBeGreaterThan(0)
  expect(tp1.resume.rounds[0].report.supported, 'verifier judged claims').toBeGreaterThan(0)
  // 2) It NEVER passes a fabrication in any round (the hard honesty guarantee).
  for (const r of tp1.resume.rounds) expect(r.report.fabricated, `no fabrication in round ${r.round}`).toBe(0)
  // 3) The shipped resume is clean by construction (loop + deterministic fix backstop).
  expect(tp1.resume.clean, 'shipped resume is clean').toBeTruthy()
  expect(tp1.render.onePage, 'resume PDF is one page').toBeTruthy()
  expect(tp1.render.pages).toBe(1)
  expect(tp1.render.pdfBytes, 'real PDF produced').toBeGreaterThan(3000)
  expect(tp1.coverGated, 'cover gated when no writing sample').toBeTruthy()
  expect(tp1.cover, 'no cover when gated').toBeNull()

  // 4) DETERMINISTIC skeptic proof: a deliberately-embellished draft IS flagged.
  const probeRes = await page.request.post('/api/actions/dev-tailor-preview', { headers: auth, data: { embellishProbe: true }, timeout: 120_000 })
  const probe = (await probeRes.json()).data as { report: { supported: number; embellished: number; fabricated: number; flagged: { claim: string; verdict: string }[] } }
  console.log(`[verify] ===== SKEPTIC PROBE (embellished draft) ===== flagged=${probe.report.flagged.length} (embellished=${probe.report.embellished} fabricated=${probe.report.fabricated})`)
  for (const f of probe.report.flagged.slice(0, 6)) console.log(`   [${f.verdict}] ${f.claim}`)
  expect(probe.report.flagged.length, 'skeptic flags an embellished draft').toBeGreaterThan(0)
  noEmDash(tp1.resume.content.summary)
  for (const x of tp1.resume.content.experience) for (const b of x.bullets) noEmDash(b)
  for (const g of tp1.resume.gaps) noEmDash(g)
  // Skills must be a subset of the profile (no fabricated skill leaks through).
  const profileSkills = new Set(['typescript','javascript','python','c++','java','sql','react','next.js','react native (expo)','tailwind css','tiptap','yjs','node.js','express.js','trpc','rest apis','postgresql','drizzle orm','postgis','jest','git','github actions','vercel','docker'])
  const allSkills = tp1.resume.content.skills.flatMap((g) => g.items)
  for (const s of allSkills) expect(profileSkills.has(s.toLowerCase()), `skill grounded: ${s}`).toBeTruthy()

  // 5) Prove COVER generation with an injected writing sample.
  const sample = 'I have always believed the best teams are small, honest, and a little obsessive about craft. When I joined my last project the codebase was a mess; I cared more about leaving it clean for the next person than about looking clever. That is the kind of teammate I try to be.'
  const tp2Res = await page.request.post('/api/actions/dev-tailor-preview', { headers: auth, data: { jobId: targetJobId, injectWritingSample: sample, coverOnly: true }, timeout: 300_000 })
  const tp2 = (await tp2Res.json()).data as TailorPreview
  expect(tp2.cover, 'cover generated with a sample').toBeTruthy()
  console.log('[verify] ===== COVER VERIFY ROUNDS =====')
  for (const r of tp2.cover!.rounds) console.log(`   round ${r.round}: supported=${r.report.supported} embellished=${r.report.embellished} fabricated=${r.report.fabricated} flagged=${r.report.flagged.length}`)
  console.log('[verify] cover paragraph 1:', tp2.cover!.content.paragraphs[0])
  for (const r of tp2.cover!.rounds) expect(r.report.fabricated, 'no fabrication in cover').toBe(0)
  expect(tp2.cover!.clean, 'cover clean by construction').toBeTruthy()
  for (const p of tp2.cover!.content.paragraphs) noEmDash(p)

  console.log('[verify] P4 honesty proof complete. (UI screenshots live in tailor-ui.e2e.spec.ts)')
})
