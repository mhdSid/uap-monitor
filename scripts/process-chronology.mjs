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
  COUNTRY_ALIASES,
  REGION_TO_COUNTRY,
  US_LOCATIONS,
  truncate
} from './shared-constants.mjs'
import { resolveWithStats, normalizeLocationString, printStats } from './geocoder.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const OUTPUT_DIR = resolve(PROJECT_ROOT, process.env.UAP_OUTPUT_DIR || 'public/data')
const SOURCES_DIR = resolve(PROJECT_ROOT, '__sources')
const RAW_BASE_URL = 'https://raw.githubusercontent.com/richgel999/ufo_data/main/bin'

// ─── Source configurations ──────────────────────────────────────────

const SOURCES = [
  // ── Tier 1: high-value, unique sightings with locations ──
  {
    files: ['eberhart.json'],
    subSourceId: 'EBERHART',
    label: 'Eberhart',
    description: 'George Eberhart — UFOs and Intelligence: A Timeline (70 AD–present)',
    url: 'http://www.cufos.org/pdfs/UFOsandIntelligence.pdf'
  },
  {
    files: ['johnson.json'],
    subSourceId: 'JOHNSON',
    label: 'Johnson',
    description: 'Dr. Donald Johnson — UFOCAT-style date-based sighting database',
    url: 'https://web.archive.org/web/http://www.ufoinfo.com/onthisday/calendar.html'
  },
  {
    files: ['nicap_db.json'],
    subSourceId: 'NICAP',
    label: 'NICAP',
    description: 'National Investigations Committee on Aerial Phenomena — sighting database',
    url: 'http://www.nicap.org/NSID/NSID_DBListingbyDate.pdf'
  },
  {
    files: ['magonia.json'],
    subSourceId: 'VALLEE_MAGONIA',
    label: 'Vallée (Magonia)',
    description: 'Jacques Vallée — Passport to Magonia: close encounters 1868–1968',
    url: 'https://archive.org/details/passporttomagoni0000vall'
  },
  {
    files: ['bb_unknowns.json'],
    subSourceId: 'BB_UNKNOWNS',
    label: 'Blue Book Unknowns',
    description: 'Project Blue Book — official USAF unexplained cases (Don Berliner list)',
    url: 'https://github.com/richgel999/uap_resources/blob/main/bluebook_uncensored_unknowns_don_berliner.pdf'
  },

  // ── Tier 2: good supplementary sources ──
  {
    files: ['overmeire.json'],
    subSourceId: 'OVERMEIRE',
    label: 'Overmeire',
    description: 'Godelieve Van Overmeire — Belgian/French chronological catalogue',
    url: 'https://web.archive.org/web/20060107070423/http://users.skynet.be/sky84985/chrono.html'
  },
  {
    files: ['ufo_evidence_hall.json'],
    subSourceId: 'HALL',
    label: 'Hall (UFO Evidence)',
    description: 'Richard H. Hall — The UFO Evidence, Vols. I & II',
    url: 'https://www.amazon.com/UFO-Evidence-Richard-Hall/dp/0760706271'
  },
  {
    files: ['ancient.json'],
    subSourceId: 'WONDERS_SKY',
    label: 'Wonders in the Sky',
    description: 'Vallée & Aubeck — aerial phenomena from antiquity to 1879',
    url: 'https://archive.org/details/JacquesValleeChrisAubeckWondersInTheSkyUnexplainedAerialObjectsFromAntiquityToModernTimes'
  },
  {
    files: ['dolan.json'],
    subSourceId: 'DOLAN',
    label: 'Dolan',
    description: 'Richard Dolan — UFOs and the National Security State chronology',
    url: 'https://archive.org/details/ufosnationalsecu00dola'
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
      'pre_roswell_chap9.json'
    ],
    subSourceId: 'PRE_ROSWELL',
    label: 'Pre-Roswell (Rife)',
    description: 'Philip L. Rife — It Didn\'t Start with Roswell: pre-1947 cases',
    url: 'https://archive.org/details/it-didnt-start-with-roswell-50-years-of-amazing-ufo-crashes-close-encounters-and'
  }
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
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
}

const US_STATE_NAMES = new Set(Object.values(US_STATES_ABBR))
const US_STATE_FROM_NAME = Object.fromEntries(
  Object.entries(US_STATES_ABBR).map(([abbr, name]) => [name, abbr])
)

// ─── Date parsing ───────────────────────────────────────────────────

