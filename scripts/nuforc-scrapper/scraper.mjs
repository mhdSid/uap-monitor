#!/usr/bin/env node

/**
 * NUFORC Sighting Scraper
 *
 * Modes:
 *   1. Scrape:  Walks backwards from a sighting ID, fetching detail pages → writes raw JSON cache
 *   2. Cache:   Reads existing raw cache → transforms to user-defined schema → writes output JSON
 *
 * Usage:
 *   node scraper.mjs --years 2026 --limit 5 --verbose  # auto-discover latest ID, collect 5 from 2026
 *   node scraper.mjs --start-id 196099 --years 2024-2026  # walk back from known ID
 *   node scraper.mjs --years 2026                       # scrape all 2026 sightings
 *   node scraper.mjs --years 2026 --tor                 # scrape via Tor
 *   node scraper.mjs --cache --schema schema.json       # transform cached data with schema
 *   node scraper.mjs --cache --schema s.json --merge out.json  # transform + merge into existing file
 *   node scraper.mjs --resume --years 2024-2026         # resume interrupted scrape
 *
 * The scraper respects NUFORC by:
 *   - Using polite delays between requests (default 500ms, configurable)
 *   - Low concurrency (3 parallel, configurable)
 *   - Proper User-Agent identification
 *   - Only scraping the gap we need
 */

import { Command } from "commander"
import * as cheerio from "cheerio"
import fs from "fs/promises"
import path from "path"
import nodeFetch from "node-fetch"

// Lazy-load Tor agent only when --tor is used
let torAgent = null
async function getTorAgent() {
  if (!torAgent) {
    const { SocksProxyAgent } = await import("socks-proxy-agent")
    torAgent = new SocksProxyAgent("socks5h://127.0.0.1:9050")
  }
  return torAgent
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = "https://nuforc.org"
const DETAIL_URL = (id) => `${BASE_URL}/sighting/?id=${id}`
const RAW_CACHE_FILE = "nuforc_raw_cache.json"
const DEFAULT_OUTPUT = "nuforc_output.json"
const DEFAULT_DELAY_MS = 500
const CONSECUTIVE_MISS_LIMIT = 200

// ─── CLI ─────────────────────────────────────────────────────────────────────

const program = new Command()
program
  .name("nuforc-scraper")
  .description("Scrape NUFORC UFO sighting reports with caching & schema transform")
  .option("--cache", "Use cached raw data instead of scraping")
  .option("--schema <file>", "JSON schema file for output transformation")
  .option("--output <file>", "Output file path", DEFAULT_OUTPUT)
  .option("--raw-file <file>", "Raw cache file path", RAW_CACHE_FILE)
  .option("--start-id <n>", "Sighting ID to start walking backwards from", parseInt)
  .option("--years <range>", "Year or year range (e.g. 2025, 2020-2026)")
  .option("--limit <n>", "Max number of records to collect", parseInt)
  .option("--concurrency <n>", "Number of parallel requests (be polite)", parseInt, 3)
  .option("--delay <ms>", "Delay between requests in ms", parseInt, DEFAULT_DELAY_MS)
  .option("--miss-limit <n>", "Stop after N consecutive misses", parseInt, CONSECUTIVE_MISS_LIMIT)
  .option("--resume", "Resume scraping — skip IDs already in raw cache")
  .option("--merge <file>", "Merge transformed output into this existing JSON file (creates backup)")
  .option("--merge-key <field>", "Field to deduplicate on when merging (dot notation for nested, e.g. 'id' or 'sighting_id')", "id")
  .option("--merge-strategy <s>", "How to handle duplicates: 'keep-existing' or 'keep-new'", "keep-new")
  .option("--tor", "Route requests through Tor (socks5h://127.0.0.1:9050)")
  .option("--verbose", "Verbose logging")
  .parse()

const opts = program.opts()

// ─── Utilities ───────────────────────────────────────────────────────────────

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args)
}

