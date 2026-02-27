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

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'public/data')
const DEFAULT_INPUT = resolve(PROJECT_ROOT, 'hatch_udb.json')
const DOWNLOAD_URL = 'https://raw.githubusercontent.com/richgel999/ufo_data/main/bin/hatch_udb.json'

// ─── Named constants ────────────────────────────────────────────────

const Continent = {
  AMERICAS: 'AMERICAS',
  EUROPE: 'EUROPE',
  EURASIA: 'EURASIA',
  ASIA_MIDDLE_EAST: 'ASIA_MIDDLE_EAST',
  ASIA_PACIFIC: 'ASIA_PACIFIC',
  OCEANIA: 'OCEANIA',
  AFRICA: 'AFRICA',
}

const Status = { PENDING: 'PENDING' }
const Source = { HATCH_UDB: 'HATCH_UDB' }

const Shape = {
  UNKNOWN: 'Unknown',
  CHANGING: 'Changing',
  CHEVRON: 'Chevron',
  CIGAR: 'Cigar',
  CIRCLE: 'Circle',
  CONE: 'Cone',
  CROSS: 'Cross',
  CUBE: 'Cube',
  CYLINDER: 'Cylinder',
  DIAMOND: 'Diamond',
  DISK: 'Disk',
  EGG: 'Egg',
  FIREBALL: 'Fireball',
  FLASH: 'Flash',
  FORMATION: 'Formation',
  LIGHT: 'Light',
  ORB: 'Orb',
  OTHER: 'Other',
  OVAL: 'Oval',
  RECTANGLE: 'Rectangle',
  SPHERE: 'Sphere',
  STAR: 'Star',
  TEARDROP: 'Teardrop',
  TRIANGLE: 'Triangle',
}

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
  'TRD': Shape.TEARDROP,    // Teardrop
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
  'MBR': 'Multiple observers',
}

// ─── Country → Continent (covers Hatch historical names) ────────────

