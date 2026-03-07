#!/usr/bin/env node

/**
 * process-hatch.mjs
 *
 * Transforms the Hatch *U* Database JSON (from richgel999/ufo_data)
 * into lightweight per-year chunks matching our Sighting format.
 *
 * Design principles (same as NUFORC pipeline):
 *   - Never silently discard source data
 *   - Unknown countries/shapes are logged for audit, not dropped
 *   - All string constants are named, never anonymous
 *   - Attributes are preserved as tags
 *
 * Usage:
 *   node scripts/process-hatch.mjs [path-to-hatch_udb.json]
 *
 * Or download automatically:
 *   node scripts/process-hatch.mjs --download
 *
 * Output:
 *   public/data/hatch-YYYY.json      — one file per year (or decade for pre-1900)
 *   public/data/hatch-manifest.json   — index of all chunks with counts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

import {
  Continent, Status, Shape,
  COUNTRY_CONTINENT, truncate
} from './shared-constants.mjs'
import { resolveWithStats, printStats } from './geocoder.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'public/data')
const SOURCES_DIR = resolve(PROJECT_ROOT, '__sources')
const DEFAULT_INPUT = resolve(SOURCES_DIR, 'hatch_udb.json')
const DOWNLOAD_URL = 'https://raw.githubusercontent.com/richgel999/ufo_data/main/bin/hatch_udb.json'

// ─── Hatch-specific constants ───────────────────────────────────────

const Source = { HATCH_UDB: 'HATCH_UDB' }

// Year boundaries
const MODERN_YEAR_START = 1900     // Per-year chunking from here
const DECADE_CHUNK_START = 1800    // Per-decade chunking 1800–1899
const ANCIENT_CHUNK = 'ancient'    // Everything before 1800

const SUMMARY_MAX_LENGTH = 300
const DESCRIPTION_MAX_LENGTH = 1500

// ─── Hatch attribute code → Shape mapping ───────────────────────────

const ATTRIBUTE_SHAPE_MAP = {
  'SCR': Shape.DISK,        // Classic saucer/disk/sphere
  'CIG': Shape.CIGAR,       // Torpedo/cigar/cylinder
  'DLT': Shape.TRIANGLE,    // Delta/vee/boomerang/rectangular
  'NLT': Shape.LIGHT,       // Nightlights/points of light
  'FBL': Shape.FIREBALL,    // Fireball: blazing orb
  'SPH': Shape.SPHERE,      // Sphere
  'OVL': Shape.OVAL,        // Oval
  'EGG': Shape.EGG,         // Egg-shaped
  'CYL': Shape.CYLINDER,    // Cylinder
  'TRI': Shape.TRIANGLE,    // Triangle
  'CHV': Shape.CHEVRON,     // Chevron
  'DMD': Shape.DIAMOND,     // Diamond
  'RCT': Shape.RECTANGLE,   // Rectangle
  'CRS': Shape.CROSS,       // Cross
  'CON': Shape.CONE,        // Cone
  'STR': Shape.STAR,        // Star
  'FRM': Shape.FORMATION,   // Formation
  'CUB': Shape.CUBE,        // Cube
  'FLS': Shape.FLASH,       // Flash
  'ORB': Shape.ORB,         // Orb
  'CHG': Shape.CHANGING,    // Changing shape
  'TRD': Shape.TEARDROP    // Teardrop
}

// ─── Hatch attribute code → human-readable tag ──────────────────────

const ATTRIBUTE_TAG_MAP = {
  'GND': 'Ground observer',
  'AIR': 'Airborne observer',
  'SEA': 'Maritime observer',
  'MIL': 'Military observer',
  'CIV': 'Civilian observer',
  'HQO': 'High-quality observer',
  'PLT': 'Pilot observer',
  'RAD': 'Radar confirmed',
  'PHO': 'Photographic evidence',
  'VID': 'Video evidence',
  'WAV': 'Wave/cluster/flap',
  'EME': 'EM effects',
  'CEI': 'Close encounter I',
  'CEII': 'Close encounter II',
  'CEIII': 'Close encounter III',
  'CEIV': 'Close encounter IV',
  'FIG': 'Entity/figure observed',
  'OCC': 'Occupant(s) seen',
  'NOC': 'No occupant seen',
  'TCH': 'Technical details/clues',
  'HST': 'Historical account',
  'SND': 'Sound reported',
  'ABD': 'Abduction report',
  'MID': 'Possible misidentification',
  'NWS': 'News media report',
  'ODD': 'Fortean/paranormal',
  'ANI': 'Animal reaction',
  'INJ': 'Injury reported',
  'TRC': 'Physical traces',
  'MBR': 'Multiple observers'
}

// COUNTRY_CONTINENT imported from shared-constants.mjs

// ─── Audit trackers ─────────────────────────────────────────────────

const unmappedCountries = new Map()
const unmappedShapes = new Map()
const shapeCounts = new Map()
const countryCounts = new Map()
const attributeCounts = new Map()

// ─── Date parsing ───────────────────────────────────────────────────
// Hatch dates are wild: "5/21/70", "1/840?", "8/3/989", "3/927 (approximate)"
// We parse them into ISO strings for storage and extract the year for chunking.

/**
 * Parse a Hatch flexible date string into { iso, year, precision }.
 *
 * Input patterns:
 *   "M/D/YYYY"   → full date        precision = "day"
 *   "M/YYYY"     → month only       precision = "month"
 *   "M/D/YY"     → ambiguous 2-digit year (contextual)
 *   "M/YYYY?"    → uncertain        precision = "approximate"
 *   "M/YYYY (approximate)" → uncertain
 *
 * Hatch dates before year 100 are genuine ancient dates, NOT 19xx/20xx.
 */
