#!/usr/bin/env node

/**
 * GNews UAP/UFO News Fetcher — with date-window pagination
 *
 * GNews free tier returns max 10 articles per request.
 * This script paginates by shifting the date window backward
 * using the oldest article's publishedAt as the new "to" boundary.
 *
 * Usage:
 *   GNEWS_API_KEY=xxx node scripts/gnews/fetch.mjs --out public/data/gnews-articles.json
 *   GNEWS_API_KEY=xxx node scripts/gnews/fetch.mjs --out public/data/gnews-articles.json --days 365
 *
 * Options:
 *   --out     Output file path (required)
 *   --days    Lookback window in days (default: 14, max: 365)
 *   --query   Custom query override (default: UAP/UFO topic terms)
 *   --lang    Language filter (default: en)
 *   --limit   Stop after N total articles (default: 500)
 *   --pages   Max pagination requests (default: 60, protects API quota)
 *
 * Environment:
 *   GNEWS_API_KEY   Required. Get one at https://gnews.io
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import https from 'node:https'

var DEFAULT_QUERY = 'UAP OR UFO OR "unidentified aerial" OR "flying saucer" OR AARO'
var GNEWS_API = 'https://gnews.io/api/v4/search'
var MAX_RETRIES = 3
var TIMEOUT_MS = 30000
var PER_PAGE = 10  // GNews free tier hard limit

function parseArgs() {
  var args = process.argv.slice(2)
  var opts = { out: '', days: 14, query: '', lang: 'en', limit: 500, pages: 60 }
  for (var i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--out': opts.out = args[++i] || ''; break
      case '--days': opts.days = Math.min(parseInt(args[++i], 10) || 14, 365); break
      case '--query': opts.query = args[++i] || ''; break
      case '--lang': opts.lang = args[++i] || 'en'; break
      case '--limit': opts.limit = parseInt(args[++i], 10) || 500; break
      case '--pages': opts.pages = parseInt(args[++i], 10) || 60; break
    }
  }
  if (!opts.out) {
    console.error('Usage: GNEWS_API_KEY=xxx node scripts/gnews/fetch.mjs --out <path> [--days N] [--limit N] [--pages N]')
    process.exit(1)
  }
  return opts
}

function urlToId(url) {
  return createHash('sha256').update(url).digest('hex').slice(0, 12)
}

function daysAgoISO(days) {
  var d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 19) + 'Z'
}

function httpsGet(url) {
  return new Promise(function (resolve, reject) {
    var req = https.get(url, { timeout: TIMEOUT_MS }, function (res) {
      if (res.statusCode !== 200) {
        var body = ''
        res.on('data', function (c) { body += c })
        res.on('end', function () {
          reject(new Error('HTTP ' + res.statusCode + ': ' + body.slice(0, 300)))
        })
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
      return await httpsGet(url)
    } catch (err) {
      console.error('    Failed: ' + err.message)
      if (attempt === retries) throw err
      var delay = attempt * 3000
      console.log('    Retrying in ' + (delay / 1000) + 's...')
      await new Promise(function (r) { setTimeout(r, delay) })
    }
  }
}

function transformArticle(raw) {
  var url = raw.url || ''
  return {
    id: urlToId(url),
    title: (raw.title || '').trim(),
    description: (raw.description || '').trim(),
    url: url,
    imageUrl: raw.image || null,
    publishedAt: raw.publishedAt || new Date().toISOString(),
    sourceName: (raw.source && raw.source.name) ? raw.source.name : '',
    sourceUrl: (raw.source && raw.source.url) ? raw.source.url : null
  }
}

function buildUrl(apiKey, query, lang, fromDate, toDate) {
  var params = new URLSearchParams({
    q: query,
    apikey: apiKey,
    lang: lang,
    max: String(PER_PAGE),
    from: fromDate,
    to: toDate,
    sortby: 'publishedAt'
  })
  return GNEWS_API + '?' + params
}

async function main() {
  var apiKey = process.env.GNEWS_API_KEY
  if (!apiKey) {
    console.error('Error: GNEWS_API_KEY environment variable is required.')
    console.error('Get a free key at https://gnews.io')
    process.exit(1)
  }

  var opts = parseArgs()
  var query = opts.query || DEFAULT_QUERY
  var fromDate = daysAgoISO(opts.days)
  var toDate = new Date().toISOString().slice(0, 19) + 'Z'

  console.log('Query:      ' + query)
  console.log('Window:     ' + fromDate + ' -> ' + toDate)
  console.log('Lang:       ' + opts.lang)
  console.log('Limit:      ' + opts.limit + ' articles')
  console.log('Max pages:  ' + opts.pages)
  console.log()

  var allArticles = []
  var seen = new Set()
  var currentTo = toDate
  var totalAvailable = 0
  var emptyStreak = 0

  for (var page = 1; page <= opts.pages; page++) {
    var url = buildUrl(apiKey, query, opts.lang, fromDate, currentTo)
    console.log('[Page ' + page + '] to=' + currentTo + ' ...')

    var data
    try {
      data = await fetchWithRetry(url)
    } catch (err) {
      console.error('  Stopping: ' + err.message)
      break
    }

    if (page === 1) {
      totalAvailable = data.totalArticles || 0
      console.log('  Total available: ' + totalAvailable)
    }

    var batch = data.articles || []
    if (batch.length === 0) {
      console.log('  No more articles.')
      break
    }

    // Deduplicate within and across pages
    var newCount = 0
    for (var j = 0; j < batch.length; j++) {
      var a = transformArticle(batch[j])
      if (!seen.has(a.url)) {
        seen.add(a.url)
        allArticles.push(a)
        newCount++
      }
    }

    console.log('  Got ' + batch.length + ', ' + newCount + ' new (total: ' + allArticles.length + ')')

    if (allArticles.length >= opts.limit) {
      console.log('  Reached article limit (' + opts.limit + ').')
      break
    }

    // Find the oldest article in this batch to shift the window
    var oldestDate = null
    for (var k = 0; k < batch.length; k++) {
      var pd = batch[k].publishedAt
      if (pd && (!oldestDate || pd < oldestDate)) {
        oldestDate = pd
      }
    }

    if (!oldestDate || oldestDate >= currentTo) {
      // No progress — shift back 1 second to avoid infinite loop
      var d = new Date(currentTo)
      d.setSeconds(d.getSeconds() - 1)
      currentTo = d.toISOString().slice(0, 19) + 'Z'
    } else {
      currentTo = oldestDate
    }

    if (newCount === 0) {
      emptyStreak++
      if (emptyStreak >= 3) {
        console.log('  3 consecutive pages with no new articles. Stopping.')
        break
      }
    } else {
      emptyStreak = 0
    }

    // Rate limit courtesy — 1s between requests
    await new Promise(function (r) { setTimeout(r, 1000) })
  }

  console.log('\nTotal collected: ' + allArticles.length)

  // Trim to limit
  allArticles = allArticles.slice(0, opts.limit)
  allArticles.sort(function (a, b) { return b.publishedAt.localeCompare(a.publishedAt) })

  var output = {
    generatedAt: new Date().toISOString(),
    query: query,
    totalResults: totalAvailable,
    articles: allArticles
  }

  mkdirSync(dirname(opts.out), { recursive: true })
  writeFileSync(opts.out, JSON.stringify(output, null, 2), 'utf-8')
  console.log('Wrote ' + allArticles.length + ' articles -> ' + opts.out)
}

main().catch(function (err) { console.error('\nGNews fetch failed: ' + err.message); process.exit(1) })