const COUNTRY_CONTINENT = {
  'USA': Continent.AMERICAS, 'US': Continent.AMERICAS, 'United States': Continent.AMERICAS,
  'Canada': Continent.AMERICAS, 'Mexico': Continent.AMERICAS, 'Brazil': Continent.AMERICAS,
  'Argentina': Continent.AMERICAS, 'Colombia': Continent.AMERICAS, 'Chile': Continent.AMERICAS,
  'Peru': Continent.AMERICAS, 'Venezuela': Continent.AMERICAS, 'Ecuador': Continent.AMERICAS,
  'Bolivia': Continent.AMERICAS, 'Paraguay': Continent.AMERICAS, 'Uruguay': Continent.AMERICAS,
  'Cuba': Continent.AMERICAS, 'Jamaica': Continent.AMERICAS, 'Puerto Rico': Continent.AMERICAS,
  'Guatemala': Continent.AMERICAS, 'Honduras': Continent.AMERICAS, 'El Salvador': Continent.AMERICAS,
  'Nicaragua': Continent.AMERICAS, 'Costa Rica': Continent.AMERICAS, 'Panama': Continent.AMERICAS,
  'Trinidad and Tobago': Continent.AMERICAS, 'Bahamas': Continent.AMERICAS, 'Bermuda': Continent.AMERICAS,
  'Dominican Republic': Continent.AMERICAS, 'Haiti': Continent.AMERICAS, 'Belize': Continent.AMERICAS,
  'Guyana': Continent.AMERICAS, 'Suriname': Continent.AMERICAS, 'Barbados': Continent.AMERICAS,

  'UK': Continent.EUROPE, 'United Kingdom': Continent.EUROPE, 'England': Continent.EUROPE,
  'Scotland': Continent.EUROPE, 'Wales': Continent.EUROPE, 'Ireland': Continent.EUROPE,
  'France': Continent.EUROPE, 'Germany': Continent.EUROPE, 'Spain': Continent.EUROPE,
  'Italy': Continent.EUROPE, 'Netherlands': Continent.EUROPE, 'Belgium': Continent.EUROPE,
  'Sweden': Continent.EUROPE, 'Norway': Continent.EUROPE, 'Denmark': Continent.EUROPE,
  'Finland': Continent.EUROPE, 'Poland': Continent.EUROPE, 'Portugal': Continent.EUROPE,
  'Greece': Continent.EUROPE, 'Turkey': Continent.EUROPE, 'Ukraine': Continent.EUROPE,
  'Romania': Continent.EUROPE, 'Czech Republic': Continent.EUROPE, 'Austria': Continent.EUROPE,
  'Switzerland': Continent.EUROPE, 'Hungary': Continent.EUROPE, 'Bulgaria': Continent.EUROPE,
  'Croatia': Continent.EUROPE, 'Serbia': Continent.EUROPE, 'Slovakia': Continent.EUROPE,
  'Slovenia': Continent.EUROPE, 'Iceland': Continent.EUROPE, 'Malta': Continent.EUROPE,
  'Cyprus': Continent.EUROPE, 'Albania': Continent.EUROPE, 'Latvia': Continent.EUROPE,
  'Lithuania': Continent.EUROPE, 'Estonia': Continent.EUROPE, 'Luxembourg': Continent.EUROPE,
  'Moldova': Continent.EUROPE, 'Belarus': Continent.EUROPE, 'Georgia': Continent.EUROPE,
  'Armenia': Continent.EUROPE, 'Azerbaijan': Continent.EUROPE,
  'West Germany': Continent.EUROPE, 'East Germany': Continent.EUROPE,
  'Yugoslavia': Continent.EUROPE, 'Czechoslovakia': Continent.EUROPE,
  'Prussia': Continent.EUROPE, 'Sicily': Continent.EUROPE, 'Corsica': Continent.EUROPE,
  'Sardinia': Continent.EUROPE, 'Crete': Continent.EUROPE, 'Bohemia': Continent.EUROPE,
  'Montenegro': Continent.EUROPE, 'Kosovo': Continent.EUROPE,
  'Bosnia and Herzegovina': Continent.EUROPE, 'North Macedonia': Continent.EUROPE,

  'Russia': Continent.EURASIA, 'Russian Federation': Continent.EURASIA,
  'Soviet Union': Continent.EURASIA, 'USSR': Continent.EURASIA,

  'India': Continent.ASIA_MIDDLE_EAST, 'Pakistan': Continent.ASIA_MIDDLE_EAST,
  'Iran': Continent.ASIA_MIDDLE_EAST, 'Iraq': Continent.ASIA_MIDDLE_EAST,
  'Israel': Continent.ASIA_MIDDLE_EAST, 'Palestine': Continent.ASIA_MIDDLE_EAST,
  'Lebanon': Continent.ASIA_MIDDLE_EAST, 'Jordan': Continent.ASIA_MIDDLE_EAST,
  'Syria': Continent.ASIA_MIDDLE_EAST, 'Saudi Arabia': Continent.ASIA_MIDDLE_EAST,
  'UAE': Continent.ASIA_MIDDLE_EAST, 'Kuwait': Continent.ASIA_MIDDLE_EAST,
  'Qatar': Continent.ASIA_MIDDLE_EAST, 'Bahrain': Continent.ASIA_MIDDLE_EAST,
  'Oman': Continent.ASIA_MIDDLE_EAST, 'Yemen': Continent.ASIA_MIDDLE_EAST,
  'Afghanistan': Continent.ASIA_MIDDLE_EAST, 'Bangladesh': Continent.ASIA_MIDDLE_EAST,
  'Sri Lanka': Continent.ASIA_MIDDLE_EAST, 'Nepal': Continent.ASIA_MIDDLE_EAST,
  'Kazakhstan': Continent.ASIA_MIDDLE_EAST, 'Uzbekistan': Continent.ASIA_MIDDLE_EAST,
  'Persia': Continent.ASIA_MIDDLE_EAST, 'Mesopotamia': Continent.ASIA_MIDDLE_EAST,
  'Ottoman Empire': Continent.ASIA_MIDDLE_EAST, 'Trans-Jordan': Continent.ASIA_MIDDLE_EAST,
  'Ceylon': Continent.ASIA_MIDDLE_EAST, 'Mongolia': Continent.ASIA_MIDDLE_EAST,

  'Japan': Continent.ASIA_PACIFIC, 'China': Continent.ASIA_PACIFIC,
  'South Korea': Continent.ASIA_PACIFIC, 'North Korea': Continent.ASIA_PACIFIC,
  'Taiwan': Continent.ASIA_PACIFIC, 'Philippines': Continent.ASIA_PACIFIC,
  'Thailand': Continent.ASIA_PACIFIC, 'Vietnam': Continent.ASIA_PACIFIC,
  'Indonesia': Continent.ASIA_PACIFIC, 'Malaysia': Continent.ASIA_PACIFIC,
  'Singapore': Continent.ASIA_PACIFIC, 'Myanmar': Continent.ASIA_PACIFIC,
  'Cambodia': Continent.ASIA_PACIFIC, 'Laos': Continent.ASIA_PACIFIC,
  'Hong Kong': Continent.ASIA_PACIFIC, 'Macau': Continent.ASIA_PACIFIC,
  'Korea': Continent.ASIA_PACIFIC, 'Burma': Continent.ASIA_PACIFIC,
  'Siam': Continent.ASIA_PACIFIC, 'Formosa': Continent.ASIA_PACIFIC,
  'Indochina': Continent.ASIA_PACIFIC, 'Manchuria': Continent.ASIA_PACIFIC,

  'Australia': Continent.OCEANIA, 'New Zealand': Continent.OCEANIA,
  'Papua New Guinea': Continent.OCEANIA, 'Fiji': Continent.OCEANIA,
  'Guam': Continent.OCEANIA, 'Hawaii': Continent.OCEANIA,

  'South Africa': Continent.AFRICA, 'Nigeria': Continent.AFRICA, 'Egypt': Continent.AFRICA,
  'Kenya': Continent.AFRICA, 'Ethiopia': Continent.AFRICA, 'Ghana': Continent.AFRICA,
  'Algeria': Continent.AFRICA, 'Morocco': Continent.AFRICA, 'Tunisia': Continent.AFRICA,
  'Libya': Continent.AFRICA, 'Sudan': Continent.AFRICA, 'Zimbabwe': Continent.AFRICA,
  'Zambia': Continent.AFRICA, 'Angola': Continent.AFRICA, 'Madagascar': Continent.AFRICA,
  'Cameroon': Continent.AFRICA, 'Congo': Continent.AFRICA, 'Botswana': Continent.AFRICA,
  'Namibia': Continent.AFRICA, 'Mozambique': Continent.AFRICA, 'Tanzania': Continent.AFRICA,
  'Uganda': Continent.AFRICA, 'Senegal': Continent.AFRICA, 'Mali': Continent.AFRICA,
  'Rhodesia': Continent.AFRICA, 'Zaire': Continent.AFRICA, 'Tanganyika': Continent.AFRICA,
  'Abyssinia': Continent.AFRICA, 'Belgian Congo': Continent.AFRICA,
  'Reunion': Continent.AFRICA,

  'Unknown': Continent.AMERICAS,
  'At Sea': Continent.AMERICAS,
  'Atlantic Ocean': Continent.AMERICAS,
  'Pacific Ocean': Continent.OCEANIA,
}