function parseHatchDate(raw) {
  if (!raw) return null

  // Strip uncertainty markers
  const cleaned = raw
    .replace(/\s*\(approximate\)/i, '')
    .replace(/\?/g, '')
    .trim()

  if (!cleaned) return null

  const parts = cleaned.split('/')
  if (parts.length < 2 || parts.length > 3) return null

  let month, day, year, precision

  if (parts.length === 2) {
    // M/YYYY — month and year only
    month = parseInt(parts[0], 10)
    year = parseInt(parts[1], 10)
    day = 1
    precision = 'month'
  } else {
    // M/D/YYYY or M/D/YY
    month = parseInt(parts[0], 10)
    day = parseInt(parts[1], 10)
    year = parseInt(parts[2], 10)
    precision = 'day'
  }

  if (isNaN(month) || isNaN(year)) return null
  if (isNaN(day)) { day = 1; precision = 'month' }

  // Clamp month/day to valid ranges
  month = Math.max(1, Math.min(12, month))
  day = Math.max(1, Math.min(31, day))

  // Handle 2-digit years contextually:
  // Hatch data spans 70 AD to ~2002. Two-digit years ≤ 30 → 2000s, > 30 → 1900s
  // BUT if the original had markers suggesting ancient, we keep it low.
  // In practice, Hatch uses full 4-digit years for modern dates and
  // short years only for ancient dates. The alt_basic_date field helps disambiguate.
  // We treat 2-digit years: 0-99 as-is (ancient) since Hatch ancient dates are genuinely ancient.

  if (raw.includes('?') || raw.includes('approximate')) {
    precision = 'approximate'
  }

  // Build ISO string
  // For ancient dates (year < 100), use a reasonable ISO representation
  const yearStr = String(Math.abs(year)).padStart(4, '0')
  const monthStr = String(month).padStart(2, '0')
  const dayStr = String(day).padStart(2, '0')
  const iso = `${yearStr}-${monthStr}-${dayStr}T00:00:00`

  return { iso, year, precision }
}

/**
 * Use alt_basic_date to get a more reliable year when basic_date is ambiguous.
 * alt_basic_date format: "M/D/YYYY" with full 4-digit year always.
 */
function extractYearFromAlt(altDate) {
  if (!altDate) return null
  const parts = altDate.split('/')
  if (parts.length < 2) return null
  const last = parts[parts.length - 1]
  // Handle negative years (rare): "-1" prefix means estimated
  const yearStr = last.replace(/^-/, '')
  const year = parseInt(yearStr, 10)
  return isNaN(year) ? null : Math.abs(year)
}

// ─── Shape extraction from attributes ───────────────────────────────

function extractShape(attributes) {
  if (!Array.isArray(attributes)) return Shape.UNKNOWN

  for (const attr of attributes) {
    const code = attr.split(':')[0].trim()
    if (ATTRIBUTE_SHAPE_MAP[code]) return ATTRIBUTE_SHAPE_MAP[code]
  }

  return Shape.UNKNOWN
}

