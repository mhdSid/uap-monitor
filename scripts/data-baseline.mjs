#!/usr/bin/env node

/**
 * data-baseline.mjs
 *
 * Regression oracle for the data pipeline.
 *
 * `snapshot` records a content hash + record count for every file in an output
 * directory (default public/data). `compare` re-hashes that directory and
 * reports exactly which files changed, were added, or disappeared, plus the
 * net movement in record counts.
 *
 * The point is to make "no regressions" provable rather than asserted: take a
 * snapshot before touching the pipeline, re-run the pipeline, then compare and
 * account for every single delta before shipping.
 *
 * Usage:
 *   node scripts/data-baseline.mjs snapshot --out .baseline/before.json
 *   node scripts/data-baseline.mjs compare .baseline/before.json
 *   node scripts/data-baseline.mjs compare .baseline/before.json --dir /tmp/out
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DEFAULT_DIR = resolve(ROOT, 'public/data')

// ─── Snapshot ───────────────────────────────────────────────────────

/** Record count for a chunk file — array length, or a manifest's totalRecords. */
function countRecords (parsed) {
  if (Array.isArray(parsed)) return parsed.length
  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.totalRecords === 'number') return parsed.totalRecords
    for (const key of ['sightings', 'records', 'items', 'data', 'articles']) {
      if (Array.isArray(parsed[key])) return parsed[key].length
    }
  }
  return null
}

function snapshotDir (dir) {
  const files = {}
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (!statSync(full).isFile() || !name.endsWith('.json')) continue

    const raw = readFileSync(full)
    const entry = {
      bytes: raw.length,
      sha256: createHash('sha256').update(raw).digest('hex')
    }

    try {
      const parsed = JSON.parse(raw)
      entry.records = countRecords(parsed)
      // Manifests embed a wall-clock timestamp that changes every run and is
      // not a data difference — hash the body without it so compare stays honest.
      if (parsed && !Array.isArray(parsed) && parsed.generatedAt) {
        const rest = { ...parsed }
        delete rest.generatedAt
        entry.sha256Stable = createHash('sha256').update(JSON.stringify(rest)).digest('hex')
      }
    } catch {
      entry.records = null
    }

    files[name] = entry
  }
  return files
}

// ─── Compare ────────────────────────────────────────────────────────

function compare (baseline, current) {
  const names = [...new Set([...Object.keys(baseline.files), ...Object.keys(current)])].sort()
  const added = []
  const removed = []
  const changed = []
  let recordsBefore = 0
  let recordsAfter = 0

  for (const name of names) {
    const a = baseline.files[name]
    const b = current[name]

    if (a?.records) recordsBefore += a.records
    if (b?.records) recordsAfter += b.records

    if (!a) { added.push(name); continue }
    if (!b) { removed.push(name); continue }

    // A manifest whose only delta is generatedAt is unchanged in substance.
    const same = a.sha256Stable && b.sha256Stable
      ? a.sha256Stable === b.sha256Stable
      : a.sha256 === b.sha256
    if (!same) {
      changed.push({ name, recordsBefore: a.records, recordsAfter: b.records, bytesBefore: a.bytes, bytesAfter: b.bytes })
    }
  }

  return { added, removed, changed, recordsBefore, recordsAfter }
}

function fmt (n) { return typeof n === 'number' ? n.toLocaleString() : '—' }

// ─── Main ───────────────────────────────────────────────────────────

const [mode, ...rest] = process.argv.slice(2)
const argOf = (flag, fallback) => {
  const i = rest.indexOf(flag)
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback
}

if (mode === 'snapshot') {
  const dir = resolve(ROOT, argOf('--dir', DEFAULT_DIR))
  const out = resolve(ROOT, argOf('--out', '.baseline/before.json'))
  const files = snapshotDir(dir)
  const totalRecords = Object.values(files).reduce((n, f) => n + (f.records || 0), 0)

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify({ takenAt: new Date().toISOString(), dir, files }, null, 2))

  console.log(`\n  ✓ Baseline snapshot written to ${out}`)
  console.log(`    ${Object.keys(files).length} files, ${fmt(totalRecords)} records total\n`)
} else if (mode === 'compare') {
  const baselinePath = resolve(ROOT, rest[0] || '.baseline/before.json')
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const dir = resolve(ROOT, argOf('--dir', DEFAULT_DIR))
  const result = compare(baseline, snapshotDir(dir))

  console.log(`\n  Baseline : ${baselinePath} (${baseline.takenAt})`)
  console.log(`  Current  : ${dir}\n`)

  if (result.added.length) {
    console.log(`  + ${result.added.length} new file(s):`)
    for (const n of result.added.slice(0, 20)) console.log(`      ${n}`)
    if (result.added.length > 20) console.log(`      ... and ${result.added.length - 20} more`)
  }
  if (result.removed.length) {
    console.log(`  - ${result.removed.length} REMOVED file(s):`)
    for (const n of result.removed.slice(0, 20)) console.log(`      ${n}`)
    if (result.removed.length > 20) console.log(`      ... and ${result.removed.length - 20} more`)
  }
  if (result.changed.length) {
    console.log(`  ~ ${result.changed.length} changed file(s):`)
    for (const c of result.changed.slice(0, 30)) {
      const delta = (c.recordsAfter ?? 0) - (c.recordsBefore ?? 0)
      const sign = delta > 0 ? `+${fmt(delta)}` : delta < 0 ? fmt(delta) : '±0'
      console.log(`      ${c.name.padEnd(34)} records ${fmt(c.recordsBefore)} → ${fmt(c.recordsAfter)} (${sign})`)
    }
    if (result.changed.length > 30) console.log(`      ... and ${result.changed.length - 30} more`)
  }
  if (!result.added.length && !result.removed.length && !result.changed.length) {
    console.log('  ✓ No differences — output is byte-identical to baseline.')
  }

  const net = result.recordsAfter - result.recordsBefore
  console.log(`\n  Records: ${fmt(result.recordsBefore)} → ${fmt(result.recordsAfter)} (${net > 0 ? '+' : ''}${fmt(net)})\n`)

  if (result.removed.length) process.exitCode = 1
} else {
  console.error('Usage: node scripts/data-baseline.mjs <snapshot|compare> [args]')
  process.exitCode = 1
}
