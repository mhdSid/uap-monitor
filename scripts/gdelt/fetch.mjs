#!/usr/bin/env node

/**
 * GDELT UAP/UFO News Fetcher
 *
 * Usage:
 *   node scripts/gdelt/fetch.mjs --out public/data/gdelt-articles.json
 *   node scripts/gdelt/fetch.mjs --out public/data/gdelt-articles.json --days 30
 *   node scripts/gdelt/fetch.mjs --out public/data/gdelt-articles.json --query "(UFO OR UAP)"
 *
 * Options:
 *   --out     Output file path (required)
 *   --days    Lookback window in days (default: 14, max: 90)
 *   --query   Custom query override (default: UAP/UFO topic terms)
 *   --max     Max articles to keep after dedup (default: 250)
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import https from 'node:https'

// GDELT requires OR groups wrapped in parentheses.
// Unquoted single words scan faster than quoted phrases.
const DEFAULT_QUERY = '(UAP OR UFO OR "unidentified aerial" OR "flying saucer" OR AARO OR "alien craft")'

const GDELT_API = 'https://api.gdeltproject.org/api/v2/doc/doc'
const MAX_RETRIES = 3
const TIMEOUT_MS = 60000  // 60s — GDELT can be slow

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { out: '', days: 14, query: '', max: 250 }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--out': opts.out = args[++i] || ''; break
      case '--days': opts.days = Math.min(parseInt(args[++i], 10) || 14, 90); break
      case '--query': opts.query = args[++i] || ''; break
      case '--max': opts.max = parseInt(args[++i], 10) || 250; break
    }
  }
  if (!opts.out) {
    console.error('Usage: node scripts/gdelt/fetch.mjs --out <path> [--days N] [--query "..."] [--max N]')
    process.exit(1)
  }
  return opts
}

function urlToId(url) {
  return createHash('sha256').update(url).digest('hex').slice(0, 12)
}

function parseGdeltDate(str) {
  const match = str.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?$/)
  if (!match) return null

  const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`
}

/**
 * HTTPS GET with timeout and proper error reporting.
 */
function httpsGet(url) {
  return new Promise(function (resolve, reject) {
    var req = https.get(url, { timeout: TIMEOUT_MS }, function (res) {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error('HTTP ' + res.statusCode + ': ' + res.statusMessage))
        return
      }
      var chunks = []
      res.on('data', function (chunk) { chunks.push(chunk) })
      res.on('end', function () {
        try {
          var body = Buffer.concat(chunks).toString('utf-8')
          resolve(JSON.parse(body))
        } catch (e) {
          reject(new Error('JSON parse failed: ' + e.message))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', function () {
      req.destroy()
      reject(new Error('Request timed out after ' + (TIMEOUT_MS / 1000) + 's'))
    })
  })
}

async function fetchWithRetry(url, retries) {
  retries = retries || MAX_RETRIES
  for (var attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log('  Attempt ' + attempt + '/' + retries + '...')
      return await httpsGet(url)
    } catch (err) {
      console.error('  Failed: ' + err.message)
      if (attempt === retries) throw err
      var delay = attempt * 5000
      console.log('  Retrying in ' + (delay / 1000) + 's...')
      await new Promise(function (r) { setTimeout(r, delay) })
    }
  }
}

function transformArticle(raw) {
  var url = raw.url || ''
  return {
    id: urlToId(url),
    title: (raw.title || '').trim(),
    url: url,
    domain: raw.domain || '',
    publishedAt: parseGdeltDate(raw.seendate) || new Date().toISOString(),
    language: raw.language || 'en',
    sourceName: raw.sourcecountry ? raw.domain + ' (' + raw.sourcecountry + ')' : raw.domain,
    country: raw.sourcecountry || '',
    imageUrl: raw.socialimage || null
    // tone: typeof raw.tone === 'number' ? Math.round(raw.tone * 10) / 10 : 0
  }
}

async function main() {
  var opts = parseArgs()
  var query = opts.query || DEFAULT_QUERY

  // GDELT caps artlist at 250 per request
  var maxrecords = Math.min(opts.max, 250)
  var timespan = opts.days + 'd'

  var params = new URLSearchParams({
    query: query,
    mode: 'artlist',
    format: 'json',
    maxrecords: String(maxrecords),
    timespan: timespan,
    sort: 'datedesc'
  })

  var url = GDELT_API + '?' + params

  console.log('Query:      ' + query)
  console.log('Timespan:   ' + timespan)
  console.log('Max:        ' + maxrecords)
  console.log('URL:        ' + url)
  console.log()

  var data = await fetchWithRetry(url)
  var rawArticles = data.articles || []
  console.log('\nRaw results: ' + rawArticles.length)

  // Transform + dedup
  var articles = rawArticles.map(transformArticle)
  var seen = new Set()
  var deduped = articles.filter(function (a) {
    if (seen.has(a.url)) return false
    seen.add(a.url)
    return true
  })
  console.log('After dedup: ' + deduped.length)

  deduped.sort(function (a, b) { return b.publishedAt.localeCompare(a.publishedAt) })

  var output = {
    generatedAt: new Date().toISOString(),
    query: query,
    totalResults: rawArticles.length,
    articles: deduped
  }

  mkdirSync(dirname(opts.out), { recursive: true })
  writeFileSync(opts.out, JSON.stringify(output, null, 2), 'utf-8')
  console.log('\nWrote ' + deduped.length + ' articles -> ' + opts.out)
}

main().catch(function (err) { console.error('\nGDELT fetch failed: ' + err.message); process.exit(1) })