function parseChronologyDate (raw, altBasicDate) {
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
      precision: 'year'
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

function parseChronologyLocation (raw) {
  const fallback = {
    location: '',
    region: '',
    country: 'Unknown',
    continent: Continent.AMERICAS,
    coordinates: null
  }

  if (!raw) return fallback

  const locStr = Array.isArray(raw) ? raw[0] : raw
  if (typeof locStr !== 'string' || !locStr.trim()) return fallback

  const location = locStr.trim().replace(/[\u2018\u2019]/g, "'")

  // Helper: resolve a value to a known country (checks COUNTRY_CONTINENT,
  // COUNTRY_ALIASES, REGION_TO_COUNTRY, US state names, abbreviations)
  const resolveCountry = (val) => {
    if (!val) return null
    // Direct match in COUNTRY_CONTINENT
    if (COUNTRY_CONTINENT[val]) return val
    // Alias match
    if (COUNTRY_ALIASES[val]) return COUNTRY_ALIASES[val]
    // Title-case attempt
    const tc = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    if (COUNTRY_CONTINENT[tc]) return tc
    if (COUNTRY_ALIASES[tc]) return COUNTRY_ALIASES[tc]
    // Region → country (Canadian provinces, Australian states, etc.)
    if (REGION_TO_COUNTRY[val]) return REGION_TO_COUNTRY[val]
    if (REGION_TO_COUNTRY[tc]) return REGION_TO_COUNTRY[tc]
    // Strip directional prefixes: "Northern China" → "China", "N. China" → "China"
    const stripped = val
      .replace(/^(?:northern|southern|eastern|western|central|north|south|east|west|northeast|northwest|southeast|southwest|N\.\s*|S\.\s*|E\.\s*|W\.\s*|NE\.\s*|NW\.\s*|SE\.\s*|SW\.\s*)\s*/i, '')
      .trim()
    if (stripped && stripped !== val) {
      const sr = resolveCountry(stripped)
      if (sr) return sr
    }
    return null
  }

  const resolveUSState = (val) => {
    if (!val) return false
    if (US_STATES_ABBR[val]) return true
    if (US_STATE_NAMES.has(val)) return true
    return false
  }

  // ── Pre-processing: try to resolve the whole string as an alias first ──
  const wholeResolved = resolveCountry(location)
  if (wholeResolved) {
    const continent = COUNTRY_CONTINENT[wholeResolved] || COUNTRY_CONTINENT['Unknown']
    const coordinates = null
    return { location, region: '', country: wholeResolved, continent, coordinates }
  }

  // ── Colon-separated (Overmeire: "GREAT BRITAIN: Sandwich (Kent)") ──
  if (location.includes(':')) {
    const colonParts = location.split(':').map((s) => s.trim().replace(/\.$/, '').trim()).filter(Boolean)
    if (colonParts.length >= 2) {
      const first = colonParts[0]
      const rest = colonParts.slice(1).join(', ')
      const resolved = resolveCountry(first)
      if (resolved) {
        const continent = COUNTRY_CONTINENT[resolved] || COUNTRY_CONTINENT['Unknown']
        const coordinates = null
        return { location, region: rest, country: resolved, continent, coordinates }
      }
    }
  }

  // ── Descriptive patterns: extract country from "...in/of/near/off COUNTRY..." ──
  // Try multiple patterns from most to least specific
  const descPatterns = [
    /\b(?:in|of|near|off)\s+(?:the\s+)?([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)(?:\s*[.?]?)$/i,   // "in Japan", "near the British Isles", "of SPAIN"
    /\b(?:coast|west|east|north|south|southwest|southeast|northwest|northeast)\s+of\s+([A-Z][A-Za-z\s]+?)(?:\s*\(.*\))?$/i  // "coast of SPAIN"
  ]
  for (const pat of descPatterns) {
    const m = location.match(pat)
    if (m) {
      const candidate = m[1].trim().replace(/\.$/, '')
      const resolved = resolveCountry(candidate)
      if (resolved) {
        const continent = COUNTRY_CONTINENT[resolved] || COUNTRY_CONTINENT['Unknown']
        const coordinates = null
        return { location, region: location, country: resolved, continent, coordinates }
      }
    }
  }

  // ── Parenthesized country: "...text (SPAIN)" or "GERMANY (unspecified)" ──
  const parenMatch = location.match(/\(([^)]+)\)\s*$/)
  if (parenMatch) {
    const candidate = parenMatch[1].trim().replace(/\.$/, '')
    const resolved = resolveCountry(candidate)
    if (resolved) {
      const continent = COUNTRY_CONTINENT[resolved] || COUNTRY_CONTINENT['Unknown']
      const coordinates = null
      return { location, region: location, country: resolved, continent, coordinates }
    }
    // Parenthesized US state: "Cleveland (Ohio)", "Huntsville (Alabama)"
    if (resolveUSState(candidate)) {
      const continent = COUNTRY_CONTINENT['USA']
      const stateAbbr = US_STATES_ABBR[candidate] ? candidate : US_STATE_FROM_NAME[candidate]
      const coordinates = null
      return { location, region: location, country: 'USA', continent, coordinates }
    }
    // If paren content isn't a country, try the prefix before the paren
    const prefix = location.replace(/\s*\([^)]*\)\s*$/, '').trim()
    const prefixResolved = resolveCountry(prefix)
    if (prefixResolved) {
      const continent = COUNTRY_CONTINENT[prefixResolved] || COUNTRY_CONTINENT['Unknown']
      const coordinates = null
      return { location, region: location, country: prefixResolved, continent, coordinates }
    }
  }

  // Strip trailing periods from each part (Overmeire: "Texas.", "California.")
  // Also strip generic suffixes like "At Sea", "in flight" that hide the real location
  const STRIP_SUFFIXES = new Set(['at sea', 'in flight', 'in air', 'in air space'])
  const parts = location.split(',')
    .map((s) => s.trim().replace(/\.$/, '').trim())
    .filter((s) => s && !STRIP_SUFFIXES.has(s.toLowerCase()))
  if (parts.length === 0) return fallback

  let city = ''
  let state = ''
  let country = 'Unknown'

  if (parts.length === 1) {
    const val = parts[0]
    const resolved = resolveCountry(val)
    if (resolved) {
      country = resolved
    } else if (resolveUSState(val)) {
      state = US_STATE_FROM_NAME[val] || val
      country = 'USA'
    } else if (US_LOCATIONS.has(val)) {
      city = val
      country = 'USA'
    } else {
      // Try first word(s) as country: "ENGLAND Lakenheath" → England
      const words = val.split(/\s+/)
      let found = false
      for (let i = Math.min(3, words.length - 1); i >= 1; i--) {
        const prefix = words.slice(0, i).join(' ')
        const prefixResolved = resolveCountry(prefix)
        if (prefixResolved) {
          country = prefixResolved
          city = words.slice(i).join(' ')
          found = true
          break
        }
      }
      if (!found) city = val
    }
  } else if (parts.length === 2) {
    const [first, second] = parts

    if (US_STATES_ABBR[second]) {
      // "City, CA"
      city = first
      state = second
      country = 'USA'
    } else if (US_STATE_NAMES.has(second)) {
      // "City, California"
      city = first
      state = US_STATE_FROM_NAME[second] || second
      country = 'USA'
    } else {
      // Try first part as country FIRST when it's clearly a country name
      // (Overmeire format: "FRANCE, at sea" / "JAPAN, City")
      const firstResolved = resolveCountry(first)
      const secondResolved = resolveCountry(second)

      if (firstResolved && secondResolved) {
        // Both resolve — prefer the real country over generic (At Sea, Unknown, etc.)
        const genericCountries = new Set(['At Sea', 'Unknown', 'Atlantic Ocean', 'Pacific Ocean'])
        if (genericCountries.has(secondResolved) && !genericCountries.has(firstResolved)) {
          country = firstResolved
          city = second
        } else {
          city = first
          country = secondResolved
        }
      } else if (firstResolved) {
        country = firstResolved
        city = second
      } else if (secondResolved) {
        city = first
        country = secondResolved
      } else if (REGION_TO_COUNTRY[second]) {
        city = first
        country = REGION_TO_COUNTRY[second]
        state = second
      } else if (US_LOCATIONS.has(second) || US_LOCATIONS.has(first)) {
        city = first
        country = 'USA'
      } else {
        city = first
        country = second
      }
    }
  } else if (parts.length >= 3) {
    const first = parts[0]
    const last = parts[parts.length - 1]
    const secondLast = parts[parts.length - 2]

    // Try FIRST part as country (Overmeire: "FRANCE, City, SubRegion")
    const firstResolved = resolveCountry(first)
    // Try LAST part as country (standard: "City, State, Country")
    const lastResolved = resolveCountry(last)

    if (firstResolved && lastResolved) {
      // Both resolve — prefer last (standard format) unless last is generic
      const genericCountries = new Set(['At Sea', 'Unknown', 'Atlantic Ocean', 'Pacific Ocean'])
      if (genericCountries.has(lastResolved) && !genericCountries.has(firstResolved)) {
        country = firstResolved
        city = parts.slice(1).join(', ')
      } else {
        country = lastResolved
        city = parts[0]
        state = parts.slice(1, -1).join(', ')
      }
    } else if (lastResolved) {
      country = lastResolved
      city = parts[0]
      state = parts.slice(1, -1).join(', ')
    } else if (firstResolved) {
      // Overmeire: "FRANCE, City, SubRegion"
      country = firstResolved
      city = parts.slice(1).join(', ')
    } else if (US_STATES_ABBR[last]) {
      country = 'USA'
      state = parts.slice(1, -1).join(', ')
      city = first
    } else if (US_STATE_NAMES.has(last)) {
      country = 'USA'
      state = US_STATE_FROM_NAME[last] || last
      city = first
    } else if (REGION_TO_COUNTRY[last]) {
      country = REGION_TO_COUNTRY[last]
      state = last
      city = first
    } else if (US_LOCATIONS.has(last)) {
      country = 'USA'
      state = parts.slice(1, -1).join(', ')
      city = first
    } else if (resolveCountry(secondLast)) {
      country = resolveCountry(secondLast)
      state = parts.slice(1, -2).join(', ')
      city = first
    } else {
      city = first
      state = parts.slice(1, -1).join(', ')
      country = last
    }
  }

  if (country === 'United States' || country === 'US') country = 'USA'
  // Resolve final country through aliases one more time
  if (COUNTRY_ALIASES[country]) country = COUNTRY_ALIASES[country]

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

  const coordinates = null

  return { location, region, country, continent, coordinates }
}

