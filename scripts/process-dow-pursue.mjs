#!/usr/bin/env node

/**
 * process-dow-pursue.mjs
 *
 * Processes the U.S. Department of War PURSUE UAP declassification
 * (Presidential Unsealing and Reporting System for UAP Encounters,
 * war.gov/UFO) into per-year Sighting chunks + a manifest.
 *
 * Primary input is the record-level manifest of PURSUE Release 01 (public
 * domain — the underlying documents are U.S. federal government works):
 *   __sources/dow-pursue-records.json   — 161 records (PDF / video / image)
 *
 * Output:
 *   public/data/dow-pursue-YYYY.json     — per-year chunks
 *   public/data/dow-pursue-manifest.json
 *
 * One Sighting is emitted per source *document*. Multi-part series (a single
 * case split across many files, e.g. FBI 62-HQ-83894 → Section_1…10) are
 * collapsed into one record via seriesKey().
 *
 * Dates arrive as M/D/YY (2-digit year), e.g. "6/15/48" → 1948, "2/21/23" →
 * 2023. A pivot at the current 2-digit year disambiguates the century. When a
 * date is missing/"N/A", the year is recovered from the document title/id.
 *
 * Usage:
 *   node scripts/process-dow-pursue.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  Continent,
  Status,
  Shape,
  COUNTRY_CONTINENT,
  COUNTRY_ALIASES,
  truncate
} from './shared-constants.mjs'
import {
  resolveWithStats,
  normalizeLocationString,
  printStats
} from './geocoder.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'public/data')
const SOURCES_DIR = resolve(PROJECT_ROOT, '__sources')
const INPUT_FILE = resolve(SOURCES_DIR, 'dow-pursue-records.json')

const SOURCE_ID = 'DOW_PURSUE'
const RELEASE_URL = 'https://www.war.gov/ufo/'

const SUMMARY_MAX_LENGTH = 300
const DESCRIPTION_MAX_LENGTH = 1500

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_YY = CURRENT_YEAR % 100
const MIN_PLAUSIBLE_YEAR = 1400 // earliest sane year for a declassified aerial-phenomena record

const NA = /^n\/?a$/i

// ─── Series collapse (one case = one Sighting) ──────────────────────

/**
 * Strip the part/version suffix so a case split across many files collapses to
 * one document (FBI 62-HQ-83894 → section_1…10; trailing date-version tags).
 */
function seriesKey (id) {
  return String(id || '')
    .replace(/_(?:section|serial|part|sub)_\w+$/i, '')  // multi-part series (FBI 62-HQ-83894)
    .replace(/_(?:19|20)\d{6}$/, '')                    // trailing YYYYMMDD version tag
    .replace(/_\d{1,2}\.\d{1,2}\.\d{2,4}$/, '')         // trailing M.D.YYYY version tag
}

/** Prefer the part that carries the richest metadata as the representative. */
function pickRepresentative (parts) {
  const has = (r, f) => r[f] && !NA.test(String(r[f]).trim()) && String(r[f]).trim()
  return (
    parts.find(r => has(r, 'incident_location') && has(r, 'incident_date')) ||
    parts.find(r => has(r, 'incident_location')) ||
    parts.find(r => has(r, 'incident_date')) ||
    parts[0]
  )
}

function groupDocuments (records) {
  const groups = new Map()
  for (const r of records) {
    if (!r || !r.title) continue
    const key = seriesKey(r.title)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  return [...groups.entries()].map(([key, parts]) => ({ key, meta: pickRepresentative(parts) }))
}

// ─── Year recovery ──────────────────────────────────────────────────

const isPlausibleYear = (y) =>
  Number.isFinite(y) && y >= MIN_PLAUSIBLE_YEAR && y <= CURRENT_YEAR

/** First plausible 4-digit year embedded in a string (ignoring long ID numbers). */
function firstYearIn (str) {
  const matches = String(str || '').match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g)
  if (!matches) return null
  for (const m of matches) {
    const y = parseInt(m, 10)
    if (isPlausibleYear(y)) return y
  }
  return null
}