function debug(...args) {
  if (opts.verbose) console.log(`  [debug]`, ...args)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseYearRange(rangeStr) {
  if (!rangeStr) return null
  const parts = rangeStr.split("-").map(Number)
  if (parts.length === 1) return { from: parts[0], to: parts[0] }
  return { from: parts[0], to: parts[1] }
}

function yearFromOccurred(occurred) {
  if (!occurred) return null
  const match = occurred.match(/(\d{4})/)
  return match ? parseInt(match[1]) : null
}

function matchesYearFilter(record, yearRange) {
  if (!yearRange) return true
  const year = yearFromOccurred(record.occurred)
  if (!year) return true
  return year >= yearRange.from && year <= yearRange.to
}

// ─── HTTP Layer ──────────────────────────────────────────────────────────────
//
// WHY node-fetch instead of native fetch:
//
// Node.js native fetch is built on undici. Its `dispatcher` option expects
// an undici Dispatcher, NOT an http.Agent. SocksProxyAgent is an http.Agent
// — passing it as `dispatcher` silently fails (the option is ignored and
// requests go direct, or throw depending on the Node version).
//
// node-fetch supports the standard `agent` option which works correctly
// with SocksProxyAgent, https-proxy-agent, etc.

async function buildFetchOptions() {
  const fetchOpts = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0",
      Accept: "text/html,application/xhtml+xml",
      Referer: "https://nuforc.org/subndx/?id=all"
    }
  }
  if (opts.tor) {
    fetchOpts.agent = await getTorAgent()
  }
  return fetchOpts
}

async function fetchPage(url) {
  const fetchOpts = await buildFetchOptions()
  const res = await nodeFetch(url, fetchOpts)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return await res.text()
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fetchOpts = await buildFetchOptions()
      const res = await nodeFetch(url, fetchOpts)

      if (res.status === 429 || res.status === 503) {
        const wait = Math.pow(2, attempt) * 3000
        log(`Rate limited (${res.status}), backing off ${wait}ms...`)
        await sleep(wait)
        continue
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return await res.text()
    } catch (err) {
      if (attempt === retries) throw err
      const wait = Math.pow(2, attempt) * 1000
      debug(`Attempt ${attempt} failed for ${url}: ${err.message}, retrying in ${wait}ms`)
      await sleep(wait)
    }
  }
}

// ─── Detail Page Parser ─────────────────────────────────────────────────────

function parseDetailPage(html, sightingId) {
  const $ = cheerio.load(html)

  const primary = $("#primary")
  const primaryHtml = primary.html() || ""

  const extract = (label) => {
    const pattern = new RegExp(
      `<b>\\s*${label}:?\\s*</b>\\s*([^<]+)`,
      "i"
    )
    const match = primaryHtml.match(pattern)
    return match ? match[1].trim() : null
  }

  let summary = null
  let description = null

  const textHtml = primaryHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")

  const lines = textHtml.split("\n").map((l) => l.trim()).filter(Boolean)

  const metaLabels = [
    "Characteristics", "Estimated Speed", "Closest Distance",
    "Angle of Elevation", "Direction from Viewer", "Viewed From",
    "Estimated Size", "Color", "Shape", "Location details",
    "Location", "No of observers", "Duration", "Reported", "Occurred"
  ]

  let metaEndIdx = -1
  for (let i = 0; i < lines.length; i++) {
    for (const label of metaLabels) {
      if (lines[i].startsWith(`${label}:`)) {
        metaEndIdx = Math.max(metaEndIdx, i)
      }
    }
  }

  if (metaEndIdx >= 0) {
    const contentLines = []
    for (let i = metaEndIdx + 1; i < lines.length; i++) {
      if (lines[i].match(/^Posted\s+/i)) break
      if (lines[i].match(/^(©|Copyright|National UFO|TERMS|PRIVACY)/i)) break
      contentLines.push(lines[i])
    }
    if (contentLines.length > 0) {
      summary = contentLines[0]
      description = contentLines.length > 1
        ? contentLines.slice(1).join("\n")
        : null
    }
  }

  const postedMatch = primaryHtml.match(/Posted\s+(\d{4}-\d{2}-\d{2})/i)

  const record = {
    _sighting_id: sightingId,
    _source_url: DETAIL_URL(sightingId),
    _scraped_at: new Date().toISOString(),
    occurred: extract("Occurred"),
    reported: extract("Reported"),
    duration: extract("Duration"),
    num_observers: extract("No of observers"),
    location: extract("Location"),
    location_details: extract("Location details"),
    shape: extract("Shape"),
    color: extract("Color"),
    estimated_size: extract("Estimated Size"),
    viewed_from: extract("Viewed From"),
    direction_from_viewer: extract("Direction from Viewer"),
    angle_of_elevation: extract("Angle of Elevation"),
    closest_distance: extract("Closest Distance"),
    estimated_speed: extract("Estimated Speed"),
    characteristics: extract("Characteristics"),
    summary,
    description,
    posted: postedMatch ? postedMatch[1] : null
  }

  if (record.location) {
    const locParts = record.location.split(",").map((s) => s.trim())
    if (locParts.length >= 3) {
      record._city = locParts[0]
      record._state = locParts[1]
      record._country = locParts[locParts.length - 1]
    } else if (locParts.length === 2) {
      record._city = locParts[0]
      record._country = locParts[1]
    }
  }

  return record
}

