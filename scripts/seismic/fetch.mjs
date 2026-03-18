#!/usr/bin/env node

/**
 * USGS Earthquake Fetcher — year-windowed output
 *
 * Downloads global earthquake data (M4.0+) from the USGS FDSN Event API.
 * Queries in yearly chunks to stay within API limits (20K results per request).
 *
 * Output: per-year files + manifest for windowed client loading.
 *   public/data/earthquakes/YYYY.json   → array of earthquakes for that year
 *   public/data/earthquakes-manifest.json → { years: { "YYYY": { count, file } } }
 *
 * The runtime use-seismic.ts loads only the years overlapping with the
 * current sighting range, keeping client downloads small.
 *
 * Source: USGS Earthquake Hazards Program
 * URL:    https://earthquake.usgs.gov/fdsnws/event/1/
 * License: Public domain (US Government)
 *
 * Usage:
 *   node scripts/seismic/fetch.mjs --out-dir public/data/earthquakes [--manifest public/data/earthquakes-manifest.json] [--start 1970] [--end 2026] [--min-mag 4.0]
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

// ─── CLI ────────────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const opts = {
    outDir: '',
    manifestOut: '',
    startYear: 1970,
    endYear: new Date().getFullYear(),
    minMag: 4.0
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out-dir') opts.outDir = args[++i] || ''
    if (args[i] === '--manifest') opts.manifestOut = args[++i] || ''
    if (args[i] === '--start') opts.startYear = parseInt(args[++i], 10) || 1970
    if (args[i] === '--end') opts.endYear = parseInt(args[++i], 10) || new Date().getFullYear()
    if (args[i] === '--min-mag') opts.minMag = parseFloat(args[++i]) || 4.0
  }
  if (!opts.outDir) {
    console.error('Usage: node scripts/seismic/fetch.mjs --out-dir <dir> [--manifest <path>] [--start 1970] [--end 2026] [--min-mag 4.0]')
    process.exit(1)
  }
  if (!opts.manifestOut) {
    opts.manifestOut = join(dirname(opts.outDir), 'earthquakes-manifest.json')
  }
  return opts
}

// ─── Constants ──────────────────────────────────────────────────────

const USGS_API = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
const SOURCE_LABEL = 'USGS Earthquake Hazards Program'
const MAX_PER_REQUEST = 20000
const DELAY_MS = 500

// ─── Fetch ──────────────────────────────────────────────────────────

async function fetchYear (year, minMag) {
  const starttime = `${year}-01-01`
  const endtime = `${year}-12-31`
  const url = `${USGS_API}?format=geojson&starttime=${starttime}&endtime=${endtime}&minmagnitude=${minMag}&limit=${MAX_PER_REQUEST}&orderby=time`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`USGS returned ${res.status} for year ${year}`)
  const data = await res.json()

  const features = data.features || []
  return features.map(f => {
    const p = f.properties
    const coords = f.geometry?.coordinates || []

    return {
      id: f.id || `usgs-${p.code || p.time}`,
      time: new Date(p.time).toISOString(),
      lat: coords[1] ?? null,
      lng: coords[0] ?? null,
      depth: coords[2] ?? null,
      magnitude: p.mag ?? null,
      magType: p.magType || null,
      place: p.place || null
    }
  })
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function sizeMB (bytes) {
  return (bytes / (1024 * 1024)).toFixed(1)
}

// ─── Merge with existing year file ──────────────────────────────────

function mergeYearFile (filepath, newQuakes) {
  if (!existsSync(filepath)) return newQuakes

  try {
    const existing = JSON.parse(readFileSync(filepath, 'utf-8'))
    if (!Array.isArray(existing)) return newQuakes

    const seen = new Set(existing.map(q => q.id))
    const additions = newQuakes.filter(q => !seen.has(q.id))
    const merged = [...existing, ...additions]
    merged.sort((a, b) => b.time.localeCompare(a.time))
    return merged
  } catch {
    return newQuakes
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main () {
  const opts = parseArgs()

  mkdirSync(opts.outDir, { recursive: true })

  console.log(`Fetching USGS earthquakes M${opts.minMag}+ from ${opts.startYear} to ${opts.endYear}...`)
  console.log(`Output dir: ${opts.outDir}`)
  console.log(`Manifest:   ${opts.manifestOut}\n`)

  const years = {}
  let totalQuakes = 0

  for (let year = opts.startYear; year <= opts.endYear; year++) {
    try {
      const quakes = await fetchYear(year, opts.minMag)

      // Deduplicate within year
      const seen = new Set()
      const deduped = []
      for (const q of quakes) {
        if (!seen.has(q.id)) {
          seen.add(q.id)
          deduped.push(q)
        }
      }

      // Sort newest first
      deduped.sort((a, b) => b.time.localeCompare(a.time))

      // Merge with existing year file (incremental updates)
      const yearFile = join(opts.outDir, `${year}.json`)
      const merged = mergeYearFile(yearFile, deduped)

      // Write year file
      const json = JSON.stringify(merged)
      writeFileSync(yearFile, json, 'utf-8')

      const bytes = Buffer.byteLength(json, 'utf-8')
      console.log(`  ${year}: ${merged.length} earthquakes (${sizeMB(bytes)} MB)`)

      years[String(year)] = {
        count: merged.length,
        file: `earthquakes/${year}.json`
      }

      totalQuakes += merged.length
    } catch (err) {
      console.warn(`  ${year}: FAILED — ${err.message}`)
    }

    if (year < opts.endYear) await sleep(DELAY_MS)
  }

  // Write manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: SOURCE_LABEL,
    totalRecords: totalQuakes,
    minMagnitude: opts.minMag,
    dateRange: {
      from: `${opts.startYear}-01-01`,
      to: `${opts.endYear}-12-31`
    },
    years
  }

  mkdirSync(dirname(opts.manifestOut), { recursive: true })
  writeFileSync(opts.manifestOut, JSON.stringify(manifest), 'utf-8')

  console.log(`\nTotal: ${totalQuakes} earthquakes across ${Object.keys(years).length} years`)
  console.log(`Manifest: ${opts.manifestOut}`)
}

main().catch(err => {
  console.error('Fatal:', err.message || err)
  process.exit(1)
})
