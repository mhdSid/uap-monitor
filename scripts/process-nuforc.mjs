#!/usr/bin/env node

/**
 * process-nuforc.mjs
 *
 * Transforms the raw 191MB HuggingFace NUFORC JSON dump into
 * lightweight per-year chunks ready for the browser.
 *
 * Usage:
 *   node scripts/process-nuforc.mjs [path-to-nuforc.json]
 *
 * Output:
 *   public/data/nuforc-YYYY.json   — one file per year
 *   public/data/nuforc-manifest.json — index of all chunks with counts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'public/data')
const DEFAULT_INPUT = resolve(PROJECT_ROOT, 'nuforc.json')

// ─── NUFORC shape → our enum mapping ────────────────────────────────

const VALID_SHAPES = new Set([
  'Changing', 'Chevron', 'Cigar', 'Circle', 'Cone', 'Cross', 'Cube',
  'Cylinder', 'Diamond', 'Disk', 'Egg', 'Fireball', 'Flash', 'Formation',
  'Light', 'Orb', 'Other', 'Oval', 'Rectangle', 'Sphere', 'Star',
  'Teardrop', 'Triangle',
])

const SHAPE_ALIASES = {
  'Circular': 'Circle',
  'Round': 'Circle',
  'Disc': 'Disk',
  'Saucer': 'Disk',
  'Triangular': 'Triangle',
  'Cigar-shaped': 'Cigar',
  'Cylindrical': 'Cylinder',
  'Rectangular': 'Rectangle',
  'Egg-shaped': 'Egg',
  'Hexagon': 'Diamond',
  'Bullet/Missile': 'Cylinder',
  'Pellet': 'Sphere',
  'Crescent': 'Other',
  'Blimp': 'Cigar',
  'Dome': 'Circle',
  'Flare': 'Fireball',
  'N/A': 'Unknown',
  '': 'Unknown',
}

const VALID_CHARACTERISTICS = new Set([
  'Lights on object',
  'Aura or haze around object',
  'Aircraft nearby',
  'Animals reacted',
  'Left a trail',
  'Emitted other objects',
  'Changed Color',
  'Emitted beams',
  'Electrical or magnetic effects',
  'Possible abduction',
  'Missing Time',
  'Marks found on body afterwards',
  'Landed',
])

// ─── Country → continent mapping (top NUFORC countries) ─────────────

const COUNTRY_CONTINENT = {
  'USA': 'AMERICAS',
  'US': 'AMERICAS',
  'Canada': 'AMERICAS',
  'Mexico': 'AMERICAS',
  'Brazil': 'AMERICAS',
  'Argentina': 'AMERICAS',
  'Colombia': 'AMERICAS',
  'Chile': 'AMERICAS',
  'Peru': 'AMERICAS',
  'UK': 'EUROPE',
  'United Kingdom': 'EUROPE',
  'England': 'EUROPE',
  'Scotland': 'EUROPE',
  'Wales': 'EUROPE',
  'Ireland': 'EUROPE',
  'France': 'EUROPE',
  'Germany': 'EUROPE',
  'Spain': 'EUROPE',
  'Italy': 'EUROPE',
  'Netherlands': 'EUROPE',
  'Belgium': 'EUROPE',
  'Sweden': 'EUROPE',
  'Norway': 'EUROPE',
  'Denmark': 'EUROPE',
  'Finland': 'EUROPE',
  'Poland': 'EUROPE',
  'Portugal': 'EUROPE',
  'Greece': 'EUROPE',
  'Turkey': 'EUROPE',
  'Russia': 'EUROPE',
  'Ukraine': 'EUROPE',
  'Romania': 'EUROPE',
  'Czech Republic': 'EUROPE',
  'Austria': 'EUROPE',
  'Switzerland': 'EUROPE',
  'Japan': 'ASIA',
  'China': 'ASIA',
  'South Korea': 'ASIA',
  'India': 'ASIA',
  'Philippines': 'ASIA',
  'Thailand': 'ASIA',
  'Indonesia': 'ASIA',
  'Malaysia': 'ASIA',
  'Singapore': 'ASIA',
  'Taiwan': 'ASIA',
  'Pakistan': 'ASIA',
  'Israel': 'ASIA',
  'Saudi Arabia': 'ASIA',
  'UAE': 'ASIA',
  'Iran': 'ASIA',
  'Iraq': 'ASIA',
  'Australia': 'OCEANIA',
  'New Zealand': 'OCEANIA',
  'South Africa': 'AFRICA',
  'Nigeria': 'AFRICA',
  'Kenya': 'AFRICA',
  'Egypt': 'AFRICA',
}

// US states → full name for region field
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
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
}

const CA_PROVINCES = {
  'AB': 'Alberta', 'BC': 'British Columbia', 'MB': 'Manitoba',
  'NB': 'New Brunswick', 'NL': 'Newfoundland', 'NS': 'Nova Scotia',
  'NT': 'Northwest Territories', 'NU': 'Nunavut', 'ON': 'Ontario',
  'PE': 'Prince Edward Island', 'QC': 'Quebec', 'SK': 'Saskatchewan',
  'YT': 'Yukon',
}

// ─── Parsing helpers ─────────────────────────────────────────────────

function parseNufordDate(raw) {
  if (!raw) return null
  // "2011-01-13 20:05:00 Local" or "2011-01-12 18:36:28 Pacific"
  const match = raw.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/)
  if (!match) return null
  return match[1].replace(' ', 'T')
}

function parseLocation(raw) {
  if (!raw) return { city: '', state: '', country: 'Unknown', region: '', continent: 'AMERICAS' }

  const parts = raw.split(',').map(s => s.trim())

  let city = parts[0] || ''
  let state = ''
  let country = 'Unknown'
  let continent = 'AMERICAS'

  if (parts.length >= 3) {
    // "Basye, VA, USA" or "Toronto, ON, Canada"
    state = parts[1] || ''
    country = parts[2] || 'Unknown'
  } else if (parts.length === 2) {
    // Could be "City, STATE" (US implied) or "City, Country"
    const second = parts[1] || ''
    if (US_STATES[second]) {
      state = second
      country = 'USA'
    } else if (CA_PROVINCES[second]) {
      state = second
      country = 'Canada'
    } else {
      country = second
    }
  }

  // Normalize country
  if (country === 'United States' || country === 'US') country = 'USA'

  // Build region
  let region = city
  if (state && US_STATES[state]) {
    region = `${city}, ${state}`
    country = 'USA'
  } else if (state && CA_PROVINCES[state]) {
    region = `${city}, ${state}`
    country = 'Canada'
  } else if (state) {
    region = `${city}, ${state}`
  }

  // Resolve continent
  const continentLookup = COUNTRY_CONTINENT[country]
  if (continentLookup) {
    continent = continentLookup
  }

  return { city, state, country, region, continent }
}

function normalizeShape(raw) {
  if (!raw) return 'Unknown'
  const trimmed = raw.trim()
  if (VALID_SHAPES.has(trimmed)) return trimmed
  if (SHAPE_ALIASES[trimmed]) return SHAPE_ALIASES[trimmed]
  // Case-insensitive fallback
  for (const shape of VALID_SHAPES) {
    if (shape.toLowerCase() === trimmed.toLowerCase()) return shape
  }
  return 'Unknown'
}

function filterCharacteristics(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter(c => VALID_CHARACTERISTICS.has(c))
}

/**
 * Naive credibility score (0-100).
 * Factors: observer count, characteristics detail, duration specificity.
 * This is a placeholder until we build a proper scoring model.
 */