// ─── Schema Transformation ──────────────────────────────────────────────────

function transformRecord(raw, schema) {
  if (typeof schema === "string") {
    return resolveMapping(raw, schema)
  }
  if (Array.isArray(schema)) {
    return schema.map((item) => transformRecord(raw, item))
  }
  if (typeof schema === "object" && schema !== null) {
    const result = {}
    for (const [key, mapping] of Object.entries(schema)) {
      result[key] = transformRecord(raw, mapping)
    }
    return result
  }
  return schema
}

function resolveMapping(raw, mappingStr) {
  mappingStr = mappingStr.trim()

  if (mappingStr.startsWith("$literal:")) {
    return mappingStr.slice(9)
  }

  const directiveMatch = mappingStr.match(/^\$(\w+)(?:\(([^)]*)\))?:(.+)$/)
  if (directiveMatch) {
    const [, directive, arg, rest] = directiveMatch
    const value = resolveMapping(raw, rest)
    return applyDirective(directive, arg || null, value)
  }

  if (mappingStr.includes("||")) {
    const fields = mappingStr.split("||").map((s) => s.trim())
    for (const f of fields) {
      const val = resolveMapping(raw, f)
      if (val !== null && val !== undefined && val !== "") return val
    }
    return null
  }

  if (mappingStr.includes("|")) {
    const [field, defaultVal] = mappingStr.split("|").map((s) => s.trim())
    const val = raw[field]
    return val !== null && val !== undefined && val !== "" ? val : defaultVal
  }

  return raw[mappingStr] ?? null
}

function applyDirective(name, arg, value) {
  switch (name) {
    case "int": {
      if (value === null || value === undefined) return 0
      const n = parseInt(value, 10)
      return isNaN(n) ? 0 : n
    }
    case "float": {
      if (value === null || value === undefined) return 0
      const f = parseFloat(value)
      return isNaN(f) ? 0 : f
    }
    case "bool":
      return !!value
    case "split":
      return splitValue(value, arg || ",")
    case "array":
      if (Array.isArray(value)) return value
      if (value === null || value === undefined) return []
      return [value]
    case "date":
      return normalizeDate(value, arg)
    case "upper":
      return value != null ? String(value).toUpperCase() : null
    case "lower":
      return value != null ? String(value).toLowerCase() : null
    case "trim":
      return value != null ? String(value).trim() : null
    default:
      debug(`Unknown directive: $${name}`)
      return value
  }
}

