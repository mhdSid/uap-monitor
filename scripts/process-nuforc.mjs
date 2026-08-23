#!/usr/bin/env node

/**
 * process-nuforc.mjs
 *
 * Transforms the raw HuggingFace NUFORC JSON dump into
 * lightweight per-year chunks ready for the browser.
 *
 * Design principles:
 *   - Never silently discard source data
 *   - Characteristics are passed through as-is from NUFORC (no whitelist)
 *   - Unknown countries/shapes are logged for audit, not dropped
 *   - All string constants are named, never anonymous
 *
 * Usage:
 *   node scripts/process-nuforc.mjs [path-to-nuforc.json]
 *
 * Output:
 *   public/data/nuforc-YYYY.json      — one file per year
 *   public/data/nuforc-manifest.json   — index of all chunks with counts
 */

import { writeFileSync, mkdirSync, existsSync, statSync, createReadStream } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/stream-array.js'
import { chain } from 'stream-chain'

import {
  Status, Shape, VALID_SHAPES, truncate
} from './shared-constants.mjs'
import { resolveWithStats, printStats, resetStats } from './geocoder.mjs'
import { splitLocation, createResolutionReport } from './geo-resolve.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
// UAP_OUTPUT_DIR redirects a run to a scratch directory so pipeline changes can
// be verified against the committed output before anything overwrites it.
const OUTPUT_DIR = resolve(PROJECT_ROOT, process.env.UAP_OUTPUT_DIR || 'public/data')
const SOURCES_DIR = resolve(PROJECT_ROOT, '__sources')
const DEFAULT_INPUT = resolve(SOURCES_DIR, 'nuforc.json')

// ─── NUFORC-specific constants ──────────────────────────────────────

const Source = {
  NUFORC: 'NUFORC'
}

const VALID_YEAR_MIN = 1950
const VALID_YEAR_MAX = 2030
const SUMMARY_MAX_LENGTH = 200
const DESCRIPTION_MAX_LENGTH = 1200
const CREDIBILITY_BASELINE = 30
const CREDIBILITY_MAX = 100

// ─── Shape normalization ────────────────────────────────────────────

const SHAPE_ALIASES = {
  'Circular': Shape.CIRCLE,
  'Round': Shape.CIRCLE,
  'Disc': Shape.DISK,
  'Saucer': Shape.DISK,
  'Triangular': Shape.TRIANGLE,
  'Cigar-shaped': Shape.CIGAR,
  'Cylindrical': Shape.CYLINDER,
  'Rectangular': Shape.RECTANGLE,
  'Egg-shaped': Shape.EGG,
  'Hexagon': Shape.DIAMOND,
  'Octahedron': Shape.DIAMOND,
  'Bullet/Missile': Shape.CYLINDER,
  'Pellet': Shape.SPHERE,
  'Crescent': Shape.OTHER,
  'Blimp': Shape.CIGAR,
  'Dome': Shape.CIRCLE,
  'Flare': Shape.FIREBALL,
  'N/A': Shape.UNKNOWN,
  '': Shape.UNKNOWN
}

// ─── Country → default coordinates ──────────────────────────────────
// Country → region resolution lives in geo-registry.mjs / geo-resolve.mjs

// US state abbreviations → full name
const US_STATES = {
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

// Canadian province abbreviations
const CA_PROVINCES = {
  'AB': 'Alberta', 'BC': 'British Columbia', 'MB': 'Manitoba',
  'NB': 'New Brunswick', 'NL': 'Newfoundland', 'NS': 'Nova Scotia',
  'NT': 'Northwest Territories', 'NU': 'Nunavut', 'ON': 'Ontario',
  'PE': 'Prince Edward Island', 'QC': 'Quebec', 'SK': 'Saskatchewan',
  'YT': 'Yukon'
}

// ─── Audit trackers ─────────────────────────────────────────────────

const geoReport = createResolutionReport()  // country token → region, with provenance
const unmappedShapes = new Map()      // shape → count
const seenCharacteristics = new Map() // characteristic → count

// ─── Parsing helpers ────────────────────────────────────────────────

function parseNuforcDate (raw) {
  if (!raw) return null
  // NUFORC "Approximate Local" entries publish HH:MM with no seconds — accept
  // those and pad to :00 so we don't silently discard ~18% of the corpus.
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?/)
  if (!match) return null
  const seconds = match[3] || ':00'
  return `${match[1]}T${match[2]}${seconds}`
}

