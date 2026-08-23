#!/usr/bin/env node

/**
 * geo-audit.mjs
 *
 * Coverage gate for country → region resolution.
 *
 * Streams a source file, runs every country token through the same tiered
 * resolver the pipeline uses, and reports what resolved through which tier.
 * Exits non-zero when unresolved tokens exceed --max-unresolved (default 0),
 * so a new spelling in the upstream data fails CI rather than silently landing
 * in the wrong region.
 *
 * Tokens are evaluated once per unique sighting id, because __sources may hold
 * duplicate copies of the same record and raw counts would otherwise be
 * inflated several-fold.
 *
 * Usage:
 *   node scripts/geo-audit.mjs
 *   node scripts/geo-audit.mjs __sources/nuforc.json --max-unresolved 25
 */

import { createReadStream } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/stream-array.js'
import { chain } from 'stream-chain'

import { splitLocation, createResolutionReport } from './geo-resolve.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const flagValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const inputPath = resolve(PROJECT_ROOT, args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--max-unresolved') || '__sources/nuforc.json')
const maxUnresolved = parseInt(flagValue('--max-unresolved', '0'), 10)

/** Country slot of a Location string, mirroring process-nuforc.parseLocation. */
function countryToken (raw) {
  const parts = splitLocation(raw)
  if (parts.length >= 3) return parts[2] || ''
  if (parts.length === 2) return parts[1] || ''
  return ''
}

console.log(`\n  Auditing ${inputPath}\n`)

const seen = new Set()
const report = createResolutionReport()

const pipeline = chain([createReadStream(inputPath), parser(), streamArray()])

pipeline.on('data', ({ value: record }) => {
  const id = String(record.Sighting ?? '')
  if (id && seen.has(id)) return
  if (id) seen.add(id)
  report.resolve(countryToken(record.Location))
})

pipeline.on('end', () => {
  report.print('Geo Audit')

  const failures = report.unresolvedCount
  console.log(`\n  ${seen.size.toLocaleString()} unique sightings audited`)

  if (failures > maxUnresolved) {
    console.error(`\n  ✗ FAIL: ${failures} unresolved sighting(s) exceeds --max-unresolved ${maxUnresolved}.`)
    console.error('    Add the token to COUNTRY_ALIASES / SUBDIVISIONS in scripts/geo-registry.mjs.')
    console.error('    Do not widen the fallback — there is deliberately no fallback.\n')
    process.exitCode = 1
  } else {
    console.log(`\n  ✓ PASS: ${failures} unresolved (limit ${maxUnresolved})\n`)
  }
})