function splitValue(value, delimiter) {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value
  return String(value)
    .split(delimiter)
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeDate(value, suffix) {
  if (!value || typeof value !== "string") return null

  let normalized = value.trim()
  normalized = normalized
    .replace(/\s*(Local|Pacific|Eastern|Central|Mountain|UTC)\s*$/i, "")
    .trim()

  const usMatch = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  )
  if (usMatch) {
    const [, mo, dd, yyyy, hh, mm, ss] = usMatch
    normalized = `${yyyy}-${mo.padStart(2, "0")}-${dd.padStart(2, "0")} ${(hh || "00").padStart(2, "0")}:${mm || "00"}:${ss || "00"}`
  }

  const isoMatch = normalized.match(
    /^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/
  )
  if (isoMatch) {
    const datePart = isoMatch[1]
    let timePart = isoMatch[2] || "00:00:00"
    if (timePart.length === 5) timePart += ":00"
    if (/^\d:/.test(timePart)) timePart = "0" + timePart
    normalized = `${datePart} ${timePart}`
  }

  return suffix ? `${normalized} ${suffix}` : normalized
}

function transformAllRecords(records, schema) {
  return records.map((raw) => transformRecord(raw, schema))
}

// ─── Main Orchestration ─────────────────────────────────────────────────────

async function loadRawCache(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content)
  } catch (err) {
    if (err.code === "ENOENT") return null
    throw err
  }
}

async function saveRawCache(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
}

// ─── Merge Utilities ────────────────────────────────────────────────────────
//
// --merge <file> merges transformed output into an existing JSON array file.
//
// Flow:
//   1. Read existing merge destination → existingRecords[]
//   2. Create hidden backup:  dir/.filename.backup.json
//   3. Deduplicate by --merge-key (default: "id")
//   4. Write merged result to the merge destination
//
// The --output file still gets written as-is (just the new transformed data).
// The --merge file gets the combined set.

/**
 * Resolve a dot-notation key from an object.
 *   getByPath({ a: { b: 1 } }, "a.b") → 1
 *   getByPath({ id: 5 }, "id") → 5
 */
function getByPath(obj, keyPath) {
  const parts = keyPath.split(".")
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = current[part]
  }
  return current
}

/**
 * Create a hidden backup of a file.
 *   __sources/nuforc.json → __sources/.nuforc.json.backup
 */
async function createBackup(filePath) {
  const dir = path.dirname(filePath)
  const ext = path.extname(filePath)
  const base = path.basename(filePath, ext)
  const backupName = `.${base}${ext}.backup`
  const backupPath = path.join(dir, backupName)

  await fs.copyFile(filePath, backupPath)
  return backupPath
}

/**
 * Merge newRecords into existingRecords by a key field.
 *
 * @param {Array} existingRecords - records already in the merge destination
 * @param {Array} newRecords      - freshly transformed records
 * @param {string} mergeKey       - dot-notation path to the dedup field
 * @param {string} strategy       - "keep-existing" or "keep-new"
 * @returns {{ merged: Array, stats: { kept: number, added: number, updated: number } }}
 */
function mergeRecords(existingRecords, newRecords, mergeKey, strategy) {
  const map = new Map()
  let kept = 0
  let updated = 0

  // Index existing records
  for (const record of existingRecords) {
    const key = getByPath(record, mergeKey)
    if (key !== undefined && key !== null) {
      map.set(String(key), record)
    } else {
      // No key — keep as-is (won't be deduped)
      map.set(`__nokey_${kept++}`, record)
    }
  }

  const existingSize = map.size

  // Merge new records
  for (const record of newRecords) {
    const key = getByPath(record, mergeKey)
    const keyStr = key !== undefined && key !== null ? String(key) : null

    if (keyStr && map.has(keyStr)) {
      // Duplicate — apply strategy
      if (strategy === "keep-new") {
        map.set(keyStr, record)
        updated++
      }
      // "keep-existing" → do nothing, existing stays
    } else {
      // New record
      const mapKey = keyStr || `__nokey_new_${map.size}`
      map.set(mapKey, record)
    }
  }

  const merged = Array.from(map.values())
  const added = merged.length - existingSize

  return {
    merged,
    stats: { kept: existingSize, added, updated }
  }
}

/**
 * Load a JSON array file, returning [] if it doesn't exist.
 */
