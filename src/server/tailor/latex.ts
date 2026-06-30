/**
 * Deterministic LaTeX rendering for tailored documents.
 *
 * Resume uses Jake's Resume template (jakegut/resume, MIT) -- a clean,
 * single-column, ATS-safe layout (standard headings, real selectable text, no
 * tables/graphics/columns). Cover letter uses a minimal article. CONTENT comes
 * from the verified ResumeDocContent / CoverDocContent; this module only turns
 * structured data into LaTeX, so formatting stays controlled and one-page.
 *
 * `\pdfobjcompresslevel=0` is set so each page object is emitted uncompressed,
 * which lets render.ts count pages reliably from the PDF bytes (/Type /Page).
 */
import type { CoverDocContent, ResumeDocContent } from '../../types'

/* ----------------------------------------------------------- escaping */

const LATEX_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '#': '\\#',
  '$': '\\$',
  '%': '\\%',
  '&': '\\&',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
}

/** Normalize smart punctuation + dashes into ASCII (no em dashes by rule). */
function normalize(value: string): string {
  return value
    .replace(/ /g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—―]/g, '--')
    .replace(/–/g, '-')
    .replace(/…/g, '...')
}

export function escapeLatex(value: string | null | undefined): string {
  if (!value) return ''
  return normalize(value).replace(/[\\#$%&_{}~^]/g, (c) => LATEX_ESCAPES[c] ?? c)
}

/** Percent-protect a URL for an \href target (do not full-escape: keeps _ & ?). */
export function escapeLatexUrl(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
}

function ensureScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

/* ----------------------------------------------------------- resume */

function contactLine(content: ResumeDocContent): string {
  const parts = content.contactParts
    .filter((p) => p.label?.trim())
    .map((p) => {
      if (p.url?.trim()) {
        return `\\href{${escapeLatexUrl(ensureScheme(p.url))}}{\\underline{${escapeLatex(p.label)}}}`
      }
      return escapeLatex(p.label)
    })
  return parts.join(' $|$ ')
}

export function generateResumeLatex(content: ResumeDocContent): string {
  const name = escapeLatex(content.name || 'Your Name')
  const role = escapeLatex(content.role || '')
  const contact = contactLine(content)

  let body = ''

  // Education first (Jake's order; conventional for a current student).
  if (content.education.length) {
    body += `\\section{Education}\n  \\resumeSubHeadingListStart\n`
    for (const e of content.education) {
      if (!e.line?.trim()) continue
      body += `    \\resumeEducationLine{${escapeLatex(e.line)}}\n`
    }
    body += `  \\resumeSubHeadingListEnd\n\n`
  }

  // Experience.
  if (content.experience.length) {
    body += `\\section{Experience}\n  \\resumeSubHeadingListStart\n`
    for (const x of content.experience) {
      if (!x.title && !x.org) continue
      const heading = escapeLatex([x.org, x.location].filter(Boolean).join(', '))
      body += `    \\resumeSubheading{${escapeLatex(x.title)}}{${escapeLatex(x.dates)}}{${heading}}{}\n`
      const bullets = (x.bullets ?? []).filter((b) => b?.trim())
      if (bullets.length) {
        body += `    \\resumeItemListStart\n`
        for (const b of bullets) body += `      \\resumeItem{${escapeLatex(b)}}\n`
        body += `    \\resumeItemListEnd\n`
      }
    }
    body += `  \\resumeSubHeadingListEnd\n\n`
  }

  // Projects.
  if (content.projects.length) {
    body += `\\section{Projects}\n  \\resumeSubHeadingListStart\n`
    for (const p of content.projects) {
      if (!p.name) continue
      const desc = p.description?.trim() ? ` $|$ \\emph{${escapeLatex(p.description)}}` : ''
      const link = p.link?.trim()
        ? ` $|$ \\href{${escapeLatexUrl(ensureScheme(p.link))}}{\\underline{Link}}`
        : ''
      body += `    \\resumeProjectHeading{\\textbf{${escapeLatex(p.name)}}${desc}${link}}{}\n`
      const bullets = (p.bullets ?? []).filter((b) => b?.trim())
      if (bullets.length) {
        body += `    \\resumeItemListStart\n`
        for (const b of bullets) body += `      \\resumeItem{${escapeLatex(b)}}\n`
        body += `    \\resumeItemListEnd\n`
      }
    }
    body += `  \\resumeSubHeadingListEnd\n\n`
  }

  // Technical Skills.
  if (content.skills.length) {
    body += `\\section{Technical Skills}\n  \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n`
    for (const g of content.skills) {
      const items = (g.items ?? []).filter(Boolean).map((s) => escapeLatex(s))
      if (items.length) body += `      \\textbf{${escapeLatex(g.category || 'Skills')}}{: ${items.join(', ')}} \\\\\n`
    }
    body += `    }}\n  \\end{itemize}\n\n`
  }

  return `% Jake's Resume - https://github.com/jakegut/resume (MIT)
\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{tabularx}
\\input{glyphtounicode}

\\pdfobjcompresslevel=0

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\pdfgentounicode=1

\\newcommand{\\resumeItem}[1]{
  \\item\\small{#1 \\vspace{-2pt}}
}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
  \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
    \\textbf{#1} & #2 \\\\
    \\textit{\\small#3} & \\textit{\\small #4} \\\\
  \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeEducationLine}[1]{
  \\vspace{-2pt}\\item\\small{#1}\\vspace{-4pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
  \\item
  \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
    \\small#1 & #2 \\\\
  \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

\\begin{center}
  \\textbf{\\Huge \\scshape ${name}} \\\\ \\vspace{2pt}
  ${role ? `\\small ${role} \\\\ \\vspace{2pt}\n  ` : ''}\\small ${contact}
\\end{center}

${body}\\end{document}
`
}

/* ----------------------------------------------------------- cover */

export function generateCoverLatex(content: CoverDocContent): string {
  const paras = content.paragraphs
    .filter((p) => p?.trim())
    .map((p) => escapeLatex(p))
    .join('\n\n\\vspace{8pt}\n\n')

  return `\\documentclass[letterpaper,11pt]{article}
\\usepackage[empty]{fullpage}
\\usepackage[hidelinks]{hyperref}
\\input{glyphtounicode}
\\pdfobjcompresslevel=0
\\pdfgentounicode=1

\\addtolength{\\oddsidemargin}{-0.4in}
\\addtolength{\\evensidemargin}{-0.4in}
\\addtolength{\\textwidth}{0.8in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\setlength{\\parindent}{0pt}
\\linespread{1.08}
\\pagestyle{empty}

\\begin{document}

{\\small ${escapeLatex(content.date)}}

\\vspace{18pt}

${escapeLatex(content.salutation)}

\\vspace{10pt}

${paras}

\\vspace{16pt}

${escapeLatex(content.closing)}

\\vspace{4pt}

\\textbf{${escapeLatex(content.signature)}}

\\end{document}
`
}