function computeCredibility(record) {
  let score = 30 // baseline

  // Multiple observers boost confidence
  const observers = record['No of observers'] || 0
  if (observers >= 4) score += 25
  else if (observers >= 2) score += 15
  else if (observers === 1) score += 5

  // Detailed characteristics = more credible report
  const chars = Array.isArray(record.Characteristics) ? record.Characteristics.length : 0
  score += Math.min(chars * 5, 20)

  // Duration specificity (has numbers = more precise)
  const duration = record.Duration || ''
  if (/\d/.test(duration)) score += 10

  // Summary length (longer = more detailed account)
  const summary = record.Summary || ''
  if (summary.length > 200) score += 10
  else if (summary.length > 50) score += 5

  return Math.min(score, 100)
}

function truncateSummary(text, maxLen = 200) {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…'
}

// ─── Main ────────────────────────────────────────────────────────────

function main() {
  const inputPath = process.argv[2] || DEFAULT_INPUT

  if (!existsSync(inputPath)) {
    console.error(`\n  ✗ File not found: ${inputPath}`)
    console.error(`\n  Download it first:`)
    console.error(`  curl -L -o nuforc.json https://huggingface.co/datasets/kcimc/NUFORC/resolve/main/nuforc.json\n`)
    process.exit(1)
  }

  console.log(`\n  Reading ${inputPath}...`)
  const raw = readFileSync(inputPath, 'utf-8')

  console.log('  Parsing JSON...')
  const records = JSON.parse(raw)
  console.log(`  Found ${records.length.toLocaleString()} records`)

  // Group by year
  const byYear = new Map()
  let skipped = 0
  let processed = 0
  const shapeCounts = new Map()
  const countryCounts = new Map()

  for (const record of records) {
    const occurredAt = parseNufordDate(record.Occurred)
    if (!occurredAt) {
      skipped++
      continue
    }

    const year = occurredAt.slice(0, 4)
    const yearNum = parseInt(year, 10)
    if (yearNum < 1950 || yearNum > 2030) {
      skipped++
      continue
    }

    const reportedAt = parseNufordDate(record.Reported) || occurredAt
    const postedAt = parseNufordDate(record.Posted) || reportedAt

    const loc = parseLocation(record.Location)
    const shape = normalizeShape(record.Shape)
    const characteristics = filterCharacteristics(record.Characteristics)
    const credibility = computeCredibility(record)

    // Track stats
    shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1)
    countryCounts.set(loc.country, (countryCounts.get(loc.country) || 0) + 1)

    const sighting = {
      id: String(record.Sighting || processed),
      source: 'NUFORC',
      occurredAt,
      reportedAt,
      postedAt,
      location: record.Location || '',
      shape,
      duration: record.Duration || '',
      observers: record['No of observers'] || 0,
      summary: truncateSummary(record.Summary),
      characteristics,
      coordinates: null,
      region: loc.region,
      country: loc.country,
      continent: loc.continent,
      status: 'PENDING',
      credibility,
    }

    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year).push(sighting)
    processed++
  }

  // Write chunks
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalRecords: processed,
    skippedRecords: skipped,
    years: {},
  }

  const sortedYears = [...byYear.keys()].sort()

  for (const year of sortedYears) {
    const sightings = byYear.get(year)
    // Sort by occurred date descending within each year
    sightings.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

    const filename = `nuforc-${year}.json`
    const filepath = resolve(OUTPUT_DIR, filename)
    writeFileSync(filepath, JSON.stringify(sightings))

    const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(sightings)) / 1024)
    manifest.years[year] = { count: sightings.length, file: filename, sizeKB }
  }

  // Write manifest
  const manifestPath = resolve(OUTPUT_DIR, 'nuforc-manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  // Print summary
  console.log(`\n  ✓ Processed ${processed.toLocaleString()} sightings (${skipped} skipped)`)
  console.log(`  ✓ ${sortedYears.length} year chunks written to public/data/`)
  console.log(`\n  Year range: ${sortedYears[0]} — ${sortedYears[sortedYears.length - 1]}`)

  // Top shapes
  const topShapes = [...shapeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  console.log(`\n  Top shapes:`)
  for (const [shape, count] of topShapes) {
    console.log(`    ${shape.padEnd(14)} ${count.toLocaleString()}`)
  }

  // Top countries
  const topCountries = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  console.log(`\n  Top countries:`)
  for (const [country, count] of topCountries) {
    console.log(`    ${country.padEnd(16)} ${count.toLocaleString()}`)
  }

  // Size report
  let totalSizeKB = 0
  console.log(`\n  Chunk sizes:`)
  for (const year of sortedYears.slice(-10)) {
    const info = manifest.years[year]
    console.log(`    ${year}: ${info.count.toLocaleString().padStart(6)} sightings  (${info.sizeKB} KB)`)
    totalSizeKB += info.sizeKB
  }
  console.log(`    ... and ${Math.max(0, sortedYears.length - 10)} earlier years`)

  const totalMB = Object.values(manifest.years).reduce((a, y) => a + y.sizeKB, 0) / 1024
  console.log(`\n  Total output: ${totalMB.toFixed(1)} MB (from ${(Buffer.byteLength(raw) / 1024 / 1024).toFixed(0)} MB input)`)
  console.log(`  Manifest: ${manifestPath}\n`)
}

main()