async function loadJsonArray(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      log(`⚠ Merge target is not a JSON array — wrapping in array`)
      return [parsed]
    }
    return parsed
  } catch (err) {
    if (err.code === "ENOENT") return null
    throw err
  }
}

function buildCacheData(records, yearRange, collected, notFound, outOfRange) {
  return {
    metadata: {
      scraped_at: new Date().toISOString(),
      total_records: records.length,
      year_filter: yearRange,
      scrape_stats: { collected, not_found: notFound, out_of_range: outOfRange }
    },
    records
  }
}

// ─── ID Discovery ───────────────────────────────────────────────────────────

async function probeId(id) {
  try {
    const text = await fetchPage(DETAIL_URL(id))
    return text.includes("Occurred")
  } catch (err) {
    debug(`Probe ${id} failed: ${err.message}`)
    return false
  }
}

async function discoverLatestId() {
  let lo = 1
  let hi = 250000
  let lastValid = null

  log("Binary search for latest sighting ID...")

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const exists = await probeId(mid)
    debug(`Probe ID ${mid}: ${exists ? "✓ exists" : "✗ empty"}`)

    if (exists) {
      lastValid = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
    await sleep(opts.delay)
  }

  if (lastValid) {
    for (let id = lastValid + 1; id <= lastValid + 20; id++) {
      const exists = await probeId(id)
      if (exists) lastValid = id
      await sleep(opts.delay)
    }
  }

  return lastValid
}

// ─── Scrape Mode ────────────────────────────────────────────────────────────

