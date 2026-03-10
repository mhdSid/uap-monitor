#!/usr/bin/env node

/**
 * Russian Historical UFO Sightings — Processing Script
 *
 * Reads curated sightings from __sources/russia.json and outputs
 * a normalized manifest to public/data/russian-historical.json.
 *
 * Uses geocoder for any records missing coordinates.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { resolveWithStats, printStats } from './geocoder.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT = resolve(ROOT, '__sources/russia.json')
const OUTPUT = resolve(ROOT, 'public/data/russian-historical.json')

const SOURCE = 'CHRONOLOGY'
const SUB_SOURCE = 'RUSSIAN_HISTORICAL'

function generateId (date, location) {
  return createHash('sha256')
    .update(`russian-${date}-${location}`)
    .digest('hex')
    .slice(0, 12)
}

function process () {
  const raw = JSON.parse(readFileSync(INPUT, 'utf-8'))
  console.log(`Read ${raw.length} sightings from __sources/russia.json`)

  const processed = raw.map(s => {
    // Use existing coordinates if provided, else geocode
    const coordinates = s.coordinates || resolveWithStats(s.location, s.region, s.country)

    return {
      id: generateId(s.occurredAt, s.location),
      source: SOURCE,
      subSource: SUB_SOURCE,
      ...s,
      coordinates,
      reportedAt: s.occurredAt,
      postedAt: new Date().toISOString(),
      continent: 'EURASIA',
      status: 'PENDING'
    }
  })

  const output = processed.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'Russian Historical UFO Sightings',
    subSource: SUB_SOURCE,
    totalRecords: output.length,
    dateRange: {
      oldest: output[output.length - 1].occurredAt.slice(0, 4),
      newest: output[0].occurredAt.slice(0, 4)
    },
    references: [
      'FBIS/CIA Declassified Document DOC_0005517761 (Nov 22, 1989)',
      'RusArtNet - UFOs in Russia (rusartnet.com)',
      'ThinkAboutItDocs - Russia UFO Sightings Archive',
      'Jerusalem Post - Russian nuclear plant UFO (Apr 2023)',
      'Philip Mantle - UFO Case Files of Russia (ISBN 9781907126031)',
      'CIA Reading Room - Soviet UFO reports',
      'Moscow Times - Official Soviet X-Files Investigation'
    ],
    sightings: output
  }

  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2), 'utf-8')

  console.log(`Generated: ${OUTPUT}`)
  console.log(`Records:   ${output.length}`)
  console.log(`Range:     ${manifest.dateRange.oldest} – ${manifest.dateRange.newest}`)
  console.log()
  console.log('Sightings by century:')

  const centuries = {}
  for (const s of output) {
    const c = Math.floor(parseInt(s.occurredAt.slice(0, 4)) / 100) * 100
    centuries[c] = (centuries[c] || 0) + 1
  }
  for (const [c, n] of Object.entries(centuries).sort()) {
    console.log(`  ${c}s: ${n}`)
  }

  printStats('Russian Historical Geocoder')
}

process()
