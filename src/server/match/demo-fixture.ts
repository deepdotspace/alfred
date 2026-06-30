/**
 * A complete demo profile as a ProfileData row. Used ONLY by the dev-gated
 * `dev-seed-profile` action so the matcher can be proven against the live pool.
 * Not part of the product surface.
 *
 * "Maya Chen" is a fictional early-career CS/HCI candidate. Targeting reflects a
 * Fall internship/co-op + new-grad full-time search across full-stack, backend,
 * and frontend SWE; open to relocate; not seeking ML-research, firmware, or
 * hardware. Work authorization is `unsure` so sponsorship does NOT hard-exclude.
 */
import type { ProfileData } from '../../types'

export function buildDemoProfile(userId: string): ProfileData {
  const now = new Date().toISOString()
  return {
    user_id: userId,
    basics: {
      name: 'Maya Chen',
      email: 'maya.chen@example.com',
      phone: '(415) 555-0142',
      location: 'Seattle, WA',
      links: {
        github: 'github.com/maya-chen-dev',
        linkedin: 'linkedin.com/in/maya-chen-hci',
        portfolio: 'mayachen.design',
        other: [],
      },
    },
    education: [
      {
        school: 'University of Washington',
        degree: 'B.S.',
        field: 'Computer Science (Human-Computer Interaction)',
        start: '2023',
        end: 'June 2026',
        gpa: '3.81',
        details: ['Seattle, WA'],
      },
    ],
    work: [
      {
        title: 'Software Engineering Intern',
        company: 'Northwind Labs',
        location: 'Seattle, WA',
        start: 'Jun 2025',
        end: 'Aug 2025',
        bullets: [
          'Shipped 10+ full-stack features end to end on a B2B analytics product using TypeScript, React, Next.js, Node.js, and PostgreSQL.',
          'Built a reusable component library and design tokens adopted across three product surfaces, cutting new-page build time roughly in half.',
          'Added keyboard navigation and screen-reader support to the core dashboard, bringing it to WCAG AA and closing 20+ accessibility issues.',
          'Wrote Playwright end-to-end coverage for the billing flow that caught two regressions before release.',
        ],
      },
      {
        title: 'Undergraduate Research Assistant',
        company: 'UW Interaction Lab',
        location: 'Seattle, WA',
        start: 'Jan 2025',
        end: 'May 2025',
        bullets: [
          'Prototyped and ran usability studies for a collaborative annotation tool with 30+ participants, turning findings into a prioritized fix list.',
          'Built study instrumentation and a small React dashboard to visualize interaction logs for the research team.',
        ],
      },
      {
        title: 'Teaching Assistant, Intro to Web Programming',
        company: 'University of Washington',
        location: 'Seattle, WA',
        start: 'Sep 2024',
        end: 'Dec 2024',
        bullets: [
          'Led weekly lab sections for 40 students on HTML, CSS, JavaScript, and the fundamentals of accessible UI.',
          'Held office hours and graded projects, with a focus on clear, kind written feedback.',
        ],
      },
    ],
    projects: [
      {
        name: 'Lumen',
        description: 'A collaborative reading app with real-time shared highlights and notes; built with React, Yjs, and a Cloudflare Workers backend.',
        link: null,
        bullets: [],
      },
      {
        name: 'Civic Signals',
        description: 'An open-data dashboard visualizing city transit reliability; D3.js charts over a small Python ingest pipeline.',
        link: null,
        bullets: [],
      },
      {
        name: 'Palette',
        description: 'A browser extension that audits a page for color-contrast accessibility issues and suggests compliant alternatives.',
        link: null,
        bullets: [],
      },
    ],
    skills: [
      { category: 'Languages', items: ['TypeScript', 'JavaScript', 'Python', 'Java', 'SQL'] },
      { category: 'Frontend', items: ['React', 'Next.js', 'Tailwind CSS', 'Figma', 'Design systems', 'Accessibility (WCAG)'] },
      { category: 'Backend and Data', items: ['Node.js', 'Express.js', 'REST APIs', 'PostgreSQL', 'SQLite'] },
      { category: 'Testing and Tools', items: ['Playwright', 'Vitest', 'Git', 'GitHub Actions', 'Usability testing'] },
    ],
    achievements: [
      'HackUW 2025 (Best Use of Accessibility): a real-time captioning overlay for lecture recordings.',
      'UW Computer Science Department Scholarship (2024): awarded for academic standing and community contribution.',
    ],
    targeting: {
      role_families: ['fullstack', 'frontend', 'backend', 'swe-general'],
      intent: ['internship', 'co-op', 'new-grad-ft'],
      locations: [],
      work_modes: [],
      open_to_relocate: true,
      work_authorization: 'unsure',
      pay_floor: null,
      company_prefs: null,
      requirements_freetext:
        'I do my best work on small, high-trust teams that ship. I care more about craft and clear thinking than prestige.',
      dealbreakers_freetext: 'Not seeking ML-research, firmware, or hardware roles.',
    },
    voice: {
      resume_keys: [],
      cover_letter_keys: [],
      writing_sample: '',
      stories_freetext: '',
    },
    settings: {
      digest_cadence: 'daily',
      email_enabled: true,
      notifications_enabled: true,
    },
    created_at: now,
    updated_at: now,
  }
}