async function runScrapeMode() {
  const yearRange = parseYearRange(opts.years)
  const limit = opts.limit || Infinity
  const concurrency = opts.concurrency
  const missLimit = opts.missLimit
  const delay = opts.delay

  log("=== NUFORC Scraper — ID Walk Mode ===")
  if (yearRange) log(`Year filter: ${yearRange.from}-${yearRange.to}`)
  if (opts.limit) log(`Record limit: ${opts.limit}`)
  log(`Concurrency: ${concurrency}`)
  log(`Request delay: ${delay}ms`)
  log(`Miss limit: ${missLimit} consecutive`)
  log(`Tor: ${opts.tor ? "enabled" : "disabled"}`)
  log(`Raw cache: ${opts.rawFile}`)
  log("")

  // Verify connectivity
  if (opts.tor) {
    log("Testing Tor connection...")
    try {
      const testHtml = await fetchPage("https://nuforc.org/")
      if (testHtml.includes("NUFORC")) {
        log("✓ Tor connection working")
      } else {
        log("⚠ Tor connected but unexpected response")
      }
    } catch (err) {
      log(`✗ Tor connection failed: ${err.message}`)
      log("  Make sure Tor is running: brew services start tor / systemctl start tor")
      log("  Or remove --tor to connect directly")
      process.exit(1)
    }
  }

  // Resume support
  let existingCache = null
  const existingIds = new Set()
  if (opts.resume) {
    existingCache = await loadRawCache(opts.rawFile)
    if (existingCache) {
      for (const r of existingCache.records) {
        existingIds.add(r._sighting_id)
      }
      log(`Resume: ${existingIds.size} records already cached`)
    }
  }

  // Discover start ID
  let startId = opts.startId
  if (!startId) {
    log("No --start-id given, probing for latest sighting ID...")
    startId = await discoverLatestId()
    if (!startId) {
      log("Could not discover latest ID. Use --start-id <n> manually.")
      process.exit(1)
    }
    log(`Discovered latest ID: ${startId}`)
  }

  log("")
  log(`Walking backwards from ID ${startId}...`)
  log("")

  const records = existingCache ? [...existingCache.records] : []
  let collected = 0
  let notFound = 0
  let outOfRange = 0
  let consecutiveMisses = 0
  let consecutivePastRange = 0
  let currentId = startId
  let errors = 0
  let lastCheckpoint = 0

  while (currentId > 0 && collected < limit && consecutiveMisses < missLimit) {
    const batchIds = []
    for (let i = 0; i < concurrency && (currentId - i) > 0; i++) {
      const id = currentId - i
      if (!existingIds.has(id)) {
        batchIds.push(id)
      }
    }
    currentId -= concurrency

    if (batchIds.length === 0) continue

    // Stagger requests within batch
    const batchResults = await Promise.all(
      batchIds.map(async (id, idx) => {
        if (idx > 0) await sleep(idx * delay)

        try {
          const html = await fetchWithRetry(DETAIL_URL(id), 2)

          if (!html || html.length < 500 || !html.includes("Occurred")) {
            debug(`ID ${id}: no sighting content (${html?.length || 0} bytes)`)
            return { id, status: "not_found" }
          }

          const record = parseDetailPage(html, id)
          if (!record.occurred) {
            debug(`ID ${id}: parsed but no occurred date`)
            return { id, status: "not_found" }
          }

          debug(`ID ${id}: ✓ ${record.occurred} — ${record.shape || "?"} — ${record._city || "?"}`)
          return { id, status: "ok", record }
        } catch (err) {
          debug(`ID ${id}: ✗ ${err.message}`)
          return { id, status: "error", error: err.message }
        }
      })
    )

    await sleep(delay)

    let batchHadContent = false // any ID in this batch had a real sighting page?
    let batchPastRange = 0     // count of records older than our year range

    for (const result of batchResults) {
      if (result.status === "not_found") {
        notFound++
        continue
      }
      if (result.status === "error") {
        errors++
        notFound++
        continue
      }

      // The page exists and has a real sighting — this is NOT a "miss"
      batchHadContent = true

      if (yearRange && !matchesYearFilter(result.record, yearRange)) {
        outOfRange++
        const recordYear = yearFromOccurred(result.record.occurred)
        debug(`ID ${result.id}: out of year range (${recordYear})`)

        // Track records older than our range — if we see many, we've passed through
        if (recordYear && recordYear < yearRange.from) {
          batchPastRange++
        }
        continue
      }

      records.push(result.record)
      collected++

      if (collected % 10 === 0) {
        log(`Collected: ${collected} | ID: ${result.id} | ${result.record.occurred} | ${result.record._city || "?"}, ${result.record._country || "?"}`)
      }
    }

    // Consecutive miss tracking: only true 404s/errors count as misses.
    // Out-of-range records prove the ID space is populated — not a miss.
    if (batchHadContent) {
      consecutiveMisses = 0
    } else {
      consecutiveMisses += batchIds.length
    }

    // Early stop: if every valid record in this batch is OLDER than our
    // target year range, we've walked past it — no point continuing.
    if (yearRange && batchPastRange > 0 && batchPastRange === batchResults.filter(r => r.status === "ok").length) {
      consecutivePastRange += batchPastRange
    } else {
      consecutivePastRange = 0
    }
    if (consecutivePastRange >= missLimit) {
      log(`All recent records are before ${yearRange.from} — stopping early.`)
      break
    }

    if (consecutiveMisses > 0 && consecutiveMisses % 25 === 0) {
      log(`... ${consecutiveMisses} consecutive misses, still walking... (current ID: ${currentId})`)
    }

    if (collected > 0 && collected % 100 === 0 && collected !== lastCheckpoint) {
      lastCheckpoint = collected
      await saveRawCache(opts.rawFile, buildCacheData(records, yearRange, collected, notFound, outOfRange))
      log(`Checkpoint: saved ${collected} records`)
    }
  }

  records.sort((a, b) => b._sighting_id - a._sighting_id)
  const cacheData = buildCacheData(records, yearRange, collected, notFound, outOfRange)
  await saveRawCache(opts.rawFile, cacheData)

  log("")
  log(`✓ Done — saved ${records.length} records to ${opts.rawFile}`)
  log(`  Collected: ${collected}`)
  log(`  404/empty: ${notFound}`)
  log(`  Out of range: ${outOfRange}`)
  log(`  Errors: ${errors}`)
  log(`  ID range walked: ${startId} → ${Math.max(currentId, 1)}`)
  if (consecutiveMisses >= missLimit) {
    log(`  Stopped: ${consecutiveMisses} consecutive misses (limit: ${missLimit})`)
  }
  if (collected >= limit) {
    log(`  Stopped: reached record limit (${limit})`)
  }
}