/**
 * Derive (year, occurredAt ISO, precision) for a document.
 * Priority: M/D/YY(YY) incident_date (day precision) → 4-digit year in the date
 * string → year mined from the title/id (year precision).
 */
function deriveDate (meta, key) {
  const raw = String(meta.incident_date || '').trim()

  // M/D/YY or M/D/YYYY — the common form.
  const md = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (md) {
    const mo = Math.min(12, Math.max(1, parseInt(md[1], 10)))
    const da = Math.min(31, Math.max(1, parseInt(md[2], 10)))
    let yr = parseInt(md[3], 10)
    if (yr < 100) yr = yr <= CURRENT_YY ? 2000 + yr : 1900 + yr // 2-digit century pivot
    if (isPlausibleYear(yr)) {
      const iso = `${String(yr).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}T00:00:00`
      return { year: yr, iso, precision: 'day' }
    }
  }

  // Any plausible 4-digit year in the date string, else in the title/id, else
  // in the description (archival docs state the era, e.g. "…between June 1947
  // and July 1968" → 1947).
  const yr = firstYearIn(raw) ??
    firstYearIn(`${meta.title || ''} ${key}`) ??
    firstYearIn(meta.description)
  if (yr) return { year: yr, iso: `${String(yr).padStart(4, '0')}-01-01T00:00:00`, precision: 'year' }

  return null
}

// ─── Location resolution ────────────────────────────────────────────

// Maritime / orbital / non-city locations that can't be geocoded to a point.
const NON_TERRESTRIAL = /\b(orbit|earth orbit|space|lunar|moon|sea|ocean|gulf|strait|time zone|atlantic|pacific|mediterranean|aegean|arabian|persian)\b/i

function resolveLocation (raw) {
  const fallback = {
    location: '',
    region: '',
    country: 'Unknown',
    continent: Continent.AMERICAS,
    coordinates: null
  }

  const locStr = typeof raw === 'string' ? raw.trim() : ''
  if (!locStr || NA.test(locStr)) return fallback

  // Non-terrestrial / maritime — keep the label, leave coordinates null.
  if (NON_TERRESTRIAL.test(locStr)) return { ...fallback, location: locStr }

  const norm = normalizeLocationString(locStr)

  let country = norm.country || ''
  if (country === 'United States' || country === 'US') country = 'USA'
  if (COUNTRY_ALIASES[country]) country = COUNTRY_ALIASES[country]
  if (!country) country = 'Unknown'

  let continent = COUNTRY_CONTINENT[country]
  if (!continent) {
    const tc = country.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    continent = COUNTRY_CONTINENT[tc]
    if (continent) country = tc
  }
  if (!continent) continent = Continent.AMERICAS

  const coordinates = resolveWithStats(norm.city || '', norm.state || '', country)

  let region = norm.city || ''
  if (norm.state) region = region ? `${region}, ${norm.state}` : norm.state

  return { location: locStr, region, country, continent, coordinates }
}

// ─── Description / summary ──────────────────────────────────────────

function buildText (meta) {
  const desc = typeof meta.description === 'string' && !NA.test(meta.description.trim())
    ? meta.description.replace(/\s+/g, ' ').trim()
    : ''
  const base = desc || String(meta.title || '')
  return {
    summary: truncate(base, SUMMARY_MAX_LENGTH),
    description: truncate(base, DESCRIPTION_MAX_LENGTH)
  }
}

// ─── Credibility (official government provenance baseline) ───────────

function computeCredibility (loc, precision) {
  let score = 70 // official, declassified federal record
  if (loc.coordinates) score += 10
  if (loc.country !== 'Unknown') score += 8
  if (precision === 'day') score += 7
  return Math.min(100, Math.max(60, score))
}

// ─── Main ───────────────────────────────────────────────────────────