// ─── Tag extraction from attributes ─────────────────────────────────

function extractTags(attributes) {
  if (!Array.isArray(attributes)) return []
  const tags = []

  for (const attr of attributes) {
    const code = attr.split(':')[0].trim()
    const tag = ATTRIBUTE_TAG_MAP[code]
    if (tag) tags.push(tag)

    attributeCounts.set(code, (attributeCounts.get(code) || 0) + 1)
  }

  return tags
}

// ─── Characteristics from attributes ────────────────────────────────

function extractCharacteristics(attributes) {
  if (!Array.isArray(attributes)) return []
  // Use the full human-readable descriptions from the source
  return attributes.map(a => {
    const colonIdx = a.indexOf(':')
    return colonIdx > 0 ? a.slice(colonIdx + 1).trim() : a.trim()
  }).filter(Boolean)
}

// ─── Coordinate parsing ─────────────────────────────────────────────

function parseLatLong(latLongStr) {
  if (!latLongStr) return null
  const parts = latLongStr.trim().split(/\s+/)
  if (parts.length !== 2) return null

  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])

  if (isNaN(lat) || isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}

// ─── Year → chunk key mapping ───────────────────────────────────────

function yearToChunkKey(year) {
  if (year < DECADE_CHUNK_START) return ANCIENT_CHUNK
  if (year < MODERN_YEAR_START) {
    const decade = Math.floor(year / 10) * 10
    return `${decade}s`
  }
  return String(year)
}