// ─── Cache Mode ─────────────────────────────────────────────────────────────

async function runCacheMode() {
  const yearRange = parseYearRange(opts.years)

  log("=== NUFORC Scraper — Cache Mode ===")
  log(`Raw cache: ${opts.rawFile}`)
  if (opts.schema) log(`Schema: ${opts.schema}`)
  log(`Output: ${opts.output}`)
  if (opts.merge) log(`Merge into: ${opts.merge} (key: ${opts.mergeKey}, strategy: ${opts.mergeStrategy})`)
  if (yearRange) log(`Year filter: ${yearRange.from}-${yearRange.to}`)
  log("")

  const cache = await loadRawCache(opts.rawFile)
  if (!cache) {
    console.error(`Error: Cache file not found: ${opts.rawFile}`)
    console.error("Run without --cache first to scrape data.")
    process.exit(1)
  }

  log(`Loaded ${cache.records.length} records from cache`)
  log(`Cache created: ${cache.metadata.scraped_at}`)

  let records = cache.records
  if (yearRange) {
    records = records.filter((r) => matchesYearFilter(r, yearRange))
    log(`After year filter: ${records.length} records`)
  }

  // Transform
  let outputRecords
  if (opts.schema) {
    const schemaContent = await fs.readFile(opts.schema, "utf-8")
    const schema = JSON.parse(schemaContent)
    log(`Applying schema transformation...`)
    outputRecords = transformAllRecords(records, schema)
  } else {
    outputRecords = records
  }

  // Write --output (always: just the transformed data from this run)
  await fs.writeFile(opts.output, JSON.stringify(outputRecords, null, 2), "utf-8")
  log(`✓ Saved ${outputRecords.length} transformed records to ${opts.output}`)

  // ── Merge ──────────────────────────────────────────────────────────────
  if (opts.merge) {
    log("")
    log(`Merging into ${opts.merge}...`)

    const existingRecords = await loadJsonArray(opts.merge)

    if (existingRecords === null) {
      // Merge target doesn't exist yet — just write the output directly
      log(`Merge target does not exist — creating ${opts.merge}`)
      // Ensure directory exists
      await fs.mkdir(path.dirname(opts.merge), { recursive: true })
      await fs.writeFile(opts.merge, JSON.stringify(outputRecords, null, 2), "utf-8")
      log(`✓ Wrote ${outputRecords.length} records to ${opts.merge}`)
    } else {
      // Backup the original before touching it
      const backupPath = await createBackup(opts.merge)
      log(`Backup created: ${backupPath}`)

      // Validate merge key exists in new records
      if (outputRecords.length > 0) {
        const sampleKey = getByPath(outputRecords[0], opts.mergeKey)
        if (sampleKey === undefined) {
          log(`⚠ Warning: merge key "${opts.mergeKey}" not found in transformed records.`)
          log(`  Available top-level keys: ${Object.keys(outputRecords[0]).join(", ")}`)
          log(`  Use --merge-key <field> to specify the correct dedup field.`)
        }
      }

      const { merged, stats } = mergeRecords(
        existingRecords,
        outputRecords,
        opts.mergeKey,
        opts.mergeStrategy
      )

      await fs.writeFile(opts.merge, JSON.stringify(merged, null, 2), "utf-8")

      log(`✓ Merged into ${opts.merge}`)
      log(`  Previously: ${stats.kept} records`)
      log(`  Added: ${stats.added} new`)
      log(`  Updated: ${stats.updated} (strategy: ${opts.mergeStrategy})`)
      log(`  Total: ${merged.length} records`)
    }
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

async function main() {
  try {
    if (opts.cache) {
      await runCacheMode()
    } else {
      await runScrapeMode()
    }
  } catch (err) {
    console.error("Fatal error:", err.message)
    if (opts.verbose) console.error(err.stack)
    process.exit(1)
  }
}

main()
