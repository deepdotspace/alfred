/**
 * The landing sample brief -- a committed fixture of REAL, sanitized pool jobs
 * paired with a pre-written honest fit read for the demo persona "Maya".
 *
 * Why a fixture (not a live anon call): the landing is public, so it is only
 * ever seen by signed-out visitors (signed-in users redirect to /brief). The
 * SDK gates /api/actions/:name with a hard 401 when there is no JWT, and the
 * job pool is not exposed over an anonymous socket. So the public sample is
 * served from this fixture: instant, zero-cost, no personal data, always
 * renders. The `sample-brief` server action returns the same shape from the
 * LIVE pool when called with a token (tests / owner) -- this fixture is its
 * fallback and the source these rows were captured from (real Ashby/Lever
 * postings, late June 2026). Honestly labeled as a sample for a demo profile.
 *
 * No em dashes in any user-visible string here (house rule).
 */

export type SampleQualify = 'yes' | 'stretch'

export interface SampleJob {
  /** Stable key for lists. */
  id: string
  company: string
  title: string
  /** Pre-formatted, e.g. "New York, NY" or "Remote". */
  location: string
  workplace: 'remote' | 'hybrid' | 'onsite'
  roleType: 'internship' | 'new-grad-ft'
  term: string | null
  /** Pre-formatted pay, e.g. "$30/hr" or "$115-125k", or null when not stated. */
  pay: string | null
  /** ISO posting date; rendered as a relative age at display time. */
  postedDate: string
  /** ATS the canonical link sits on, for the subtle "via {ATS}" attribution. */
  ats: string
  /** A few sanitized role bullets for the detail view. */
  jd: string[]
}

export interface SampleRead {
  qualify: SampleQualify
  /** 0-100, always shown backed by a label + reason. */
  score: number
  reason: string
  matched: string[]
  missing: string[]
}

export interface SampleEntry {
  job: SampleJob
  read: SampleRead
}

export interface SampleBriefData {
  /** Where the rows came from: the live pool, or this committed fixture. */
  source: 'pool' | 'fixture'
  persona: { name: string; eyebrow: string }
  stats: { read: number; worth: number; strong: number }
  entries: SampleEntry[]
  /** Honest one-liner shown under the brief. */
  note: string
}

const PERSONA = { name: 'Maya', eyebrow: 'HCI · 2026' }

const NOTE =
  'A sample brief for a demo profile. Yours is built from your own resume.'

/**
 * The fixture entries. Six real early-career roles captured from the live pool,
 * each with an honest, grounded read for Maya (HCI 2026: Figma, React, design
 * systems, SQL basics, two internships, drawn to the design and engineering
 * seam). The reads mix strong fits and honest stretches, gaps shown openly.
 */