// truncate() imported from shared-constants.mjs

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  let inputPath = process.argv[2] || DEFAULT_INPUT

  // Auto-download if requested or file doesn't exist
  if (inputPath === '--download' || !existsSync(inputPath)) {
    if (inputPath === '--download') inputPath = DEFAULT_INPUT
    mkdirSync(SOURCES_DIR, { recursive: true })
    console.log(`\n  Downloading Hatch UDB to __sources/...`)
    try {
      execSync(`curl -L -o "${inputPath}" "${DOWNLOAD_URL}"`, { stdio: 'inherit' })
    } catch {
      console.error(`\n  ✗ Download failed. Try manually:`)
      console.error(`  curl -L -o __sources/hatch_udb.json ${DOWNLOAD_URL}\n`)
      process.exit(1)
    }
  }

  if (!existsSync(inputPath)) {
    console.error(`\n  ✗ File not found: ${inputPath}`)
    console.error(`\n  Download it:`)
    console.error(`  curl -L -o __sources/hatch_udb.json ${DOWNLOAD_URL}\n`)
    process.exit(1)
  }

  console.log(`\n  Reading ${inputPath}...`)
  const raw = readFileSync(inputPath, 'utf-8')

  console.log('  Parsing JSON...')
  const data = JSON.parse(raw)

  // The JSON structure: { "Hatch_UDB_Timeline": [...] }
  const records = data.Hatch_UDB_Timeline || data
  if (!Array.isArray(records)) {
    console.error('  ✗ Expected array at Hatch_UDB_Timeline')
    process.exit(1)
  }

  console.log(`  Found ${records.length.toLocaleString()} records`)

  const byChunk = new Map()
  let skipped = 0
  let processed = 0

  for (const record of records) {
    // Skip non-sighting records
    if (record.type && record.type !== 'sighting') {
      skipped++
      continue
    }

    // Parse date — use alt_basic_date for reliable year
    const altYear = extractYearFromAlt(record.alt_basic_date)
    const parsed = parseHatchDate(record.date || record.basic_date)

    if (!parsed && !altYear) {
      skipped++
      continue
    }

    const year = altYear || parsed?.year || 0
    const iso = parsed?.iso || `${String(year).padStart(4, '0')}-01-01T00:00:00`
    const precision = parsed?.precision || 'year'

    // Location
    const country = record.key_vals?.Country || 'Unknown'
    const stateProv = record.key_vals?.State || record.key_vals?.['State/Prov'] || ''
    const locale = record.key_vals?.Locale || ''
    const location = record.location || ''

    // Continent
    let continent = COUNTRY_CONTINENT[country]
    if (!continent) {
      unmappedCountries.set(country, (unmappedCountries.get(country) || 0) + 1)
      continent = Continent.AMERICAS
    }
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1)

    // Coordinates: parse from LatLong, fallback to geocoder
    const coords = parseLatLong(record.key_vals?.LatLong) || resolveWithStats(locale, stateProv, country)

    // Shape from attributes
    const shape = extractShape(record.attributes)
    shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1)
    if (shape === Shape.UNKNOWN) {
      const attrCodes = (record.attributes || []).map(a => a.split(':')[0].trim()).join(',')
      unmappedShapes.set(attrCodes, (unmappedShapes.get(attrCodes) || 0) + 1)
    }

    // Tags and characteristics from attributes
    const tags = extractTags(record.attributes)
    const characteristics = extractCharacteristics(record.attributes)

    // Credibility & strangeness (Hatch: 1–10 scale → 0–100)
    const rawCredibility = parseInt(record.key_vals?.Credibility || '5', 10)
    const credibility = Math.min(100, Math.max(0, rawCredibility * 10))

    const rawStrangeness = parseInt(record.key_vals?.Strangeness || '0', 10)
    const strangeness = rawStrangeness > 0 ? Math.min(100, rawStrangeness * 10) : undefined

    // Duration (Hatch: minutes as string number)
    const rawDuration = record.key_vals?.Duration
    const duration = rawDuration && rawDuration !== '0'
      ? `${rawDuration} min`
      : ''

    // Region
    const region = stateProv && stateProv !== 'Unknown'
      ? `${location}, ${stateProv}`
      : location

    // Build description from desc + ref
    const desc = record.desc || ''
    const ref = record.ref || ''
    const description = ref ? `${desc}\n\nRef: ${ref}` : desc

    const sighting = {
      id: record.source_id || `hatch-${processed}`,
      source: Source.HATCH_UDB,
      occurredAt: iso,
      reportedAt: iso,
      postedAt: iso,
      location: location,
      shape,
      duration,
      observers: 0,
      summary: truncate(desc, SUMMARY_MAX_LENGTH),
      description: truncate(description, DESCRIPTION_MAX_LENGTH),
      characteristics,
      coordinates: coords,
      region,
      country,
      continent,
      status: Status.PENDING,
      credibility,
      // Extended fields
      tags,
      ...(strangeness !== undefined && { strangeness }),
      ...(ref && { ref: truncate(ref, 500) })
    }

    const chunkKey = yearToChunkKey(year)
    if (!byChunk.has(chunkKey)) byChunk.set(chunkKey, [])
    byChunk.get(chunkKey).push(sighting)
    processed++
  }

  // ─ Write chunks ─
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalRecords: processed,
    skippedRecords: skipped,
    years: {}
  }

  const sortedKeys = [...byChunk.keys()].sort((a, b) => {
    // Sort: ancient first, then decades, then years
    if (a === ANCIENT_CHUNK) return -1
    if (b === ANCIENT_CHUNK) return 1
    const aNum = parseInt(a, 10) || 0
    const bNum = parseInt(b, 10) || 0
    return aNum - bNum
  })

  for (const key of sortedKeys) {
    const sightings = byChunk.get(key)
    sightings.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

    const filename = `hatch-${key}.json`
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

  const manifestPath = resolve(OUTPUT_DIR, 'hatch-manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  // ─ Summary ─
  console.log(`\n  ✓ Processed ${processed.toLocaleString()} sightings (${skipped} skipped)`)
  console.log(`  ✓ ${sortedKeys.length} chunks written to public/data/`)
  console.log(`\n  Chunks: ${sortedKeys.join(', ')}`)

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
    console.log(`    ${country.padEnd(20)} ${count.toLocaleString()}`)
  }

  // Top attributes
  const topAttrs = [...attributeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  console.log(`\n  Top attribute codes:`)
  for (const [code, count] of topAttrs) {
    console.log(`    ${code.padEnd(6)} ${count.toLocaleString()}`)
  }

  // Unmapped
  if (unmappedCountries.size > 0) {
    const sorted = [...unmappedCountries.entries()].sort((a, b) => b[1] - a[1])
    console.log(`\n  ⚠ Unmapped countries (${unmappedCountries.size}):`)
    for (const [country, count] of sorted.slice(0, 15)) {
      console.log(`    ${country.padEnd(24)} ${count.toLocaleString()}`)
    }
  }

  const totalMB = Object.values(manifest.years).reduce((a, y) => a + y.sizeKB, 0) / 1024
  console.log(`\n  Total output: ${totalMB.toFixed(1)} MB`)
  console.log(`  Manifest: ${manifestPath}\n`)

  printStats('Hatch Geocoder')
}

main()
