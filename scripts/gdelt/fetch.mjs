#!/usr/bin/env node

/**
 * GDELT UAP/UFO News Fetcher — powered by gdelt-ts-client
 *
 * Time-windowed, tone-banded fetching for maximum coverage.
 * Splits the date range into 30-day windows and queries 5 tone bands
 * per window, yielding up to 3,750 unique articles across 90 days.
 *
 * Usage:
 *   node scripts/gdelt/fetch.mjs --out public/data/gdelt-articles.json
 *   node scripts/gdelt/fetch.mjs --out public/data/gdelt-articles.json --days 90 --max 3750
 *
 * Options:
 *   --out       Output file path (required)
 *   --days      Lookback window in days (default: 90, max: 90)
 *   --query     Custom query override (must include outer parens for OR)
 *   --max       Max articles to keep after dedup (default: 3750)
 *   --window    Window size in days for chunked requests (default: 30)
 */

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GdeltClient } from 'gdelt-ts-client'
import { GDELT_NEWS_QUERY, urlToId, mergeArticles, isNoiseArticle } from '../shared-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const SOURCE_FILE = resolve(PROJECT_ROOT, '__sources', 'gdelt-news.json')

// ─── Tone bands ─────────────────────────────────────────────────────

const TONE_BANDS = [
  { filter: 'tone>5',             tone:  7,   label: 'very positive' },
  { filter: 'tone>0 tone<5',     tone:  2.5, label: 'positive' },
  { filter: 'toneabs<1',         tone:  0,   label: 'neutral' },
  { filter: 'tone<0 tone>-5',    tone: -2.5, label: 'negative' },
  { filter: 'tone<-5',           tone: -7,   label: 'very negative' }
]

// ─── Rate-limit handling ────────────────────────────────────────────
//
// GDELT's DOC 2.0 API throttles aggressively and asks callers to space
// queries ≥5s apart. Below that, bursts come back as HTTP 429. We pace
// requests at REQUEST_DELAY_MS to avoid most 429s, and when one still
// slips through we retry the same band with escalating backoff rather
// than dropping its slice (the old behaviour silently lost a whole
// tone-band × window on any 429).

const REQUEST_DELAY_MS = 5000
const RATE_LIMIT_RETRIES = 3
const RATE_LIMIT_BACKOFF_MS = 15000

// ─── CLI args ───────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const opts = { out: '', days: 90, query: '', max: 3750, window: 30 }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--out':    opts.out    = args[++i] || ''; break
      case '--days':   opts.days   = Math.min(parseInt(args[++i], 10) || 90, 90); break
      case '--query':  opts.query  = args[++i] || ''; break
      case '--max':    opts.max    = parseInt(args[++i], 10) || 3750; break
      case '--window': opts.window = Math.min(parseInt(args[++i], 10) || 30, 90); break
    }
  }
  if (!opts.out) {
    console.error('Usage: node scripts/gdelt/fetch.mjs --out <path> [--days N] [--max N] [--window N]')
    process.exit(1)
  }
  return opts
}

// ─── Date helpers ───────────────────────────────────────────────────

function toGdeltDatetime (date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
         `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
}

function buildWindows (totalDays, windowSize) {
  const now = new Date()
  const windows = []
  let remaining = totalDays

  while (remaining > 0) {
    const chunkDays = Math.min(remaining, windowSize)
    const end = new Date(now.getTime() - (totalDays - remaining) * 86400000)
    const start = new Date(end.getTime() - chunkDays * 86400000)
    windows.push({
      startdatetime: toGdeltDatetime(start),
      enddatetime: toGdeltDatetime(end),
      label: `${Math.round((totalDays - remaining))}d–${Math.round((totalDays - remaining) + chunkDays)}d ago`
    })
    remaining -= chunkDays
  }

  return windows
}

// ─── Transform ──────────────────────────────────────────────────────

function parseGdeltDate (str) {
  if (!str) return null
  // Strip trailing timezone info (Z, +HH:MM, -HH:MM) before matching.
  // GDELT seendate is normally YYYYMMDDTHHmmSS but the API has been observed
  // returning a trailing Z on some responses, which breaks the digit-only regex.
  const cleaned = str.replace(/[Z+-].*$/, '')
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?$/)
  if (!match) return null
  const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`
}

function transformArticle (raw, bandTone) {
  const url = raw.url || ''
  return {
    id: urlToId(url),
    title: (raw.title || '').trim(),
    url,
    domain: raw.domain || '',
    publishedAt: parseGdeltDate(raw.seendate) || null,
    language: raw.language || 'en',
    sourceName: raw.sourcecountry
      ? raw.domain + ' (' + raw.sourcecountry + ')'
      : raw.domain,
    country: raw.sourcecountry || '',
    imageUrl: raw.socialimage || null,
    tone: bandTone
  }
}