function parseLocation (raw) {
  const parts = splitLocation(raw)

  let city = parts[0] || ''
  let state = ''
  let countryToken = ''

  if (parts.length >= 3) {
    state = parts[1] || ''
    countryToken = parts[2] || ''
  } else if (parts.length === 2) {
    const second = parts[1] || ''
    if (US_STATES[second]) {
      state = second
      countryToken = 'USA'
    } else if (CA_PROVINCES[second]) {
      state = second
      countryToken = 'Canada'
    } else {
      countryToken = second
    }
  } else if (parts.length === 1) {
    // A lone token is as likely to be a country as a city ("Australia").
    countryToken = US_STATES[city] || CA_PROVINCES[city] ? city : ''
    if (countryToken) { state = city; city = '' }
  }

  // A subdivision code sometimes lands in the country slot ("City, , CA").
  // Both directions are handled, for the US *and* Canada — the Canadian half
  // used to be missing, which is why ON/BC/NS/AB leaked through as countries.
  if (US_STATES[countryToken]) {
    state = countryToken
    countryToken = 'USA'
  } else if (CA_PROVINCES[countryToken]) {
    state = countryToken
    countryToken = 'Canada'
  }

  // Region string keeps its existing shape for display.
  let region = city
  if (state && US_STATES[state]) {
    region = city ? `${city}, ${state}` : state
    countryToken = 'USA'
  } else if (state && CA_PROVINCES[state]) {
    region = city ? `${city}, ${state}` : state
    countryToken = 'Canada'
  } else if (state) {
    region = city ? `${city}, ${state}` : state
  }

  // Resolve through the tiered registry. Nothing is guessed: an unresolved
  // token yields a null continent and is reported, never filed under AMERICAS.
  const resolved = geoReport.resolve(countryToken)

  return {
    city,
    state,
    country: resolved?.country || countryToken || '',
    region,
    continent: resolved ? resolved.region : null
  }
}


function normalizeShape (raw) {
  if (!raw) return Shape.UNKNOWN
  const trimmed = raw.trim()
  if (VALID_SHAPES.has(trimmed)) return trimmed
  if (SHAPE_ALIASES[trimmed]) return SHAPE_ALIASES[trimmed]

  // Case-insensitive fallback
  for (const shape of VALID_SHAPES) {
    if (shape.toLowerCase() === trimmed.toLowerCase()) return shape
  }

  // Log unmapped shapes for audit
  unmappedShapes.set(trimmed, (unmappedShapes.get(trimmed) || 0) + 1)
  return Shape.UNKNOWN
}

/**
 * Pass through ALL characteristics from the source.
 * We do NOT whitelist — NUFORC defines the vocabulary, not us.
 * Unknown characteristics are tracked for awareness but never dropped.
 */
/**
 * Variant spellings that must collapse onto one canonical characteristic.
 *
 * "Changed Colo" is not a typo of ours: the older live-site scrape truncated
 * the label, so the corpus carries both "Changed Colo" and "Changed Color" for
 * the same attribute. Left unaliased they are two separate facets, and a UI
 * filter on SightingCharacteristic.CHANGED_COLOR silently misses most matches.
 */
const CHARACTERISTIC_ALIASES = {
  'Changed Colo': 'Changed Color',
  'Changed colour': 'Changed Color',
  'Changed Colour': 'Changed Color'
}

function parseCharacteristics (raw) {
  if (!Array.isArray(raw)) return []

  const out = []
  const seen = new Set()

  for (const value of raw) {
    if (typeof value !== 'string' || !value.trim()) continue
    const canonical = CHARACTERISTIC_ALIASES[value.trim()] || value.trim()
    seenCharacteristics.set(canonical, (seenCharacteristics.get(canonical) || 0) + 1)
    // Aliasing can make two source entries collide — keep one.
    if (seen.has(canonical)) continue
    seen.add(canonical)
    out.push(canonical)
  }

  return out
}

