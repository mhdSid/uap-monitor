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

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import GNews from '@gnews-io/gnews-io-js'
import { GNEWS_QUERIES, urlToId, mergeArticles, isNoiseArticle } from '../shared-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const SOURCE_FILE = resolve(PROJECT_ROOT, '__sources', 'gnews-articles.json')

const PER_PAGE = 10  // GNews free tier hard limit

// ─── CLI args ───────────────────────────────────────────────────────

function parseArgs () {
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

function daysAgoISO (days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function transformArticle (raw) {
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

async function main () {
  const apiKey = process.env.GNEWS_API_KEY
  if (!apiKey) {
    console.error('Error: GNEWS_API_KEY environment variable is required.')
    console.error('Get a free key at https://gnews.io')
    process.exit(1)
  }

  const opts = parseArgs()
  const queries = opts.query ? [opts.query] : GNEWS_QUERIES
  const fromDate = daysAgoISO(opts.days)

  console.log('Queries:     ' + queries.length + ' rotation queries')
  console.log('Window:      ' + fromDate + ' -> now')
  console.log('Lang:        ' + opts.lang)
  console.log('Limit:       ' + opts.limit + ' articles')
  console.log('Max pages:   ' + opts.pages + ' (across all queries)')
  console.log()

  const client = new GNews(apiKey)
  const allArticles = []
  const seen = new Set()
  let totalPages = 0

  for (const query of queries) {
    if (totalPages >= opts.pages) break
    if (allArticles.length >= opts.limit) break

    console.log(`── Query: ${query} ──`)
    let currentTo = new Date().toISOString()
    let emptyStreak = 0

    // Paginate within this query
    const maxPagesPerQuery = Math.ceil(opts.pages / queries.length)

    for (let page = 1; page <= maxPagesPerQuery; page++) {
      if (totalPages >= opts.pages) break
      if (allArticles.length >= opts.limit) break

      totalPages++
      console.log('  [Page ' + page + '] to=' + currentTo.slice(0, 19) + ' ...')

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
        console.error('  Stopping query: ' + err.message)
        break
      }

      if (page === 1) {
        console.log('  Total available: ' + (data.totalArticles || 0))
      }

      const batch = data.articles || []
      if (batch.length === 0) {
        console.log('  No more articles.')
        break
      }

      let newCount = 0
      let noise = 0
      for (const raw of batch) {
        const a = transformArticle(raw)
        if (seen.has(a.url)) continue
        if (isNoiseArticle(a)) { noise++; continue }
        seen.add(a.url)
        allArticles.push(a)
        newCount++
      }

      console.log('  Got ' + batch.length + ', ' + newCount + ' new' + (noise ? ', ' + noise + ' noise' : '') + ' (total: ' + allArticles.length + ')')

      // Find oldest article to shift window
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
        if (emptyStreak >= 2) {
          console.log('  No new results. Moving to next query.')
          break
        }
      } else {
        emptyStreak = 0
      }

      // Rate limit courtesy
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  console.log('\nTotal collected: ' + allArticles.length + ' (' + totalPages + ' API calls)')

  const trimmed = allArticles
    .slice(0, opts.limit)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  // Merge with existing source of truth
  mkdirSync(dirname(SOURCE_FILE), { recursive: true })

  const { merged } = mergeArticles(SOURCE_FILE, trimmed, {
    arrayField: 'articles',
    urlField: 'url',
    dateField: 'publishedAt',
    max: opts.limit
  })

  const output = {
    generatedAt: new Date().toISOString(),
    queries: queries.length,
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

main().catch(err => { console.error('\nGNews fetch failed: ' + err.message); process.exit(1) })
