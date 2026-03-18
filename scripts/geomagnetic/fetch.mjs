#!/usr/bin/env node

/**
 * Geomagnetic Kp Index Fetcher
 *
 * Downloads definitive + nowcast Kp data from GFZ Potsdam (1932–present).
 * Parses the fixed-width ASCII format into a compact JSON dataset.
 *
 * Source: GFZ German Research Centre for Geosciences
 * URL:    https://kp.gfz.de/en/data
 * License: CC BY 4.0
 *
 * Output format:
 *   { generatedAt, totalDays, source, data: [{ date, kp: [k1..k8], ap: [a1..a8], apDaily }] }
 *
 * Each day has 8 Kp values (3-hour intervals: 00–03, 03–06, ..., 21–24 UTC)
 * and 8 corresponding ap values plus the daily Ap average.
 *
 * Usage:
 *   node scripts/geomagnetic/fetch.mjs --out public/data/geomagnetic-kp.json
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// ─── CLI ────────────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const opts = { out: '' }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') opts.out = args[++i] || ''
  }
  if (!opts.out) {
    console.error('Usage: node scripts/geomagnetic/fetch.mjs --out <path>')
    process.exit(1)
  }
  return opts
}

// ─── Constants ──────────────────────────────────────────────────────

const GFZ_URL = 'https://www-app3.gfz-potsdam.de/kp_index/Kp_ap_Ap_SN_F107_since_1932.txt'
const SOURCE_LABEL = 'GFZ Potsdam (CC BY 4.0)'
const MISSING_KP = -1.0
const MISSING_AP = -1
const KP_PER_DAY = 8

// ─── Fetch + Parse ──────────────────────────────────────────────────

async function fetchGFZData () {
  console.log('Fetching Kp data from GFZ Potsdam...')
  const res = await fetch(GFZ_URL)
  if (!res.ok) throw new Error(`GFZ returned ${res.status}: ${res.statusText}`)
  return res.text()
}

/**
 * Parse the GFZ Kp_ap_Ap_SN_F107_since_1932.txt format.
 *
 * Each line:
 *   YYYY MM DD days days_m Bsr dB Kp1 Kp2 Kp3 Kp4 Kp5 Kp6 Kp7 Kp8 ap1 ap2 ap3 ap4 ap5 ap6 ap7 ap8 Ap SN F10.7obs F10.7adj D
 *
 * Fields are blank-separated, fixed width.
 */
function parseGFZ (text) {
  const lines = text.split('\n')
  const data = []

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim().length === 0) continue

    const parts = line.trim().split(/\s+/)
    if (parts.length < 23) continue

    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)

    if (isNaN(year) || isNaN(month) || isNaN(day)) continue

    // Kp values: indices 7–14 (8 values)
    const kp = []
    let hasValidKp = false
    for (let i = 7; i < 7 + KP_PER_DAY; i++) {
      const val = parseFloat(parts[i])
      if (isNaN(val) || val <= MISSING_KP) {
        kp.push(null)
      } else {
        kp.push(+val.toFixed(1))
        hasValidKp = true
      }
    }

    if (!hasValidKp) continue

    // ap values: indices 15–22 (8 values)
    const ap = []
    for (let i = 15; i < 15 + KP_PER_DAY; i++) {
      const val = parseInt(parts[i], 10)
      ap.push(isNaN(val) || val <= MISSING_AP ? null : val)
    }

    // Daily Ap: index 23
    const apDaily = parseInt(parts[23], 10)

    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    data.push({
      date,
      kp,
      ap,
      apDaily: isNaN(apDaily) || apDaily <= MISSING_AP ? null : apDaily
    })
  }

  return data
}

// ─── Main ───────────────────────────────────────────────────────────

async function main () {
  const opts = parseArgs()

  const text = await fetchGFZData()
  const data = parseGFZ(text)

  console.log(`Parsed ${data.length} days of Kp data`)
  console.log(`Date range: ${data[0]?.date} → ${data[data.length - 1]?.date}`)

  // Compute storm stats
  let stormDays = 0
  for (const d of data) {
    const maxKp = Math.max(...d.kp.filter(v => v !== null))
    if (maxKp >= 5) stormDays++
  }
  console.log(`Storm days (Kp ≥ 5): ${stormDays}`)

  const output = {
    generatedAt: new Date().toISOString(),
    source: SOURCE_LABEL,
    totalDays: data.length,
    dateRange: {
      from: data[0]?.date,
      to: data[data.length - 1]?.date
    },
    data
  }

  mkdirSync(dirname(opts.out), { recursive: true })
  writeFileSync(opts.out, JSON.stringify(output), 'utf-8')

  const sizeKB = (Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(0)
  console.log(`Wrote ${sizeKB} KB → ${opts.out}`)
}

main().catch(err => {
  console.error('Fatal:', err.message || err)
  process.exit(1)
})