/**
 * Naive credibility score (0–100).
 * Factors: observer count, characteristic detail, duration specificity, summary length.
 * Placeholder until a proper scoring model is built.
 */
function computeCredibility (record) {
  let score = CREDIBILITY_BASELINE

  const observers = record['No of observers'] || 0
  if (observers >= 4) score += 25
  else if (observers >= 2) score += 15
  else if (observers === 1) score += 5

  const chars = Array.isArray(record.Characteristics) ? record.Characteristics.length : 0
  score += Math.min(chars * 5, 20)

  const duration = record.Duration || ''
  if (/\d/.test(duration)) score += 10

  const summary = record.Summary || ''
  if (summary.length > SUMMARY_MAX_LENGTH) score += 10
  else if (summary.length > 50) score += 5

  return Math.min(score, CREDIBILITY_MAX)
}

// truncate() imported from shared-constants.mjs

// ─── Streaming JSON array reader ────────────────────────────────────
//
// `__sources/nuforc.json` exceeds V8's ~512MB single-string cap, so
// `readFileSync` throws ERR_STRING_TOO_LONG. Stream-parse instead.
// See note in scripts/nuforc-scrapper/scraper.mjs for the full rationale.

function streamRecordsByYear (filePath, onRecord) {
  return new Promise((resolve, reject) => {
    const pipeline = chain([
      createReadStream(filePath),
      parser(),
      streamArray()
    ])
    pipeline.on('data', ({ value }) => onRecord(value))
    pipeline.on('end', resolve)
    pipeline.on('error', reject)
  })
}

// ─── Main ───────────────────────────────────────────────────────────

