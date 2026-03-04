#!/usr/bin/env node

/**
 * GNews UAP/UFO News Fetcher — powered by @gnews-io/gnews-io-js
 *
 * Usage:
 *   GNEWS_API_KEY=xxx node scripts/gnews/fetch.mjs --out public/data/gnews-articles.json
 *   GNEWS_API_KEY=xxx node scripts/gnews/fetch.mjs --out public/data/gnews-articles.json --days 365
 *
 * Options:
 *   --out     Output file path (required)
 *   --days    Lookback window in days (default: 14, max: 365)
 *   --query   Custom query override
 *   --lang    Language filter (default: en)
 *   --limit   Stop after N total articles (default: 500)
 *   --pages   Max pagination requests (default: 60, protects API quota)
 *
 * Environment:
 *   GNEWS_API_KEY   Required. Get one at https://gnews.io
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import GNews from '@gnews-io/gnews-io-js'
import { DEFAULT_NEWS_QUERY, urlToId } from '../shared-constants.mjs'

const PER_PAGE = 10  // GNews free tier hard limit

// ─── CLI args ───────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { out: '', days: 14, query: '', lang: 'en', limit: 500, pages: 60 }
  for (let i = 0; i < args.length; i++) {
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

// ─── Helpers ────────────────────────────────────────────────────────

function daysAgoISO(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function transformArticle(raw) {
  const url = raw.url || ''
  return {
    id: urlToId(url),
    title: (raw.title || '').trim(),
    description: (raw.description || '').trim(),
    content: (raw.content || '').trim(),
    url,
    imageUrl: raw.image || null,
    publishedAt: raw.publishedAt || new Date().toISOString(),
    sourceName: raw.source?.name || '',
    sourceUrl: raw.source?.url || null
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.GNEWS_API_KEY
  if (!apiKey) {
    console.error('Error: GNEWS_API_KEY environment variable is required.')
    console.error('Get a free key at https://gnews.io')
    process.exit(1)
  }

  const opts = parseArgs()
  const query = opts.query || DEFAULT_NEWS_QUERY
  const fromDate = daysAgoISO(opts.days)
  const toDate = new Date().toISOString()

  console.log('Query:      ' + query)
  console.log('Window:     ' + fromDate + ' -> ' + toDate)
  console.log('Lang:       ' + opts.lang)
  console.log('Limit:      ' + opts.limit + ' articles')
  console.log('Max pages:  ' + opts.pages)
  console.log()

  const client = new GNews(apiKey)
  const allArticles = []
  const seen = new Set()
  let currentTo = toDate
  let totalAvailable = 0
  let emptyStreak = 0

  for (let page = 1; page <= opts.pages; page++) {
    console.log('[Page ' + page + '] to=' + currentTo + ' ...')

    let data
    try {
      data = await client.search(query, {
        lang: opts.lang,
        max: PER_PAGE,
        from: fromDate,
        to: currentTo,
        sortby: 'publishedAt'
      })
    } catch (err) {
      console.error('  Stopping: ' + err.message)
      break
    }

    if (page === 1) {
      totalAvailable = data.totalArticles || 0
      console.log('  Total available: ' + totalAvailable)
    }

    const batch = data.articles || []
    if (batch.length === 0) {
      console.log('  No more articles.')
      break
    }

    // Deduplicate within and across pages
    let newCount = 0
    for (const raw of batch) {
      const a = transformArticle(raw)
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

    // Find oldest article in batch to shift the window
    let oldestDate = null
    for (const raw of batch) {
      const pd = raw.publishedAt
      if (pd && (!oldestDate || pd < oldestDate)) {
        oldestDate = pd
      }
    }

    if (!oldestDate || oldestDate >= currentTo) {
      const d = new Date(currentTo)
      d.setSeconds(d.getSeconds() - 1)
      currentTo = d.toISOString()
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
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('\nTotal collected: ' + allArticles.length)

  const trimmed = allArticles
    .slice(0, opts.limit)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  const output = {
    generatedAt: new Date().toISOString(),
    query,
    totalResults: totalAvailable,
    articles: trimmed
  }

  mkdirSync(dirname(opts.out), { recursive: true })
  writeFileSync(opts.out, JSON.stringify(output, null, 2), 'utf-8')
  console.log('Wrote ' + trimmed.length + ' articles -> ' + opts.out)
}

main().catch(err => { console.error('\nGNews fetch failed: ' + err.message); process.exit(1) })
