#!/usr/bin/env node

/**
 * process-geipan.mjs
 *
 * Reads the GEIPAN cases CSV (Base_de_données_des_cas.csv) and merges it with
 * a translated English XLSX (produced by translate.google.com Documents tab
 * from the FR XLSX exported by geipan-extract-fr.mjs). Emits per-year JSON
 * chunks matching the rest of the pipeline (process-hatch.mjs etc.).
 *
 * Two-step manual workflow:
 *   1. node scripts/geipan-extract-fr.mjs                       # FR XLSX out
 *   2. Upload __sources/geipan-fr.xlsx to https://translate.google.com →
 *      Documents → French → English. Save the result as
 *      __sources/geipan-en.xlsx.
 *   3. node scripts/process-geipan.mjs                          # this script
 *
 * Output:
 *   public/data/geipan-YYYY.json      — one file per year (or decade pre-1900)
 *   public/data/geipan-manifest.json  — index of all chunks with counts
 *
 * Usage:
 *   node scripts/process-geipan.mjs
 *   node scripts/process-geipan.mjs --limit 50                          # test
 *   node scripts/process-geipan.mjs --translated-xlsx <path-or-dir>     # custom EN file
 *   node scripts/process-geipan.mjs --csv <path>                        # custom FR CSV
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

import { Continent, Status, Shape } from './shared-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DEFAULT_CSV = resolve(ROOT, '__sources/geipan.csv')
const DEFAULT_TRANSLATED_XLSX = resolve(ROOT, '__sources/geipan-en.xlsx')
const OUT_DIR = resolve(ROOT, process.env.UAP_OUTPUT_DIR || 'public/data')

const TRANSLATION_VERSION = 'geipan-fr2en-gtrans-v1'

const SOURCE = 'GEIPAN'
const DECADE_CHUNK_START = 1800
const MODERN_YEAR_START = 1900
const ANCIENT_CHUNK = 'ancient'

// GEIPAN classification meanings — surfaced as searchable tags.
const CLASSIFICATION_TAG = {
  A: 'Identified',
  B: 'Probably identified',
  C: 'Insufficient information',
  D: 'Unidentified',
  D1: 'Unidentified (single-witness)',
  D2: 'Unidentified (multi-witness)'
}

// ─── Header translations (35 columns) ──────────────────────────────

const HEADER_EN = {
  id_cas: 'id_case',
  cas_nom_dossier: 'case_file_name',
  cas_zone_nom: 'zone_name',
  cas_zone_code: 'zone_code',
  cas_zone_type: 'zone_type',
  cas_AAAA: 'year',
  cas_MM: 'month',
  cas_JJ: 'day',
  cas_resume: 'case_summary',
  cas_resume_web: 'case_summary_web',
  cas_public: 'is_public',
  cas_temoignages_nb: 'testimonies_count',
  cas_temoins_nb: 'witnesses_count',
  cas_temoins_nb_approx: 'witnesses_count_approx',
  cas_nb_PAN: 'uap_count',
  cas_nb_PAN_approx: 'uap_count_approx',
  cas_MinCercleInscrit_Lat: 'inscribed_circle_lat',
  cas_MinCercleInscrit_Lng: 'inscribed_circle_lng',
  cas_MinCercleInscrit_Err: 'inscribed_circle_err',
  cas_date_maj: 'updated_at',
  cas_etrangete: 'strangeness',
  cas_etrangete_err: 'strangeness_err',
  cas_etrangete_calc: 'strangeness_calc',
  cas_etrangete_calc_err: 'strangeness_calc_err',
  cas_fiabilite: 'reliability',
  cas_fiabilite_err: 'reliability_err',
  cas_fiabilite_calc: 'reliability_calc',
  cas_qte_information: 'info_quantity',
  cas_qte_information_calc: 'info_quantity_calc',
  cas_consistance: 'consistency',
  cas_consistance_calc: 'consistency_calc',
  cas_consistance_calc_err: 'consistency_calc_err',
  cas_classification: 'classification',
  cas_classification_calc: 'classification_calc',
  cas_numEtude: 'study_number'
}

// ─── French overseas departments → continent ─────────────────────────
// Default for metropolitan France: EUROPE. Overseas departments and
// collectivities are mapped explicitly so a sighting in Martinique
// (dept 972) lands in AMERICAS, not EUROPE.

const OVERSEAS_DEPT_CONTINENT = {
  971: Continent.AMERICAS, // Guadeloupe
  972: Continent.AMERICAS, // Martinique
  973: Continent.AMERICAS, // Guyane
  974: Continent.AFRICA,   // La Réunion
  975: Continent.AMERICAS, // Saint-Pierre-et-Miquelon
  976: Continent.AFRICA,   // Mayotte
  977: Continent.AMERICAS, // Saint-Barthélemy
  978: Continent.AMERICAS, // Saint-Martin
  984: Continent.AFRICA,   // Terres australes et antarctiques françaises
  986: Continent.OCEANIA,  // Wallis-et-Futuna
  987: Continent.OCEANIA,  // Polynésie française
  988: Continent.OCEANIA,  // Nouvelle-Calédonie
  989: Continent.OCEANIA   // Île de Clipperton
}

// ─── CSV parser ──────────────────────────────────────────────────────
// RFC-4180 with semicolon delimiter, CRLF or LF terminators, "" as
// escaped quote inside quoted fields. Quoted fields may contain
// delimiters and newlines.

function parseCSV (text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++
    } else {
      if (c === '"') { inQuotes = true; i++; continue }
      if (c === ';') { row.push(field); field = ''; i++; continue }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
      if (c === '\r') { i++; continue }
      field += c; i++
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ─── Translation lookup key ──────────────────────────────────────────
// Used to pair an FR cell (from the CSV) with its EN counterpart (from
// the translated XLSX). The XLSX is keyed by id_cas, so we walk the
// CSV row-by-row and build a Map<hash(fr_text), en_text>.

function cacheKey (text) {
  return createHash('sha256').update(TRANSLATION_VERSION + '|' + text).digest('hex').slice(0, 24)
}

// ─── Translated XLSX loader ──────────────────────────────────────────
// Reads one or more XLSX files produced by Google Translate Documents
// from `geipan-fr.xlsx` (see geipan-extract-fr.mjs). Returns a Map
// from id_cas → { cas_resume_en, cas_resume_web_en }.

function expandTranslatedPath (path) {
  // Accept either a file or a directory. If a directory, glob *.xlsx but
  // skip any file with "-fr" in the name (the FR source generated by
  // geipan-extract-fr.mjs would silently overwrite EN translations).
  if (!existsSync(path)) {
    throw new Error(`Translated XLSX path not found: ${path}`)
  }
  if (statSync(path).isDirectory()) {
    const all = readdirSync(path)
      .filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~'))
    const skipped = all.filter(f => /-fr(\b|[-.])/i.test(f))
    const kept = all.filter(f => !/-fr(\b|[-.])/i.test(f))
    if (skipped.length) {
      console.log(`  ↪ Skipping FR source files in dir: ${skipped.join(', ')}`)
    }
    return kept.sort().map(f => resolve(path, f))
  }
  return [path]
}

async function loadTranslatedXlsx (paths) {
  const byId = new Map()
  for (const path of paths) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(path)
    const ws = wb.worksheets[0]
    if (!ws) {
      console.warn(`  ⚠ No worksheet in ${path}`)
      continue
    }

    let rowsLoaded = 0
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return // header
      const rawId = row.getCell(1).value
      const id = (rawId === null || rawId === undefined) ? '' : String(rawId).trim()
      if (!id) return
      const cas_resume_en = String(row.getCell(2).value ?? '').trim()
      const cas_resume_web_en = String(row.getCell(3).value ?? '').trim()
      byId.set(id, { cas_resume_en, cas_resume_web_en })
      rowsLoaded++
    })
    console.log(`  ✓ ${path.split('/').pop()}: ${rowsLoaded} rows`)
  }
  return byId
}

// ─── Row → Sighting mapping ──────────────────────────────────────────

function parseYear (cas_AAAA, cas_MM, cas_JJ) {
  const y = parseInt(cas_AAAA, 10)
  if (isNaN(y) || y < 1 || y > 2100) return null
  const m = parseInt(cas_MM, 10)
  const d = parseInt(cas_JJ, 10)
  const month = (isNaN(m) || m < 1 || m > 12) ? 1 : m
  const day = (isNaN(d) || d < 1 || d > 31) ? 1 : d
  const iso = `${String(y).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`
  return { year: y, iso }
}

function parseCoord (raw) {
  if (!raw) return null
  const n = parseFloat(raw)
  if (isNaN(n)) return null
  return n
}

function pickContinent (zone_code) {
  const code = parseInt(zone_code, 10)
  if (isNaN(code)) return Continent.EUROPE
  return OVERSEAS_DEPT_CONTINENT[code] ?? Continent.EUROPE
}

function yearToChunkKey (year) {
  if (year < DECADE_CHUNK_START) return ANCIENT_CHUNK
  if (year < MODERN_YEAR_START) return `${Math.floor(year / 10) * 10}s`
  return String(year)
}

function buildSighting (row, headerIdx, translations) {
  const get = (name) => row[headerIdx[name]] ?? ''

  const id_cas = get('id_cas').trim()
  const parsed = parseYear(get('cas_AAAA'), get('cas_MM'), get('cas_JJ'))
  if (!parsed) return null

  const lat = parseCoord(get('cas_MinCercleInscrit_Lat'))
  const lng = parseCoord(get('cas_MinCercleInscrit_Lng'))
  const coordinates = (lat !== null && lng !== null) ? { lat, lng } : null

  const zone_name = get('cas_zone_nom').trim()
  const zone_code = get('cas_zone_code').trim()

  const resume_fr = get('cas_resume').trim()
  const resume_web_fr = get('cas_resume_web').trim()
  const summary_en = translations.get(cacheKey(resume_web_fr)) ?? ''
  const description_en = translations.get(cacheKey(resume_fr)) ?? ''

  const fiabilite = parseFloat(get('cas_fiabilite_calc') || get('cas_fiabilite') || '0')
  const credibility = isNaN(fiabilite) ? 0 : Math.round(fiabilite * 100)

  const etrangete = parseFloat(get('cas_etrangete_calc') || get('cas_etrangete') || '0')
  const strangeness = isNaN(etrangete) ? undefined : Math.round(etrangete * 100)

  const classification = (get('cas_classification_calc') || get('cas_classification')).trim()
  const witnesses = parseInt(get('cas_temoins_nb'), 10)
  const observers = isNaN(witnesses) ? 0 : witnesses

  const updatedRaw = get('cas_date_maj').trim()
  const postedAt = /^\d{4}-\d{2}-\d{2}/.test(updatedRaw) ? `${updatedRaw}T00:00:00` : parsed.iso

  const tags = []
  if (classification) {
    tags.push(`GEIPAN class ${classification}`)
    if (CLASSIFICATION_TAG[classification]) tags.push(CLASSIFICATION_TAG[classification])
  }

  return {
    id: `geipan-${id_cas}`,
    source: SOURCE,
    occurredAt: parsed.iso,
    reportedAt: parsed.iso,
    postedAt,
    location: zone_name || 'France',
    shape: Shape.UNKNOWN,
    duration: '',
    observers,
    summary: summary_en,
    description: description_en,
    characteristics: [],
    coordinates,
    region: zone_name,
    country: 'France',
    continent: pickContinent(zone_code),
    status: Status.PENDING,
    credibility,
    tags,
    ...(strangeness !== undefined && strangeness >= 0 && { strangeness }),
    ...(classification && { classification })
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────

function parseArgs (argv) {
  const args = { csv: DEFAULT_CSV, translatedXlsx: DEFAULT_TRANSLATED_XLSX, limit: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--csv') args.csv = resolve(argv[++i])
    else if (a === '--translated-xlsx') args.translatedXlsx = resolve(argv[++i])
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10)
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/process-geipan.mjs [options]

Options:
  --csv <path>             Path to GEIPAN CSV (default: ${DEFAULT_CSV})
  --translated-xlsx <p>    Path to translated XLSX file or directory
                           (default: ${DEFAULT_TRANSLATED_XLSX})
  --limit <n>              Only process first N data rows (for testing)
  --help, -h               Show this help

The translated XLSX comes from translate.google.com → Documents (upload the
FR XLSX produced by \`yarn process:data:pipeline:geipan:extract-fr\`).`)
      process.exit(0)
    }
  }
  return args
}

// ─── Main ────────────────────────────────────────────────────────────

async function main () {
  const args = parseArgs(process.argv)

  console.log(`  Reading ${args.csv}`)
  if (!existsSync(args.csv)) {
    console.error(`  ✗ File not found: ${args.csv}`)
    process.exit(1)
  }
  if (!existsSync(args.translatedXlsx)) {
    console.error(`  ✗ Translated XLSX not found: ${args.translatedXlsx}`)
    console.error(`\n  Workflow:`)
    console.error(`    1. yarn process:data:pipeline:geipan:extract-fr  # makes __sources/geipan-fr.xlsx`)
    console.error(`    2. Upload to translate.google.com → Documents → FR→EN`)
    console.error(`    3. Save the translated file as __sources/geipan-en.xlsx`)
    console.error(`    4. Re-run this script`)
    process.exit(1)
  }

  const text = readFileSync(args.csv, 'utf-8')
  const rows = parseCSV(text)
  const header = rows[0]
  const dataRows = rows.slice(1).filter(r => r.length > 1)

  console.log(`  Header: ${header.length} columns`)
  console.log(`  Data:   ${dataRows.length} rows${args.limit ? ` (taking first ${args.limit})` : ''}`)

  const headerIdx = Object.fromEntries(header.map((h, i) => [h, i]))
  const unknownCols = header.filter(h => !HEADER_EN[h])
  if (unknownCols.length) {
    console.warn(`  ⚠ Columns without EN mapping: ${unknownCols.join(', ')}`)
  }

  const sampled = args.limit ? dataRows.slice(0, args.limit) : dataRows

  // Load translated XLSX and map id_cas → { cas_resume_en, cas_resume_web_en }
  console.log(`\n  Loading translations from XLSX: ${args.translatedXlsx}`)
  const paths = expandTranslatedPath(args.translatedXlsx)
  if (paths.length === 0) {
    console.error(`  ✗ No .xlsx files found at ${args.translatedXlsx}`)
    process.exit(1)
  }
  const byId = await loadTranslatedXlsx(paths)
  console.log(`  Loaded ${byId.size} translation rows total`)

  // Build translations Map<hash(fr), en> so buildSighting can look up by FR text
  const translations = new Map()
  let missing = 0
  for (const row of sampled) {
    const id_cas = (row[headerIdx.id_cas] ?? '').trim()
    const fr_resume = (row[headerIdx.cas_resume] ?? '').trim()
    const fr_web = (row[headerIdx.cas_resume_web] ?? '').trim()
    const tr = byId.get(id_cas)
    if (!tr) {
      if (fr_resume || fr_web) missing++
      continue
    }
    if (fr_resume) translations.set(cacheKey(fr_resume), tr.cas_resume_en)
    if (fr_web) translations.set(cacheKey(fr_web), tr.cas_resume_web_en)
  }
  console.log(`  Mapped ${translations.size} translations to source rows${missing ? ` (${missing} cases missing from XLSX)` : ''}`)

  // Map rows → sightings → chunks
  const byChunk = new Map()
  let skipped = 0
  for (const row of sampled) {
    const s = buildSighting(row, headerIdx, translations)
    if (!s) { skipped++; continue }
    const year = parseInt(s.occurredAt.slice(0, 4), 10)
    const key = yearToChunkKey(year)
    if (!byChunk.has(key)) byChunk.set(key, [])
    byChunk.get(key).push(s)
  }

  // Write chunks
  mkdirSync(OUT_DIR, { recursive: true })
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    sourceLabel: "GEIPAN — Groupe d'Études des Phénomènes Aérospatiaux Non identifiés (CNES)",
    sourceUrl: 'https://geipan.fr',
    headerTranslations: HEADER_EN,
    totalRecords: 0,
    skippedRecords: skipped,
    years: {}
  }

  const sortedKeys = [...byChunk.keys()].sort((a, b) => {
    if (a === ANCIENT_CHUNK) return -1
    if (b === ANCIENT_CHUNK) return 1
    return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0)
  })

  let total = 0
  for (const key of sortedKeys) {
    const sightings = byChunk.get(key)
    sightings.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    const filename = `geipan-${key}.json`
    const filepath = resolve(OUT_DIR, filename)
    const json = JSON.stringify(sightings)
    writeFileSync(filepath, json)
    const sizeKB = Math.round(Buffer.byteLength(json) / 1024)
    const entry = { count: sightings.length, file: filename, sizeKB }
    if (key === ANCIENT_CHUNK || key.endsWith('s')) {
      const years = [...new Set(sightings.map(s => parseInt(s.occurredAt.split('-')[0], 10)).filter(Boolean))].sort((a, b) => a - b)
      entry.years = years
    }
    manifest.years[key] = entry
    total += sightings.length
  }
  manifest.totalRecords = total

  const manifestPath = resolve(OUT_DIR, 'geipan-manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`\n  ✓ Wrote ${sortedKeys.length} chunks (${total.toLocaleString()} sightings, ${skipped} skipped)`)
  console.log(`  ✓ Manifest: ${manifestPath}`)
  const totalMB = Object.values(manifest.years).reduce((a, y) => a + y.sizeKB, 0) / 1024
  console.log(`  ✓ Total output: ${totalMB.toFixed(1)} MB`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