// ─── Fetch with rate-limit retry ────────────────────────────────────

function sleep (ms) {
  return new Promise(r => setTimeout(r, ms))
}

function isRateLimit (err) {
  return err?.response?.status === 429 || /\b429\b/.test(err?.message || '')
}

// Fetch one tone-band slice, retrying on 429 with escalating backoff.
// Non-429 errors and exhausted retries propagate to the caller, which
// logs and skips just that slice.
async function fetchBandWithRetry (client, params, label) {
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    try {
      const response = await client.getArticles(params)
      return response.articles || []
    } catch (err) {
      if (isRateLimit(err) && attempt < RATE_LIMIT_RETRIES) {
        const wait = RATE_LIMIT_BACKOFF_MS * (attempt + 1)
        console.log(`${label} 429 rate-limited — backing off ${wait / 1000}s (retry ${attempt + 1}/${RATE_LIMIT_RETRIES})`)
        await sleep(wait)
        continue
      }
      throw err
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main () {
  const opts = parseArgs()
  const baseQuery = opts.query || `(${GDELT_NEWS_QUERY})`
  const windows = buildWindows(opts.days, opts.window)

  console.log('Base query:  ' + baseQuery)
  console.log('Total days:  ' + opts.days)
  console.log('Window size: ' + opts.window + 'd')
  console.log('Windows:     ' + windows.length)
  console.log('Tone bands:  ' + TONE_BANDS.length)
  console.log('Requests:    ' + (windows.length * TONE_BANDS.length))
  console.log('Max output:  ' + opts.max)
  console.log()

  const client = new GdeltClient({
    timeout: 60000,
    retry: true,
    maxRetries: 3,
    retryDelay: 5000
  })

  const seen = new Set()
  const allArticles = []

  for (const win of windows) {
    console.log(`── Window: ${win.label} ──`)

    for (const band of TONE_BANDS) {
      const query = `${baseQuery} ${band.filter} sourcelang:english`
      const label = `  [${band.label}]`

      let rawArticles
      try {
        rawArticles = await fetchBandWithRetry(client, {
          query,
          startdatetime: win.startdatetime,
          enddatetime: win.enddatetime,
          maxrecords: 250,
          sort: 'datedesc'
        }, label)
      } catch (err) {
        console.log(`${label} Error: ${err.message} — skipping`)
        continue
      }

      let added = 0
      let noise = 0
      let nonEn = 0
      for (const raw of rawArticles) {
        if ((raw.language || '').toLowerCase() !== 'english') { nonEn++; continue }
        const article = transformArticle(raw, band.tone)
        if (seen.has(article.url)) continue
        if (isNoiseArticle(article)) { noise++; continue }
        if (!article.publishedAt) continue
        seen.add(article.url)
        allArticles.push(article)
        added++
      }

      console.log(`${label} ${rawArticles.length} fetched, ${added} new${noise > 0 ? `, ${noise} noise` : ''}${nonEn > 0 ? `, ${nonEn} non-en` : ''}`)

      // Courtesy delay between requests — GDELT asks for ≥5s spacing
      await sleep(REQUEST_DELAY_MS)
    }
  }

  console.log('\nTotal after dedup: ' + allArticles.length)

  const trimmed = allArticles
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, opts.max)

  // Merge with existing source of truth
  mkdirSync(dirname(SOURCE_FILE), { recursive: true })

  const { merged: rawMerged } = mergeArticles(SOURCE_FILE, trimmed, {
    arrayField: 'articles',
    urlField: 'url',
    dateField: 'publishedAt',
    max: opts.max
  })

  // Final English-only filter (catches legacy non-en from existing source)
  const merged = rawMerged.filter(a => a.language === 'en' || a.language === 'English' || !a.language)
  if (rawMerged.length !== merged.length) {
    console.log(`Filtered ${rawMerged.length - merged.length} non-English from merged set`)
  }

  const output = {
    generatedAt: new Date().toISOString(),
    query: baseQuery,
    days: opts.days,
    windows: windows.length,
    totalResults: merged.length,
    articles: merged
  }

  const json = JSON.stringify(output, null, 2)

  // Write source of truth
  writeFileSync(SOURCE_FILE, json, 'utf-8')
  console.log('Wrote ' + merged.length + ' articles -> ' + SOURCE_FILE)

  // Copy to public/data
  mkdirSync(dirname(opts.out), { recursive: true })
  copyFileSync(SOURCE_FILE, opts.out)
  console.log('Copied -> ' + opts.out)
}

main().catch(err => { console.error('\nGDELT fetch failed: ' + err.message); process.exit(1) })
