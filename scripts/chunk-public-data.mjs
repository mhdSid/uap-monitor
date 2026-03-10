#!/usr/bin/env node

/**
 * chunk-public-data — Split oversized JSON files for Cloudflare Workers (25 MB asset limit).
 *
 * Scans a directory for JSON files exceeding the size limit, splits them into
 * numbered chunks, and replaces the original with a lightweight index file.
 *
 * Supports two JSON shapes:
 *   1. Top-level array  → split array into chunk files
 *   2. Object with array field → extract + split the largest array field,
 *      preserve remaining fields as "envelope" metadata
 *
 * The runtime `fetchJson` in use-fetch.ts detects the `__chunked` index and
 * transparently reassembles — no loader changes needed.
 *
 * Usage:
 *   node scripts/chunk-public-data.mjs [--dir public/data] [--limit 24]
 *
 * Options:
 *   --dir     Directory to scan (default: public/data)
 *   --limit   Max file size in MB before chunking (default: 24)
 */

import { readdirSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'node:fs'
import { join, basename, extname } from 'node:path'

// ─── CLI args ───────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const opts = { dir: 'public/data', limit: 24 }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir')   opts.dir   = args[++i] || opts.dir
    if (args[i] === '--limit') opts.limit = parseFloat(args[++i]) || opts.limit
  }
  return opts
}

// ─── Helpers ────────────────────────────────────────────────────────

function sizeMB (bytes) {
  return (bytes / (1024 * 1024)).toFixed(2)
}

function removeExistingChunks (dir, stem) {
  const pattern = new RegExp(`^${escapeRegex(stem)}\\.chunk-\\d+\\.json$`)
  for (const f of readdirSync(dir)) {
    if (pattern.test(f)) {
      unlinkSync(join(dir, f))
    }
  }
}

function escapeRegex (str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find the largest array field in an object.
 */
function findLargestArrayField (obj) {
  let best = null
  let bestLen = 0
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val) && val.length > bestLen) {
      best = key
      bestLen = val.length
    }
  }
  return best
}

/**
 * Split an array into N roughly-equal parts where each serialized chunk
 * stays under the byte limit.
 */
function splitArray (arr, limitBytes) {
  // Estimate total size from array length proportionally
  const fullJson = JSON.stringify(arr)
  const totalBytes = Buffer.byteLength(fullJson, 'utf-8')
  const numChunks = Math.ceil(totalBytes / limitBytes)
  const chunkSize = Math.ceil(arr.length / numChunks)

  const chunks = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize))
  }
  return chunks
}

// ─── Main ───────────────────────────────────────────────────────────

function main () {
  const opts = parseArgs()
  const limitBytes = opts.limit * 1024 * 1024

  console.log(`Scanning ${opts.dir} (limit: ${opts.limit} MB)\n`)

  let files
  try {
    files = readdirSync(opts.dir).filter(f => extname(f) === '.json')
  } catch {
    console.log('Directory not found or empty — nothing to chunk.')
    return
  }

  let chunked = 0

  for (const file of files) {
    const filepath = join(opts.dir, file)
    const stat = statSync(filepath)
    const stem = basename(file, '.json')

    // Skip existing chunk files and index files
    if (stem.includes('.chunk-')) continue

    if (stat.size <= limitBytes) {
      // Also check if this is a stale chunked index — clean up orphaned chunks
      try {
        const data = JSON.parse(readFileSync(filepath, 'utf-8'))
        if (data && data.__chunked) {
          console.log(`  ⚠ ${file} is a stale chunk index (${sizeMB(stat.size)} MB) — skipping`)
        }
      } catch { /* not JSON, skip */ }
      continue
    }

    console.log(`  ✂ ${file} — ${sizeMB(stat.size)} MB (over ${opts.limit} MB limit)`)

    const raw = readFileSync(filepath, 'utf-8')
    let data
    try {
      data = JSON.parse(raw)
    } catch (err) {
      console.log(`    ⚠ Invalid JSON — skipping`)
      continue
    }

    // Remove any previous chunk files for this stem
    removeExistingChunks(opts.dir, stem)

    let index

    if (Array.isArray(data)) {
      // ── Shape 1: top-level array ──────────────────────────────
      const chunks = splitArray(data, limitBytes)
      const chunkFiles = []

      for (let i = 0; i < chunks.length; i++) {
        const chunkFile = `${stem}.chunk-${i}.json`
        const chunkPath = join(opts.dir, chunkFile)
        const json = JSON.stringify(chunks[i])
        writeFileSync(chunkPath, json, 'utf-8')
        const bytes = Buffer.byteLength(json, 'utf-8')
        console.log(`    → ${chunkFile} (${chunks[i].length} items, ${sizeMB(bytes)} MB)`)
        chunkFiles.push(chunkFile)
      }

      index = {
        __chunked: true,
        totalItems: data.length,
        files: chunkFiles
      }
    } else if (typeof data === 'object' && data !== null) {
      // ── Shape 2: object with array field ──────────────────────
      const field = findLargestArrayField(data)
      if (!field) {
        console.log(`    ⚠ No array field found — skipping`)
        continue
      }

      const arr = data[field]
      const chunks = splitArray(arr, limitBytes)
      const chunkFiles = []

      for (let i = 0; i < chunks.length; i++) {
        const chunkFile = `${stem}.chunk-${i}.json`
        const chunkPath = join(opts.dir, chunkFile)
        const json = JSON.stringify(chunks[i])
        writeFileSync(chunkPath, json, 'utf-8')
        const bytes = Buffer.byteLength(json, 'utf-8')
        console.log(`    → ${chunkFile} (${chunks[i].length} items, ${sizeMB(bytes)} MB)`)
        chunkFiles.push(chunkFile)
      }

      // Envelope = everything except the chunked array
      const envelope = { ...data }
      delete envelope[field]

      index = {
        __chunked: true,
        field,
        totalItems: arr.length,
        envelope,
        files: chunkFiles
      }
    } else {
      console.log(`    ⚠ Unsupported JSON shape — skipping`)
      continue
    }

    // Replace original file with the lightweight index
    writeFileSync(filepath, JSON.stringify(index), 'utf-8')
    const indexBytes = Buffer.byteLength(JSON.stringify(index), 'utf-8')
    console.log(`    ✓ Index written (${sizeMB(indexBytes)} MB) — ${index.files.length} chunks\n`)
    chunked++
  }

  if (chunked === 0) {
    console.log('All files within limit — no chunking needed.')
  } else {
    console.log(`\nDone — chunked ${chunked} file(s).`)
  }
}

main()