async function main () {
  const inputPath = process.argv[2] || DEFAULT_INPUT

  if (!existsSync(inputPath)) {
    console.error(`\n  ✗ File not found: ${inputPath}`)
    console.error(`\n  Download it first:`)
    console.error(`  curl -L -o __sources/nuforc.json https://huggingface.co/datasets/kcimc/NUFORC/resolve/main/nuforc.json\n`)
    process.exit(1)
  }

  const inputSizeMB = statSync(inputPath).size / 1024 / 1024
  console.log(`\n  Reading ${inputPath} (${inputSizeMB.toFixed(0)} MB)...`)

  // Process each record as it streams in — never materialize the full file
  // as a string, and never hold both raw + processed records simultaneously.
  const byYear = new Map()
  let skipped = 0
  let processed = 0
  let total = 0
  const shapeCounts = new Map()
  const countryCounts = new Map()

  await streamRecordsByYear(inputPath, (record) => {
    total++
    if (total % 50000 === 0) {
      console.log(`  ... streamed ${total.toLocaleString()} records`)
    }

    const occurredAt = parseNuforcDate(record.Occurred)
    if (!occurredAt) {
      skipped++
      return
    }

    const year = occurredAt.slice(0, 4)
    const yearNum = parseInt(year, 10)
    if (yearNum < VALID_YEAR_MIN || yearNum > VALID_YEAR_MAX) {
      skipped++
      return
    }

    const reportedAt = parseNuforcDate(record.Reported) || occurredAt
    const postedAt = parseNuforcDate(record.Posted) || reportedAt

    const loc = parseLocation(record.Location)
    const shape = normalizeShape(record.Shape)
    const characteristics = parseCharacteristics(record.Characteristics)
    const credibility = computeCredibility(record)

    shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1)
    countryCounts.set(loc.country, (countryCounts.get(loc.country) || 0) + 1)

    const sighting = {
      id: String(record.Sighting || processed),
      source: Source.NUFORC,
      occurredAt,
      reportedAt,
      postedAt,
      location: record.Location || '',
      shape,
      duration: record.Duration || '',
      observers: record['No of observers'] || 0,
      summary: truncate(record.Summary, SUMMARY_MAX_LENGTH),
      description: truncate(record.Text, DESCRIPTION_MAX_LENGTH),
      characteristics,
      coordinates: resolveWithStats(loc.city, loc.state, loc.country),
      region: loc.region,
      country: loc.country,
      continent: loc.continent,
      status: Status.PENDING,
      credibility
    }

    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year).push(sighting)
    processed++
  })

  console.log(`  Found ${total.toLocaleString()} records`)

  // ─ Deduplicate ─
  let dupes = 0
  const deduped = new Map()

  for (const [year, sightings] of byYear) {
    const seenIds = new Set()
    const seenDescs = new Set()
    const unique = []

    for (const s of sightings) {
      // Skip exact ID duplicates
      if (seenIds.has(s.id)) { dupes++; continue }
      seenIds.add(s.id)

      // Skip duplicate descriptions (normalize: lowercase, strip whitespace/punctuation)
      if (s.description) {
        const normDesc = s.description.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
        if (normDesc.length > 30) {
          if (seenDescs.has(normDesc)) { dupes++; continue }
          seenDescs.add(normDesc)
        }
      }

      unique.push(s)
    }

    deduped.set(year, unique)
  }

  console.log(`  Deduplicated: ${dupes} duplicates removed`)

  // ─ Write chunks ─
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalRecords: processed - dupes,
    skippedRecords: skipped,
    duplicatesRemoved: dupes,
    years: {}
  }

  const sortedYears = [...deduped.keys()].sort()

  for (const year of sortedYears) {
    const sightings = deduped.get(year)
    sightings.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

    const filename = `nuforc-${year}.json`
    const filepath = resolve(OUTPUT_DIR, filename)
    writeFileSync(filepath, JSON.stringify(sightings))

    const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(sightings)) / 1024)
    manifest.years[year] = { count: sightings.length, file: filename, sizeKB }
  }

  const manifestPath = resolve(OUTPUT_DIR, 'nuforc-manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  // ─ Summary ─
  console.log(`\n  ✓ Processed ${processed.toLocaleString()} sightings (${skipped} skipped, ${dupes} duplicates removed)`)
  console.log(`  ✓ ${(processed - dupes).toLocaleString()} unique sightings in ${sortedYears.length} year chunks`)
  console.log(`\n  Year range: ${sortedYears[0]} — ${sortedYears[sortedYears.length - 1]}`)

  // Top shapes
  const topShapes = [...shapeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  console.log(`\n  Top shapes:`)
  for (const [shape, count] of topShapes) {
    console.log(`    ${shape.padEnd(14)} ${count.toLocaleString()}`)
  }

  // Top countries
  const topCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  console.log(`\n  Top countries:`)
  for (const [country, count] of topCountries) {
    console.log(`    ${country.padEnd(16)} ${count.toLocaleString()}`)
  }

  // ─ Audit: unmapped data ─
  geoReport.print('NUFORC Geo')

  if (unmappedShapes.size > 0) {
    const sorted = [...unmappedShapes.entries()].sort((a, b) => b[1] - a[1])
    console.log(`\n  ⚠ Unmapped shapes (${unmappedShapes.size} unique, defaulted to ${Shape.UNKNOWN}):`)
    for (const [shape, count] of sorted) {
      console.log(`    "${shape}" → ${count.toLocaleString()}`)
    }
  }

  // All characteristics seen in source data
  const charsSorted = [...seenCharacteristics.entries()].sort((a, b) => b[1] - a[1])
  console.log(`\n  Characteristics found in source (${charsSorted.length} unique):`)
  for (const [char, count] of charsSorted) {
    console.log(`    ${char.padEnd(40)} ${count.toLocaleString()}`)
  }

  // Size report
  const totalMB = Object.values(manifest.years).reduce((a, y) => a + y.sizeKB, 0) / 1024
  console.log(`\n  Total output: ${totalMB.toFixed(1)} MB (from ${inputSizeMB.toFixed(0)} MB input)`)
  console.log(`  Manifest: ${manifestPath}\n`)

  printStats('NUFORC Geocoder')
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  if (err.stack) console.error(err.stack)
  process.exit(1)
})
