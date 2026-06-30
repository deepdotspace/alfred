/**
 * Compose the morning-brief digest email -- cool pastel, Alfred's butler voice,
 * one card per qualified role. Email-safe: table layout + inline styles, a
 * web-font attempt for clients that honor it (Apple Mail) with a clean system
 * fallback everywhere else. NO em dashes (house rule + a strip backstop on the
 * final strings).
 *
 * Each item maps to the DATA-MODEL "Digest email item" contract: company, title,
 * location, role_type/term, qualify badge, one honest reason, and a
 * "Tailor & apply" CTA that deep-links into the app.
 */
import type { DigestCadence, ProfileData } from '../../types'
import {
  avatarColors,
  companyInitial,
  fitDisplay,
  formatPay,
  greeting,
  primaryLocation,
  relativePosted,
  roleTypeLabel,
  todayLabel,
  workplaceLabel,
} from '../../components/brief/helpers'
import { APP_BASE_URL } from './constants'
import type { DigestItem } from './types'

/* --------------------------------------------------------------- text utils */

/** House rule backstop: no em dashes in user-visible copy. */
export function stripEmDashes(s: string): string {
  return s.replace(/\s*—\s*/g, ' -- ')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* ------------------------------------------------------------------ palette */

const INK = '#1E2440'
const BODY = '#37406B'
const MUTED = '#6B74A0'
const META = '#7E88B5'
const INDIGO = '#3D5AF1'
const BG = '#E7ECF9'
const SURFACE = '#ffffff'
const BORDER = '#E2E8F8'
const BORDER_SOFT = '#E6EAF6'
const STRONG_BG = '#D6F3EA'
const STRONG_FG = '#0E7C66'
const STRETCH_BG = '#DCEBFF'
const STRETCH_FG = '#2563B8'
const NOTE_BG = '#EEF1FE'
const NOTE_BORDER = '#DCE3F7'

const FONT = "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

/* ----------------------------------------------------------------- pieces */

function deepLink(jobId: string): string {
  return `${APP_BASE_URL}/brief?job=${encodeURIComponent(jobId)}`
}

/** Compact meta line: "Remote · Internship · Summer 2026 · $45/hr · 3d ago". */
function metaParts(item: DigestItem): string {
  const j = item.job
  const parts: string[] = []
  const wp = workplaceLabel(j.workplace)
  if (wp) parts.push(wp)
  const rt = roleTypeLabel(j.role_type)
  if (rt) parts.push(rt)
  if (j.term) parts.push(j.term)
  const pay = formatPay(j.pay)
  if (pay) parts.push(pay)
  const posted = relativePosted(j.posted_date)
  if (posted) parts.push(posted)
  return parts.join('  ·  ')
}

function itemHtml(item: DigestItem): string {
  const { job, match } = item
  const { bg, fg } = avatarColors(job.company)
  const fit = fitDisplay(match.qualify)
  const isStrong = fit.variant === 'strong'
  const pillBg = isStrong ? STRONG_BG : STRETCH_BG
  const pillFg = isStrong ? STRONG_FG : STRETCH_FG
  const loc = primaryLocation(job)
  const meta = metaParts(item)

  return `
  <tr>
    <td style="padding:0 0 14px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER_SOFT};border-radius:16px;background:${SURFACE};">
        <tr>
          <td style="padding:18px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="44" valign="top" style="padding-right:12px;">
                  <div style="width:40px;height:40px;border-radius:11px;background:${bg};color:${fg};font-family:${FONT};font-weight:700;font-size:16px;line-height:40px;text-align:center;">${escapeHtml(companyInitial(job.company))}</div>
                </td>
                <td valign="top">
                  <div style="font-family:${FONT};font-size:15px;font-weight:600;color:${INK};line-height:1.3;">${escapeHtml(job.title)}</div>
                  <div style="font-family:${FONT};font-size:13px;color:${MUTED};padding-top:2px;">${escapeHtml(job.company)}  ·  ${escapeHtml(loc)}</div>
                </td>
                <td valign="top" align="right" style="white-space:nowrap;padding-left:10px;">
                  <span style="display:inline-block;background:${pillBg};color:${pillFg};font-family:${FONT};font-size:12px;font-weight:700;padding:6px 11px;border-radius:99px;">${escapeHtml(fit.label)} · ${match.score}</span>
                </td>
              </tr>
            </table>

            ${meta ? `<div style="font-family:${MONO};font-size:12px;color:${META};padding-top:12px;">${escapeHtml(meta)}</div>` : ''}

            <div style="background:${NOTE_BG};border:1px solid ${NOTE_BORDER};border-radius:12px;padding:12px 14px;margin-top:12px;">
              <div style="font-family:${FONT};font-size:13.5px;line-height:1.5;color:${BODY};">${escapeHtml(match.reason)}</div>
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">
              <tr>
                <td style="border-radius:99px;background:${INDIGO};">
                  <a href="${deepLink(item.jobId)}" style="display:inline-block;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:99px;">Tailor &amp; apply &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

/* ------------------------------------------------------------------ shell */

export interface ComposedEmail {
  subject: string
  html: string
  text: string
}

export function digestSubject(count: number, cadence: DigestCadence): string {
  const noun = count === 1 ? 'role' : 'roles'
  const lead = cadence === 'weekly' ? 'Your weekly brief' : 'Your morning brief'
  return stripEmDashes(`${lead}: ${count} ${noun} worth your time`)
}

/** Build the full digest email for a user + their selected (verified) items. */
export function composeDigestEmail(
  profile: ProfileData,
  items: DigestItem[],
  opts: { now?: Date } = {},
): ComposedEmail {
  const now = opts.now ?? new Date()
  const cadence = profile.settings?.digest_cadence ?? 'daily'
  const firstName = (profile.basics?.name ?? '').trim().split(/\s+/)[0] || 'there'
  const hello = greeting(now)
  const eyebrow = `${cadence === 'weekly' ? 'YOUR WEEKLY BRIEF' : 'YOUR MORNING BRIEF'}  ·  ${todayLabel(now)}`
  const n = items.length
  const strong = items.filter((i) => i.match.qualify === 'yes').length

  const intro =
    n === 1
      ? `I read the overnight postings. Here is one role worth your time.`
      : `I read the overnight postings. Here are ${n} roles worth your time, strongest first.` +
        (strong > 0 ? ` ${strong} ${strong === 1 ? 'is a strong fit' : 'are strong fits'}.` : '')

  const subject = digestSubject(n, cadence)

  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(subject)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  body { margin:0; padding:0; background:${BG}; }
  a { color:${INDIGO}; }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${SURFACE};border:1px solid ${BORDER};border-radius:20px;overflow:hidden;">
          <!-- header -->
          <tr>
            <td style="padding:30px 30px 8px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48" valign="middle" style="padding-right:12px;">
                    <div style="width:44px;height:44px;border-radius:13px;background:#6E86FF;background:linear-gradient(135deg,#7E93FF,#4E9FE0);color:#ffffff;font-family:${FONT};font-weight:700;font-size:18px;line-height:44px;text-align:center;">A</div>
                  </td>
                  <td valign="middle">
                    <div style="font-family:${MONO};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${META};">${escapeHtml(eyebrow)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 30px 4px 30px;">
              <div style="font-family:${FONT};font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${INK};">${escapeHtml(hello)}, ${escapeHtml(firstName)}.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 30px 22px 30px;">
              <div style="font-family:${FONT};font-size:15px;line-height:1.55;color:${BODY};">${escapeHtml(intro)}</div>
            </td>
          </tr>
          <!-- items -->
          <tr>
            <td style="padding:0 22px 6px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${items.map(itemHtml).join('')}
              </table>
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td style="padding:10px 30px 30px 30px;border-top:1px solid ${BORDER};">
              <div style="font-family:${FONT};font-size:14px;color:${BODY};padding-top:16px;">I will keep reading through the day. You make the final call, I just prepare.</div>
              <div style="font-family:${FONT};font-size:14px;font-weight:600;color:${INK};padding-top:4px;">Warmly, Alfred</div>
              <div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};padding-top:16px;">
                You are getting this because your ${cadence} brief is on.
                <a href="${APP_BASE_URL}/profile" style="color:${INDIGO};text-decoration:none;">Change cadence in your profile</a>.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  // Plain-text alternative (deliverability).
  const textLines: string[] = [
    `${hello}, ${firstName}.`,
    intro,
    '',
  ]
  for (const it of items) {
    const fit = fitDisplay(it.match.qualify)
    textLines.push(`* ${it.job.title} -- ${it.job.company} (${primaryLocation(it.job)})`)
    const meta = metaParts(it).replace(/·/g, '-')
    if (meta) textLines.push(`  ${meta}`)
    textLines.push(`  ${fit.label} ${it.match.score}: ${it.match.reason}`)
    textLines.push(`  Tailor & apply: ${deepLink(it.jobId)}`)
    textLines.push('')
  }
  textLines.push('I will keep reading through the day. Warmly, Alfred')
  textLines.push(`Change cadence: ${APP_BASE_URL}/profile`)

  return {
    subject,
    html: stripEmDashes(body),
    text: stripEmDashes(textLines.join('\n')),
  }
}
