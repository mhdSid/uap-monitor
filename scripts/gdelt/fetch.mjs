#!/usr/bin/env node

/**
 * GDELT UAP/UFO News Fetcher — powered by gdelt-ts-client
 *
 * Usage:
 *   node scripts/gdelt/fetch.mjs --out public/data/gdelt-articles.json
 *   node scripts/gdelt/fetch.mjs --out public/data/gdelt-articles.json --days 30
 *   node scripts/gdelt/fetch.mjs --out public/data/gdelt-articles.json --query "(UFO OR UAP)"
 *
 * Options:
 *   --out     Output file path (required)
 *   --days    Lookback window in days (default: 7, max: 90)
 *   --query   Custom query override
 *   --max     Max articles to keep after dedup (default: 250)
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { GdeltClient } from 'gdelt-ts-client'
import { DEFAULT_NEWS_QUERY, urlToId } from '../shared-constants.mjs'

// ─── CLI args ───────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { out: '', days: 7, query: '', max: 250 }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--out': opts.out = args[++i] || ''; break
      case '--days': opts.days = Math.min(parseInt(args[++i], 10) || 7, 90); break
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

// ─── Transform ──────────────────────────────────────────────────────

function parseGdeltDate(str) {
  const match = str.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?$/)
  if (!match) return null

  const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`
}

function transformArticle(raw) {
  const url = raw.url || ''
  const tone = typeof raw.tone === 'number'
    ? Math.round(raw.tone * 10) / 10
    : 0

  return {
    id: urlToId(url),
    title: (raw.title || '').trim(),
    url,
    domain: raw.domain || '',
    publishedAt: parseGdeltDate(raw.seendate) || new Date().toISOString(),
    language: raw.language || 'en',
    sourceName: raw.sourcecountry
      ? raw.domain + ' (' + raw.sourcecountry + ')'
      : raw.domain,
    country: raw.sourcecountry || '',
    imageUrl: raw.socialimage || null,
    tone
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs()
  const query = opts.query || DEFAULT_NEWS_QUERY
  const maxrecords = Math.min(opts.max, 250)
  const timespan = opts.days + 'd'

  console.log('Query:      ' + query)
  console.log('Timespan:   ' + timespan)
  console.log('Max:        ' + maxrecords)
  console.log()

  const client = new GdeltClient({
    timeout: 60000,
    retry: true,
    maxRetries: 3,
    retryDelay: 5000
  })

  const response = await client.getArticles({
    query,
    timespan,
    maxrecords,
    sort: 'datedesc'
  })

  const rawArticles = response.articles || []
  console.log('Raw results: ' + rawArticles.length)

  // Transform + dedup by URL
  const seen = new Set()
  const articles = rawArticles
    .map(transformArticle)
    .filter(a => {
      if (seen.has(a.url)) return false
      seen.add(a.url)
      return true
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  console.log('After dedup: ' + articles.length)

  const output = {
    generatedAt: new Date().toISOString(),
    query,
    totalResults: rawArticles.length,
    articles
  }

  mkdirSync(dirname(opts.out), { recursive: true })
  writeFileSync(opts.out, JSON.stringify(output, null, 2), 'utf-8')
  console.log('\nWrote ' + articles.length + ' articles -> ' + opts.out)
}

main().catch(err => { console.error('\nGDELT fetch failed: ' + err.message); process.exit(1) })