function main () {
  if (!existsSync(INPUT_FILE)) {
    console.error(`  ✗ Missing input: ${INPUT_FILE}`)
    console.error('    Download records.json (vfp2/pursue-ufo-files, public domain) into __sources/dow-pursue-records.json.')
    process.exit(1)
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })

  // Clear stale chunks from previous runs so the manifest stays authoritative.
  for (const f of readdirSync(OUTPUT_DIR)) {
    if (/^dow-pursue-.*\.json$/.test(f)) unlinkSync(resolve(OUTPUT_DIR, f))
  }

  console.log('\n  ── Processing Department of War PURSUE release ──\n')

  const records = JSON.parse(readFileSync(INPUT_FILE, 'utf8'))
  const docs = groupDocuments(records)
  console.log(`  ${records.length} records → ${docs.length} documents (after series collapse)\n`)

  const byYear = new Map()
  const agencyMeta = {}
  const typeMeta = {}
  let processed = 0
  let skipped = 0

  for (const { key, meta } of docs) {
    const date = deriveDate(meta, key)
    if (!date) {
      skipped++
      console.warn(`  ⚠ skip (no plausible year): ${String(meta.title).slice(0, 52)}`)
      continue
    }

    const loc = resolveLocation(meta.incident_location)
    const { summary, description } = buildText(meta)
    const agency = typeof meta.agency === 'string' && meta.agency.trim() ? meta.agency.trim() : 'Unknown'
    const type = typeof meta.type === 'string' ? meta.type.trim() : ''
    const pdfLink = typeof meta.pdf_link === 'string' ? meta.pdf_link : ''

    const sighting = {
      id: `dow-${key.toLowerCase()}`,
      source: SOURCE_ID,
      occurredAt: date.iso,
      reportedAt: date.iso,
      postedAt: date.iso,
      location: loc.location,
      shape: Shape.UNKNOWN,
      duration: '',
      observers: 0,
      summary,
      description,
      characteristics: [],
      coordinates: loc.coordinates,
      region: loc.region,
      country: loc.country,
      continent: loc.continent,
      status: Status.PENDING,
      credibility: computeCredibility(loc, date.precision),
      ...(pdfLink && { ref: truncate(pdfLink, 500) })
    }

    const yearKey = String(date.year)
    if (!byYear.has(yearKey)) byYear.set(yearKey, [])
    byYear.get(yearKey).push(sighting)

    agencyMeta[agency] = (agencyMeta[agency] || 0) + 1
    if (type) typeMeta[type] = (typeMeta[type] || 0) + 1
    processed++
  }

  if (processed === 0) {
    console.error('  ✗ No records processed — aborting')
    process.exit(1)
  }

  // ── Write per-year chunks + manifest ──
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalRecords: processed,
    skippedRecords: skipped,
    release: 'PURSUE Release 01 (war.gov/UFO)',
    url: RELEASE_URL,
    agencies: agencyMeta,
    types: typeMeta,
    years: {}
  }

  const sortedKeys = [...byYear.keys()].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  for (const yearKey of sortedKeys) {
    const sightings = byYear.get(yearKey)
    sightings.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

    const filename = `dow-pursue-${yearKey}.json`
    const json = JSON.stringify(sightings)
    writeFileSync(resolve(OUTPUT_DIR, filename), json)

    manifest.years[yearKey] = {
      count: sightings.length,
      file: filename,
      sizeKB: Math.round(Buffer.byteLength(json) / 1024)
    }
  }

  writeFileSync(
    resolve(OUTPUT_DIR, 'dow-pursue-manifest.json'),
    JSON.stringify(manifest, null, 2)
  )

  // ── Summary ──
  console.log(`  ── Summary ──`)
  console.log(`  ${processed} records → ${sortedKeys.length} year chunks`)
  console.log(`  ${skipped} skipped (no plausible year)`)
  console.log(`  Years: ${sortedKeys[0]} → ${sortedKeys[sortedKeys.length - 1]}`)
  console.log(`  Agencies: ${Object.entries(agencyMeta).map(([a, n]) => `${a} (${n})`).join(', ')}`)
  console.log(`  Types: ${Object.entries(typeMeta).map(([t, n]) => `${t} (${n})`).join(', ')}`)
  printStats('DoW PURSUE Geocoder')
  console.log('')
}

main()
