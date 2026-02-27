#!/usr/bin/env node

/**
 * process-chronology.mjs
 *
 * Processes researcher chronology JSONs from richgel999/ufo_data into
 * a single combined manifest with per-year chunks.
 *
 * Option B architecture: one manifest, one set of chunk files.
 *   chronology-manifest.json — combined manifest with subSources metadata
 *   chronology-YYYY.json     — per-year chunks (all sources interleaved)
 *   chronology-1890s.json    — decade chunks for 1800–1899
 *   chronology-ancient.json  — everything before 1800
 *
 * Each sighting record carries:
 *   source: 'CHRONOLOGY'   — for the DataSourceId enum
 *   subSource: 'EBERHART'  — identifies the researcher/database
 *
 * Usage:
 *   node scripts/process-chronology.mjs [--download]
 *
 * Output:
 *   public/data/chronology-*.json
 *   public/data/chronology-manifest.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

import {
  Continent,
  Status,
  Shape,
  COUNTRY_CONTINENT,
  COUNTRY_COORDS,
  truncate,
} from './shared-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const SOURCES_DIR = resolve(PROJECT_ROOT, '__sources')
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'public/data')
const RAW_BASE_URL = 'https://raw.githubusercontent.com/richgel999/ufo_data/main/bin'

// ─── Source configurations ──────────────────────────────────────────

const SOURCES = [
  // ── Tier 1: high-value, unique sightings with locations ──
  {
    files: ['eberhart.json'],
    subSourceId: 'EBERHART',
    label: 'Eberhart',
    description: 'George Eberhart — UFOs and Intelligence: A Timeline (70 AD–present)',
    url: 'http://www.cufos.org/pdfs/UFOsandIntelligence.pdf',
  },
  {
    files: ['johnson.json'],
    subSourceId: 'JOHNSON',
    label: 'Johnson',
    description: 'Dr. Donald Johnson — UFOCAT-style date-based sighting database',
    url: 'https://web.archive.org/web/http://www.ufoinfo.com/onthisday/calendar.html',
  },
  {
    files: ['nicap_db.json'],
    subSourceId: 'NICAP',
    label: 'NICAP',
    description: 'National Investigations Committee on Aerial Phenomena — sighting database',
    url: 'http://www.nicap.org/NSID/NSID_DBListingbyDate.pdf',
  },
  {
    files: ['magonia.json'],
    subSourceId: 'VALLEE_MAGONIA',
    label: 'Vallée (Magonia)',
    description: 'Jacques Vallée — Passport to Magonia: close encounters 1868–1968',
    url: 'https://archive.org/details/passporttomagoni0000vall',
  },
  {
    files: ['bb_unknowns.json'],
    subSourceId: 'BB_UNKNOWNS',
    label: 'Blue Book Unknowns',
    description: 'Project Blue Book — official USAF unexplained cases (Don Berliner list)',
    url: 'https://github.com/richgel999/uap_resources/blob/main/bluebook_uncensored_unknowns_don_berliner.pdf',
  },

  // ── Tier 2: good supplementary sources ──
  {
    files: ['overmeire.json'],
    subSourceId: 'OVERMEIRE',
    label: 'Overmeire',
    description: 'Godelieve Van Overmeire — Belgian/French chronological catalogue',
    url: 'https://web.archive.org/web/20060107070423/http://users.skynet.be/sky84985/chrono.html',
  },
  {
    files: ['ufo_evidence_hall.json'],
    subSourceId: 'HALL',
    label: 'Hall (UFO Evidence)',
    description: 'Richard H. Hall — The UFO Evidence, Vols. I & II',
    url: 'https://www.amazon.com/UFO-Evidence-Richard-Hall/dp/0760706271',
  },
  {
    files: ['ancient.json'],
    subSourceId: 'WONDERS_SKY',
    label: 'Wonders in the Sky',
    description: 'Vallée & Aubeck — aerial phenomena from antiquity to 1879',
    url: 'https://archive.org/details/JacquesValleeChrisAubeckWondersInTheSkyUnexplainedAerialObjectsFromAntiquityToModernTimes',
  },
  {
    files: ['dolan.json'],
    subSourceId: 'DOLAN',
    label: 'Dolan',
    description: 'Richard Dolan — UFOs and the National Security State chronology',
    url: 'https://archive.org/details/ufosnationalsecu00dola',
  },
  {
    files: [
      'pre_roswell_chap1.json',
      'pre_roswell_chap2.json',
      'pre_roswell_chap3.json',
      'pre_roswell_chap4.json',
      'pre_roswell_chap5.json',
      'pre_roswell_chap6.json',
      'pre_roswell_chap7.json',
      'pre_roswell_chap8.json',
      'pre_roswell_chap9.json',
    ],
    subSourceId: 'PRE_ROSWELL',
    label: 'Pre-Roswell (Rife)',
    description: 'Philip L. Rife — It Didn\'t Start with Roswell: pre-1947 cases',
    url: 'https://archive.org/details/it-didnt-start-with-roswell-50-years-of-amazing-ufo-crashes-close-encounters-and',
  },
]

// ─── Year boundaries ────────────────────────────────────────────────

const MODERN_YEAR_START = 1900
const DECADE_CHUNK_START = 1800
const ANCIENT_CHUNK = 'ancient'

const SUMMARY_MAX_LENGTH = 300
const DESCRIPTION_MAX_LENGTH = 1500

// ─── Full US state names (chronology data sometimes uses full names) ─

const US_STATES_ABBR = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
}

const US_STATE_NAMES = new Set(Object.values(US_STATES_ABBR))
const US_STATE_FROM_NAME = Object.fromEntries(
  Object.entries(US_STATES_ABBR).map(([abbr, name]) => [name, abbr])
)

// ─── Date parsing ───────────────────────────────────────────────────

function parseChronologyDate(raw, altBasicDate) {
  if (!raw) return null

  const cleaned = raw
    .replace(/\s*\(approximate\)/i, '')
    .replace(/\?/g, '')
    .trim()

  if (!cleaned) return null

  // Year-only: "812", "66", "1947"
  if (/^\d+$/.test(cleaned)) {
    const year = parseInt(cleaned, 10)
    if (isNaN(year)) return null
    return {
      iso: `${String(year).padStart(4, '0')}-01-01T00:00:00`,
      year,
      precision: 'year',
    }
  }

  const parts = cleaned.split('/')
  if (parts.length < 2 || parts.length > 3) return null

  let month, day, year, precision

  if (parts.length === 2) {
    month = parseInt(parts[0], 10)
    year = parseInt(parts[1], 10)
    day = 1
    precision = 'month'
  } else {
    month = parseInt(parts[0], 10)
    day = parseInt(parts[1], 10)
    year = parseInt(parts[2], 10)
    precision = 'day'
  }

  if (isNaN(month) || isNaN(year)) return null
  if (isNaN(day)) { day = 1; precision = 'month' }

  // Use alt_basic_date for reliable year when available (Overmeire)
  if (altBasicDate) {
    const altParts = altBasicDate.split('/')
    const altYear = parseInt(altParts[altParts.length - 1], 10)
    if (!isNaN(altYear) && altYear > 0) year = Math.abs(altYear)
  }

  month = Math.max(1, Math.min(12, month))
  day = Math.max(1, Math.min(31, day))

  if (raw.includes('?') || raw.includes('approximate')) {
    precision = 'approximate'
  }

  const yearStr = String(Math.abs(year)).padStart(4, '0')
  const monthStr = String(month).padStart(2, '0')
  const dayStr = String(day).padStart(2, '0')
  const iso = `${yearStr}-${monthStr}-${dayStr}T00:00:00`

  return { iso, year, precision }
}

// ─── Location parsing ───────────────────────────────────────────────

const unmappedLocations = new Map()

function parseChronologyLocation(raw) {
  const fallback = {
    location: '',
    region: '',
    country: 'Unknown',
    continent: Continent.AMERICAS,
    coordinates: null,
  }

  if (!raw) return fallback

  const locStr = Array.isArray(raw) ? raw[0] : raw
  if (typeof locStr !== 'string' || !locStr.trim()) return fallback

  const location = locStr.trim()
  const parts = location.split(',').map((s) => s.trim()).filter(Boolean)

  let city = ''
  let state = ''
  let country = 'Unknown'

  if (parts.length === 1) {
    const val = parts[0]
    if (COUNTRY_CONTINENT[val]) {
      country = val
    } else if (US_STATE_NAMES.has(val)) {
      state = US_STATE_FROM_NAME[val] || val
      country = 'USA'
    } else if (US_STATES_ABBR[val]) {
      state = val
      country = 'USA'
    } else {
      const titleCase = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      if (COUNTRY_CONTINENT[titleCase]) {
        country = titleCase
      } else {
        city = val
      }
    }
  } else if (parts.length === 2) {
    const [first, second] = parts

    if (US_STATES_ABBR[second]) {
      city = first
      state = second
      country = 'USA'
    } else if (US_STATE_NAMES.has(second)) {
      city = first
      state = US_STATE_FROM_NAME[second] || second
      country = 'USA'
    } else if (COUNTRY_CONTINENT[second]) {
      city = first
      country = second
    } else {
      const firstTitle = first.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      if (COUNTRY_CONTINENT[first] || COUNTRY_CONTINENT[firstTitle]) {
        country = COUNTRY_CONTINENT[first] ? first : firstTitle
        city = second
      } else {
        city = first
        const secondTitle = second.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
        country = COUNTRY_CONTINENT[secondTitle] ? secondTitle : second
      }
    }
  } else if (parts.length >= 3) {
    city = parts[0]
    state = parts[1]
    country = parts[parts.length - 1]
  }

  if (country === 'United States' || country === 'US') country = 'USA'

  let region = city
  if (state) region = region ? `${city}, ${state}` : state

  let continent = COUNTRY_CONTINENT[country]
  if (!continent) {
    const titleCase = country.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    continent = COUNTRY_CONTINENT[titleCase]
    if (continent) country = titleCase
  }

  if (!continent) {
    unmappedLocations.set(country, (unmappedLocations.get(country) || 0) + 1)
    continent = Continent.AMERICAS
  }

  const coordinates = COUNTRY_COORDS[country] || null

  return { location, region, country, continent, coordinates }
}

// ─── Reference normalization ────────────────────────────────────────

function normalizeRef(raw) {
  if (!raw) return ''
  if (Array.isArray(raw)) return raw.join('; ')
  return String(raw)
}

// ─── Year → chunk key ───────────────────────────────────────────────

function yearToChunkKey(year) {
  if (year < DECADE_CHUNK_START) return ANCIENT_CHUNK
  if (year < MODERN_YEAR_START) {
    const decade = Math.floor(year / 10) * 10
    return `${decade}s`
  }
  return String(year)
}

// ─── Extract records from JSON ──────────────────────────────────────

function extractRecords(data) {
  if (Array.isArray(data)) return data

  const topKey = Object.keys(data)[0]
  if (!topKey) return []

  const inner = data[topKey]
  if (Array.isArray(inner)) return inner

  if (typeof inner === 'object' && inner !== null) {
    const innerKey = Object.keys(inner).find((k) => Array.isArray(inner[k]))
    if (innerKey) return inner[innerKey]
  }

  return []
}

// ─── Clean JSON (BOM / null bytes) ──────────────────────────────────

function readCleanJson(filepath) {
  const buf = readFileSync(filepath)
  const str = buf.toString('utf8').replace(/^\uFEFF/, '').replace(/\0/g, '')
  return JSON.parse(str)
}

// ─── Download source files ──────────────────────────────────────────

function downloadSources() {
  const allFiles = new Set()
  for (const src of SOURCES) {
    for (const f of src.files) allFiles.add(f)
  }

  console.log(`\n  Downloading ${allFiles.size} source files...\n`)

  for (const filename of allFiles) {
    const dest = resolve(SOURCES_DIR, filename)
    if (existsSync(dest)) {
      console.log(`  ✓ ${filename} (cached)`)
      continue
    }
    const url = `${RAW_BASE_URL}/${filename}`
    console.log(`  ↓ ${filename}`)
    try {
      execSync(`curl -sL -o "${dest}" "${url}"`, { stdio: 'pipe' })
    } catch {
      console.error(`  ✗ Failed to download ${filename}`)
    }
  }
}

// ─── Main processing ───────────────────────────────────────────────

function main() {
  const doDownload = process.argv.includes('--download')

  if (doDownload) downloadSources()

  mkdirSync(OUTPUT_DIR, { recursive: true })

  console.log('\n  ── Processing chronology sources (Option B: combined manifest) ──\n')

  // Combined chunk map: chunkKey → sighting[]
  const byChunk = new Map()

  // Sub-source metadata for the manifest
  const subSourceMeta = {}

  let totalProcessed = 0
  let totalSkipped = 0

  for (const config of SOURCES) {
    const { files, subSourceId, label } = config

    let allRecords = []
    for (const filename of files) {
      const filepath = resolve(SOURCES_DIR, filename)
      if (!existsSync(filepath)) {
        console.warn(`  ⚠ Missing: ${filename} — skipping`)
        continue
      }

      const data = readCleanJson(filepath)
      const records = extractRecords(data)
      allRecords = allRecords.concat(records)
    }

    if (allRecords.length === 0) {
      console.warn(`  ⚠ ${label}: no records found — skipping`)
      continue
    }

    let processed = 0
    let skipped = 0

    for (const record of allRecords) {
      const parsed = parseChronologyDate(record.date || record.basic_date, record.alt_basic_date)
      if (!parsed) {
        skipped++
        continue
      }

      const { iso, year } = parsed
      const loc = parseChronologyLocation(record.location)
      const ref = normalizeRef(record.ref)
      const desc = record.desc || ''
      const description = ref ? `${desc}\n\nRef: ${ref}` : desc
      const time = record.time || ''

      const sighting = {
        id: record.source_id || `${subSourceId.toLowerCase()}-${processed}`,
        source: 'CHRONOLOGY',
        subSource: subSourceId,
        occurredAt: iso,
        reportedAt: iso,
        postedAt: iso,
        location: loc.location,
        shape: Shape.UNKNOWN,
        duration: '',
        observers: 0,
        summary: truncate(desc, SUMMARY_MAX_LENGTH),
        description: truncate(description, DESCRIPTION_MAX_LENGTH),
        characteristics: [],
        coordinates: loc.coordinates,
        region: loc.region,
        country: loc.country,
        continent: loc.continent,
        status: Status.PENDING,
        credibility: 50,
        ...(time && { time }),
        ...(ref && { ref: truncate(ref, 500) }),
      }

      const chunkKey = yearToChunkKey(year)
      if (!byChunk.has(chunkKey)) byChunk.set(chunkKey, [])
      byChunk.get(chunkKey).push(sighting)
      processed++
    }

    totalProcessed += processed
    totalSkipped += skipped

    subSourceMeta[subSourceId] = {
      label: config.label,
      description: config.description,
      url: config.url,
      count: processed,
      skipped,
    }

    console.log(
      `  ✓ ${label.padEnd(24)} ${String(processed).padStart(6)} records  (${skipped} skipped)`
    )
  }

  if (totalProcessed === 0) {
    console.error('  ✗ No records processed — aborting')
    process.exit(1)
  }

  // Write combined chunks
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalRecords: totalProcessed,
    skippedRecords: totalSkipped,
    subSources: subSourceMeta,
    years: {},
  }

  const sortedKeys = [...byChunk.keys()].sort((a, b) => {
    if (a === ANCIENT_CHUNK) return -1
    if (b === ANCIENT_CHUNK) return 1
    const aNum = parseInt(a, 10) || 0
    const bNum = parseInt(b, 10) || 0
    return aNum - bNum
  })

  for (const key of sortedKeys) {
    const sightings = byChunk.get(key)
    sightings.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

    const filename = `chronology-${key}.json`
    const filepath = resolve(OUTPUT_DIR, filename)
    writeFileSync(filepath, JSON.stringify(sightings))

    const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(sightings)) / 1024)
    const entry = { count: sightings.length, file: filename, sizeKB }

    // For non-single-year chunks, include distinct years so the UI can list them
    if (key === ANCIENT_CHUNK || key.endsWith('s')) {
      const years = [...new Set(sightings.map((s) => {
        const y = parseInt(s.occurredAt.split('-')[0], 10)
        return isNaN(y) ? null : y
      }).filter((y) => y !== null))].sort((a, b) => a - b)
      entry.years = years
    }

    manifest.years[key] = entry
  }

  const manifestPath = resolve(OUTPUT_DIR, 'chronology-manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  // Summary
  console.log(`\n  ── Summary ──`)
  console.log(`  ${Object.keys(subSourceMeta).length} sub-sources processed`)
  console.log(`  ${totalProcessed.toLocaleString()} total records`)
  console.log(`  ${sortedKeys.length} chunk files written to public/data/`)

  if (unmappedLocations.size > 0) {
    const sorted = [...unmappedLocations.entries()].sort((a, b) => b[1] - a[1])
    console.log(`\n  ⚠ Unmapped countries (${unmappedLocations.size} unique):`)
    for (const [loc, count] of sorted.slice(0, 20)) {
      console.log(`    ${loc.padEnd(28)} ${count.toLocaleString()}`)
    }
    if (sorted.length > 20) console.log(`    ... and ${sorted.length - 20} more`)
  }

  let totalKB = Object.values(manifest.years).reduce((s, /** @type {any} */ y) => s + y.sizeKB, 0)
  console.log(`\n  Total output: ${(totalKB / 1024).toFixed(1)} MB`)
  console.log(`  Manifest: chronology-manifest.json\n`)
}

main()