// ─── Country → default coords (subset for Hatch fallback) ──────────

const COUNTRY_COORDS = {
  'USA': { lat: 38.895, lng: -77.036 }, 'Canada': { lat: 45.421, lng: -75.697 },
  'Mexico': { lat: 19.433, lng: -99.133 }, 'Brazil': { lat: -15.798, lng: -47.892 },
  'Argentina': { lat: -34.604, lng: -58.382 }, 'Colombia': { lat: 4.711, lng: -74.072 },
  'Chile': { lat: -33.449, lng: -70.669 }, 'Peru': { lat: -12.046, lng: -77.043 },
  'UK': { lat: 51.507, lng: -0.128 }, 'France': { lat: 48.857, lng: 2.352 },
  'Germany': { lat: 52.520, lng: 13.405 }, 'Spain': { lat: 40.417, lng: -3.704 },
  'Italy': { lat: 41.903, lng: 12.496 }, 'Netherlands': { lat: 52.368, lng: 4.904 },
  'Belgium': { lat: 50.850, lng: 4.352 }, 'Sweden': { lat: 59.329, lng: 18.069 },
  'Norway': { lat: 59.914, lng: 10.752 }, 'Denmark': { lat: 55.676, lng: 12.568 },
  'Finland': { lat: 60.170, lng: 24.938 }, 'Poland': { lat: 52.230, lng: 21.012 },
  'Portugal': { lat: 38.722, lng: -9.139 }, 'Greece': { lat: 37.984, lng: 23.728 },
  'Turkey': { lat: 39.933, lng: 32.860 }, 'Russia': { lat: 55.756, lng: 37.617 },
  'USSR': { lat: 55.756, lng: 37.617 }, 'Soviet Union': { lat: 55.756, lng: 37.617 },
  'India': { lat: 28.614, lng: 77.209 }, 'Iran': { lat: 35.689, lng: 51.389 },
  'Israel': { lat: 31.768, lng: 35.214 }, 'Palestine': { lat: 31.952, lng: 35.233 },
  'Japan': { lat: 35.676, lng: 139.650 }, 'China': { lat: 39.904, lng: 116.407 },
  'Australia': { lat: -35.281, lng: 149.130 }, 'New Zealand': { lat: -41.287, lng: 174.776 },
  'South Africa': { lat: -25.748, lng: 28.229 }, 'Egypt': { lat: 30.044, lng: 31.236 },
}

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

function truncate(text, maxLen) {
  if (!text) return ''
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen).replace(/\s+\S*$/, '') + '…'
}

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  let inputPath = process.argv[2] || DEFAULT_INPUT

  // Auto-download if requested or file doesn't exist
  if (inputPath === '--download' || !existsSync(inputPath)) {
    if (inputPath === '--download') inputPath = DEFAULT_INPUT
    console.log(`\n  Downloading Hatch UDB from GitHub...`)
    try {
      execSync(`curl -L -o "${inputPath}" "${DOWNLOAD_URL}"`, { stdio: 'inherit' })
    } catch {
      console.error(`\n  ✗ Download failed. Try manually:`)
      console.error(`  curl -L -o hatch_udb.json ${DOWNLOAD_URL}\n`)
      process.exit(1)
    }
  }

  if (!existsSync(inputPath)) {
    console.error(`\n  ✗ File not found: ${inputPath}`)
    console.error(`\n  Download it:`)
    console.error(`  curl -L -o hatch_udb.json ${DOWNLOAD_URL}\n`)
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

    // Coordinates: parse from LatLong, fallback to country default
    const coords = parseLatLong(record.key_vals?.LatLong) || COUNTRY_COORDS[country] || null

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
      ...(ref && { ref: truncate(ref, 500) }),
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
    years: {},
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
    manifest.years[key] = { count: sightings.length, file: filename, sizeKB }
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
}

main()