// ─── Reference normalization ────────────────────────────────────────

function normalizeRef (raw) {
  if (!raw) return ''
  if (Array.isArray(raw)) return raw.join('; ')
  return String(raw)
}

// ─── Credibility scoring ────────────────────────────────────────────

const SUB_SOURCE_TIER = {
  BB_UNKNOWNS: 15,    // Official USAF investigation
  NICAP: 10,          // Scientific investigation org
  EBERHART: 10,       // Comprehensive scholarly timeline
  HALL: 10,           // Rigorous evidence compilation
  VALLEE_MAGONIA: 8,  // Renowned researcher
  JOHNSON: 5,         // Date-based catalog
  DOLAN: 5,           // National security focus
  PRE_ROSWELL: 3,     // Historical compilation
  WONDERS_SKY: 3,     // Ancient/historical
  OVERMEIRE: 3       // Broad catalog
}

function computeChronologyCredibility (record, subSourceId, loc, ref, desc, parsed) {
  let score = 20 // baseline

  // Sub-source tier (0-15)
  score += SUB_SOURCE_TIER[subSourceId] || 3

  // Description length (0-20)
  const descLen = (desc || '').length
  if (descLen > 500) score += 20
  else if (descLen > 200) score += 15
  else if (descLen > 80) score += 10
  else if (descLen > 30) score += 5

  // Location specificity (0-15)
  if (loc.coordinates) score += 10
  if (loc.country !== 'Unknown') score += 5

  // Date precision (0-10)
  const dateStr = record.date || record.alt_basic_date || ''
  const slashCount = (dateStr.match(/\//g) || []).length
  if (slashCount >= 2) score += 10        // full M/D/Y
  else if (slashCount === 1) score += 5   // M/Y only

  // References (0-10)
  const refStr = ref || ''
  const refCount = (refStr.match(/\[/g) || []).length
  if (refCount >= 3) score += 10
  else if (refCount >= 1) score += 5

  // Time specified (0-5)
  if (record.time) score += 5

  return Math.min(100, Math.max(0, score))
}

// ─── Year → chunk key ───────────────────────────────────────────────

function yearToChunkKey (year) {
  if (year < DECADE_CHUNK_START) return ANCIENT_CHUNK
  if (year < MODERN_YEAR_START) {
    const decade = Math.floor(year / 10) * 10
    return `${decade}s`
  }
  return String(year)
}

// ─── Extract records from JSON ──────────────────────────────────────

function extractRecords (data) {
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

function readCleanJson (filepath) {
  const buf = readFileSync(filepath)
  const str = buf.toString('utf8').replace(/^\uFEFF/, '').replace(/\0/g, '')
  return JSON.parse(str)
}

// ─── Download source files ──────────────────────────────────────────

function downloadSources () {
  const allFiles = new Set()
  for (const src of SOURCES) {
    for (const f of src.files) allFiles.add(f)
  }

  mkdirSync(SOURCES_DIR, { recursive: true })
  console.log(`\n  Downloading ${allFiles.size} source files to __sources/...\n`)

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

function main () {
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

      // Use geocoder for city-level coordinates (parseChronologyLocation handles country/continent)
      const geoNorm = normalizeLocationString(String(record.location || ''))
      const geoCoords = resolveWithStats(geoNorm.city || loc.region, geoNorm.state, loc.country)

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
        coordinates: geoCoords,
        region: loc.region,
        country: loc.country,
        continent: loc.continent,
        status: Status.PENDING,
        credibility: computeChronologyCredibility(record, subSourceId, loc, ref, desc, parsed),
        ...(time && { time }),
        ...(ref && { ref: truncate(ref, 500) })
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
      skipped
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
    years: {}
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

  printStats('Chronology Geocoder')
}

main()
