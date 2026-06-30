/**
 * Dependency-free .docx generation.
 *
 * A .docx is a ZIP of Office Open XML parts. We build the minimal valid set
 * (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`) with a tiny
 * store-only (no compression) ZIP writer + CRC32, so the result is a real,
 * selectable-text, single-column .docx that Word and ATS parse -- no native
 * dependency, runs in the Worker. Content comes from the same verified
 * structured content as the PDF, so the two stay in sync.
 */
import type { CoverDocContent, ResumeDocContent } from '../../types'

/* ----------------------------------------------------------- zip + crc32 */

let CRC_TABLE: Uint32Array | null = null
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  CRC_TABLE = t
  return t
}
function crc32(buf: Uint8Array): number {
  const t = crcTable()
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

function u16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff]
}
function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
}

/** Build a store-only ZIP from entries; returns the bytes. */
function zip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder()
  const chunks: number[][] = []
  const central: number[][] = []
  let offset = 0

  for (const e of entries) {
    const nameBytes = Array.from(enc.encode(e.name))
    const crc = crc32(e.data)
    const size = e.data.length

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length), ...u16(0),
      ...nameBytes,
    ]
    chunks.push(local)
    chunks.push(Array.from(e.data))

    central.push([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length),
      ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
      ...nameBytes,
    ])

    offset += local.length + size
  }

  const centralStart = offset
  let centralSize = 0
  for (const c of central) centralSize += c.length

  const eocd = [
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(centralStart), ...u16(0),
  ]

  const total = offset + centralSize + eocd.length
  const out = new Uint8Array(total)
  let p = 0
  for (const c of chunks) { out.set(c, p); p += c.length }
  for (const c of central) { out.set(c, p); p += c.length }
  out.set(eocd, p)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

/* ----------------------------------------------------------- ooxml */

function xmlEscape(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[—―]/g, '--')
}

/** A paragraph run with optional bold + size (half-points). */
function para(text: string, opts: { bold?: boolean; sz?: number; caps?: boolean; spaceAfter?: number } = {}): string {
  const sz = opts.sz ?? 20
  const rpr = [opts.bold ? '<w:b/>' : '', opts.caps ? '<w:caps/>' : '', `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`].join('')
  const ppr = `<w:pPr><w:spacing w:after="${opts.spaceAfter ?? 60}"/></w:pPr>`
  return `<w:p>${ppr}<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`
}

function heading(text: string): string {
  return para(text, { bold: true, sz: 24, caps: true, spaceAfter: 80 })
}
function bullet(text: string): string {
  return para(`•  ${text}`, { sz: 20, spaceAfter: 40 })
}

function documentXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body>
</w:document>`
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

function pack(documentBody: string): string {
  const enc = new TextEncoder()
  const bytes = zip([
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc.encode(RELS) },
    { name: 'word/document.xml', data: enc.encode(documentXml(documentBody)) },
  ])
  return bytesToBase64(bytes)
}

/* ----------------------------------------------------------- builders */

/** Build a single-column ATS-safe resume .docx; returns base64. */
export function buildResumeDocx(content: ResumeDocContent): string {
  const parts: string[] = []
  parts.push(para(content.name, { bold: true, sz: 36, spaceAfter: 40 }))
  if (content.role) parts.push(para(content.role, { sz: 22, spaceAfter: 20 }))
  parts.push(para(content.contact, { sz: 18, spaceAfter: 160 }))

  if (content.education.length) {
    parts.push(heading('Education'))
    for (const e of content.education) parts.push(para(e.line, { sz: 20, spaceAfter: 120 }))
  }

  if (content.summary) {
    parts.push(heading('Summary'))
    parts.push(para(content.summary, { sz: 20, spaceAfter: 120 }))
  }

  if (content.experience.length) {
    parts.push(heading('Experience'))
    for (const x of content.experience) {
      const head = [x.title, x.org].filter(Boolean).join(' - ')
      parts.push(para(`${head}${x.dates ? `   (${x.dates})` : ''}`, { bold: true, sz: 20, spaceAfter: 40 }))
      for (const b of x.bullets) parts.push(bullet(b))
    }
  }

  if (content.projects.length) {
    parts.push(heading('Projects'))
    for (const p of content.projects) {
      const head = [p.name, p.description].filter(Boolean).join(' - ')
      parts.push(para(head, { bold: true, sz: 20, spaceAfter: 40 }))
      for (const b of p.bullets) parts.push(bullet(b))
    }
  }

  if (content.skills.length) {
    parts.push(heading('Technical Skills'))
    for (const g of content.skills) {
      parts.push(para(`${g.category}: ${g.items.join(', ')}`, { sz: 20, spaceAfter: 60 }))
    }
  }

  return pack(parts.join(''))
}

/** Build a cover-letter .docx; returns base64. */
export function buildCoverDocx(content: CoverDocContent): string {
  const parts: string[] = []
  parts.push(para(content.date, { sz: 20, spaceAfter: 200 }))
  parts.push(para(content.salutation, { sz: 22, spaceAfter: 160 }))
  for (const p of content.paragraphs) parts.push(para(p, { sz: 22, spaceAfter: 160 }))
  parts.push(para(content.closing, { sz: 22, spaceAfter: 40 }))
  parts.push(para(content.signature, { bold: true, sz: 22, spaceAfter: 40 }))
  return pack(parts.join(''))
}