export const SAMPLE_ENTRIES: SampleEntry[] = [
  {
    job: {
      id: 'astronomer-pm',
      company: 'Astronomer',
      title: 'Product Management Intern',
      location: 'New York, NY',
      workplace: 'onsite',
      roleType: 'internship',
      term: 'Summer 2026',
      pay: null,
      postedDate: '2026-06-18',
      ats: 'ashby',
      jd: [
        'Sit directly on the Product team for a paid Summer 2026 internship in NYC.',
        'Build AI-powered workflows and high-leverage internal tools.',
        'Take full ownership and ship real code, not just specs.',
        'Help turn big ideas into revenue-driving systems.',
      ],
    },
    read: {
      qualify: 'yes',
      score: 84,
      reason:
        'Your HCI background and two product internships line up with a PM role that sits right on the design and engineering seam.',
      matched: [
        'Two prior internships shipping real product, not just coursework',
        'HCI degree gives you the user-research and design vocabulary PM work runs on',
        'You read and write enough React to talk credibly with engineers',
      ],
      missing: [
        'No data-platform or Airflow exposure, which this team lives in',
        'They want someone who ships real code; your engineering is lighter than a SWE intern’s',
      ],
    },
  },
  {
    job: {
      id: 'centerfield-pm',
      company: 'Centerfield',
      title: 'Product Manager Intern',
      location: 'Los Angeles, CA',
      workplace: 'remote',
      roleType: 'internship',
      term: null,
      pay: '$30/hr',
      postedDate: '2026-06-11',
      ats: 'ashby',
      jd: [
        'Support building optimized experiences across the digital sales funnel.',
        'Work on data products for insurance and B2B brands on the Dugout platform.',
        'Collaborate with a data-driven product team.',
        'Remote internship paid at $30 per hour.',
      ],
    },
    read: {
      qualify: 'yes',
      score: 80,
      reason:
        'A remote, paid PM internship focused on optimizing user-facing funnels, which is squarely your design-meets-data strength.',
      matched: [
        'Design-systems work translates directly to funnel and experience optimization',
        'Your SQL basics cover the data-driven analysis they ask for',
        'Remote and paid, which fits your logistics',
      ],
      missing: [
        'No formal A/B testing or experimentation experience yet',
        'The marketing-analytics domain will be new to you',
      ],
    },
  },
  {
    job: {
      id: 'hadrian-fullstack',
      company: 'Hadrian',
      title: 'Fullstack Software Engineer, New Grad',
      location: 'Los Angeles, CA',
      workplace: 'onsite',
      roleType: 'new-grad-ft',
      term: null,
      pay: null,
      postedDate: '2026-06-19',
      ats: 'ashby',
      jd: [
        'Build full-stack software for autonomous aerospace and defense factories.',
        'Work across the stack on tools that run real manufacturing.',
        'Join a fast-growing new-grad engineering team in LA.',
        'Backed by Founders Fund, Lux Capital, and Andreessen Horowitz.',
      ],
    },
    read: {
      qualify: 'stretch',
      score: 71,
      reason:
        'Your React is strong enough for the front half, but a full-stack manufacturing role will lean on backend depth you are still building.',
      matched: [
        'Solid React and front-end fundamentals from your internships',
        'You ship features end to end, not just mockups',
        'New-grad timing matches your 2026 graduation',
      ],
      missing: [
        'Limited backend and systems experience for the "full" in full-stack',
        'No exposure to robotics or manufacturing software',
        'Onsite in LA, worth confirming against your plans',
      ],
    },
  },
  {
    job: {
      id: 'collective-swe',
      company: 'Collective',
      title: 'Software Engineer, New Grad',
      location: 'San Francisco, CA',
      workplace: 'remote',
      roleType: 'new-grad-ft',
      term: null,
      pay: '$115-125k',
      postedDate: '2026-06-17',
      ats: 'ashby',
      jd: [
        'Build product for a platform serving businesses-of-one.',
        'Work on accounting, bookkeeping, and tax tooling.',
        'Remote new-grad role on an integrated platform.',
        'Backed by General Catalyst and Gradient Ventures.',
      ],
    },
    read: {
      qualify: 'stretch',
      score: 67,
      reason:
        'A remote new-grad SWE role you could grow into, though it asks for broader backend work than your design-leaning resume shows.',
      matched: [
        'Front-end and React skills map to their product UI work',
        'Remote, and the pay band is healthy for a new grad',
        'You have shipped in a real codebase before',
      ],
      missing: [
        'Accounting and fintech domain is unfamiliar',
        'Backend and data-modeling depth is light',
        'They want general SWE breadth more than design specialization',
      ],
    },
  },
  {
    job: {
      id: 'pebl-swe',
      company: 'Pebl',
      title: 'Software Engineer Intern, Conversational AI',
      location: 'Palo Alto, CA',
      workplace: 'remote',
      roleType: 'internship',
      term: 'Summer 2026',
      pay: '$28-40/hr',
      postedDate: '2026-06-16',
      ats: 'ashby',
      jd: [
        'Build on Alfie, Pebl’s in-house conversational AI.',
        'Work on a global work platform spanning 185+ countries.',
        'Paid, remote Summer 2026 software internship.',
        'Contribute to product surfaces that move the needle.',
      ],
    },
    read: {
      qualify: 'stretch',
      score: 63,
      reason:
        'A paid, remote SWE internship where your front-end skills fit, but the conversational-AI core sits outside what you have built so far.',
      matched: [
        'React and front-end work apply to the product surface',
        'Paid and remote, which suits you',
        'Internship timing works for Summer 2026',
      ],
      missing: [
        'No conversational-AI or LLM engineering experience',
        'Backend integration work will stretch you',
        'The global-payroll domain is new',
      ],
    },
  },
  {
    job: {
      id: 'rivianvw-android',
      company: 'Rivian and Volkswagen Group Technologies',
      title: 'Android Developer Intern',
      location: 'Palo Alto, CA',
      workplace: 'onsite',
      roleType: 'internship',
      term: 'Fall 2026',
      pay: '$45-51/hr',
      postedDate: '2026-06-11',
      ats: 'ashby',
      jd: [
        'Develop native Android applications for software-defined vehicles.',
        'Work across connectivity, AI, and in-vehicle systems.',
        'Onsite Fall 2026 internship in Palo Alto.',
        'A joint venture between Rivian and Volkswagen Group.',
      ],
    },
    read: {
      qualify: 'stretch',
      score: 58,
      reason:
        'Strong pay and a real product, but this is native Android work and your mobile experience is on the web, not Kotlin.',
      matched: [
        'Interface and interaction sense from your HCI and design-systems work',
        'Two internships show you can ship on a real team',
        'Pay is excellent for an internship',
      ],
      missing: [
        'No native Android or Kotlin experience',
        'Your mobile work has been web, not platform-native',
        'Onsite in Palo Alto for Fall 2026',
      ],
    },
  },
]

/** The full committed fixture payload (the landing's source of truth). */
export const SAMPLE_BRIEF_FIXTURE: SampleBriefData = {
  source: 'fixture',
  persona: PERSONA,
  // `read` is the real live pool size at capture; worth/strong describe the set.
  stats: { read: 1438, worth: SAMPLE_ENTRIES.length, strong: 2 },
  entries: SAMPLE_ENTRIES,
  note: NOTE,
}
