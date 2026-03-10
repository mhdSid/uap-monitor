#!/usr/bin/env node

/**
 * NASA Fireball/Bolide Fetcher
 *
 * Fetches all fireball events from NASA JPL's CNEOS Fireball API.
 * Transforms column-oriented response into normalized JSON.
 *
 * API: https://ssd-api.jpl.nasa.gov/fireball.api
 * No auth required. ~900 events since 1988.
 *
 * Usage:
 *   node scripts/nasa-fireball/fetch.mjs --out public/data/nasa-fireballs.json
 */

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { mergeArticles } from '../shared-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const SOURCE_FILE = resolve(PROJECT_ROOT, '__sources', 'nasa-fireballs.json')

// ─── CLI args ───────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const opts = { out: '' }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') opts.out = args[++i] || ''
  }
  if (!opts.out) {
    console.error('Usage: node scripts/nasa-fireball/fetch.mjs --out <path>')
    process.exit(1)
  }
  return opts
}

// ─── API fetch ──────────────────────────────────────────────────────

const API_URL = 'https://ssd-api.jpl.nasa.gov/fireball.api?req-loc=true&vel-comp=true'

async function fetchFireballs () {
  console.log('Fetching from NASA Fireball API...')
  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`API returned ${res.status}: ${res.statusText}`)
  return res.json()
}

// ─── Transform ──────────────────────────────────────────────────────

function parseCoord (value, dir) {
  if (value == null || dir == null) return null
  const num = parseFloat(value)
  if (isNaN(num)) return null
  return (dir === 'S' || dir === 'W') ? -num : num
}

function parseDate (dateStr) {
  if (!dateStr) return null
  // "2015-10-13 12:23:08" → "2015-10-13T12:23:08Z"
  return dateStr.replace(' ', 'T') + 'Z'
}

function generateId (date, lat, lng) {
  const raw = `fireball-${date}-${lat}-${lng}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 12)
}

function transformRow (fields, row) {
  const get = (name) => {
    const idx = fields.indexOf(name)
    return idx >= 0 ? row[idx] : null
  }

  const date = parseDate(get('date'))
  const lat = parseCoord(get('lat'), get('lat-dir'))
  const lng = parseCoord(get('lon'), get('lon-dir'))
  const alt = get('alt') != null ? parseFloat(get('alt')) : null
  const vel = get('vel') != null ? parseFloat(get('vel')) : null
  const energy = get('energy') != null ? parseFloat(get('energy')) : null
  const impactEnergy = get('impact-e') != null ? parseFloat(get('impact-e')) : null

  if (!date) return null

  return {
    id: generateId(date, lat, lng),
    date,
    lat,
    lng,
    altitude: alt,
    velocity: vel,
    energy,
    impactEnergy,
    source: 'NASA_CNEOS'
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main () {
  const opts = parseArgs()
  const raw = await fetchFireballs()

  if (!raw.data || !raw.fields) {
    console.log('No data returned from API')
    process.exit(1)
  }

  console.log(`API returned ${raw.count} records`)

  const fireballs = []
  for (const row of raw.data) {
    const fb = transformRow(raw.fields, row)
    if (fb) fireballs.push(fb)
  }

  const withCoords = fireballs.filter(f => f.lat != null && f.lng != null)
  console.log(`Transformed: ${fireballs.length} total, ${withCoords.length} with coordinates`)

  // Merge with existing source file

  mkdirSync(dirname(SOURCE_FILE), { recursive: true })

  const { merged } = mergeArticles(SOURCE_FILE, fireballs, {
    arrayField: 'fireballs',
    urlField: 'id',
    dateField: 'date'
  })

  const mergedWithCoords = merged.filter(f => f.lat != null && f.lng != null)

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'NASA/JPL CNEOS Fireball Data API',
    totalResults: merged.length,
    withCoordinates: mergedWithCoords.length,
    fireballs: merged
  }

  const json = JSON.stringify(output, null, 2)

  // Write source of truth
  writeFileSync(SOURCE_FILE, json, 'utf-8')
  console.log(`Wrote ${merged.length} fireballs -> ${SOURCE_FILE}`)

  // Copy to public/data
  mkdirSync(dirname(opts.out), { recursive: true })
  copyFileSync(SOURCE_FILE, opts.out)
  console.log(`Copied -> ${opts.out}`)
}

main().catch(err => { console.error('Fireball fetch failed:', err.message); process.exit(1) })
