#!/usr/bin/env node

/**
 * Reddit UAP/UFO Posts Fetcher
 *
 * Fetches recent Reddit posts related to UAP/UFO sightings from targeted
 * subreddits and search queries. Consistent with GDELT/GNews/Twitter pipeline:
 *
 *   fetch → transform → noise filter → dedupe → merge __sources → copy public/data
 *
 * Usage:
 *   REDDIT_CLIENT_ID=xxx REDDIT_CLIENT_SECRET=yyy \
 *     node scripts/reddit/fetch.mjs --out public/data/reddit-articles.json
 *
 * Options:
 *   --out     Output file path (required)
 *   --limit   Max articles to keep after dedup (default: 500)
 *   --perq    Max results per subreddit/query pair (default: 50, max practical: 100)
 *
 * Notes:
 *   - Requires Reddit OAuth. As of Reddit's 2023 API changes, unauthenticated
 *     .json endpoints return HTTP 403. Register a "script" app at
 *     https://www.reddit.com/prefs/apps to get a client id + secret, then set
 *     REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET. We use the app-only
 *     (client_credentials) grant, which is read-only and needs no user password.
 *   - A descriptive User-Agent is required by Reddit on every request.
 */

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeArticles, isNoiseArticle, urlToId, truncate } from '../shared-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const SOURCE_FILE = resolve(PROJECT_ROOT, '__sources', 'reddit-articles.json')

// ─── Query plan ─────────────────────────────────────────────────────

const REDDIT_SEARCHES = [
  // ── Tier 1: Core firehose ────────────────────────────────────────
  { subreddit: 'UFOs',            query: '"ufo sighting" OR "uap sighting" OR "strange lights"' },
  { subreddit: 'UFOs',            query: '"triangle lights" OR "black triangle" OR "orange orb"' },
  { subreddit: 'UFOs',            query: '"tic tac" OR "metallic sphere" OR "saw something"' },
  { subreddit: 'UAP',             query: '"sighting" OR "encounter" OR "witness"' },
  { subreddit: 'aliens',          query: '"ufo sighting" OR "strange lights in the sky" OR "orb"' },

  // ── Tier 2: Specialized, lower-volume, higher signal ─────────────
  { subreddit: 'HighStrangeness', query: '"strange lights" OR "mysterious lights" OR "object in the sky"' },
  { subreddit: 'AcademicUAP',     query: '"sighting" OR "case" OR "incident"' },
  { subreddit: 'UFOB',            query: '"sighting" OR "encounter" OR "saw"' },
  { subreddit: 'experiencers',    query: '"sighting" OR "encounter" OR "witnessed"' }
]

const USER_AGENT = 'uapmonitor/1.0 (reddit ingestion; contact: hello@uapmonitor.org)'

// ─── OAuth ──────────────────────────────────────────────────────────
//
// Reddit blocks unauthenticated .json access (HTTP 403). We use the
// app-only "client_credentials" grant: exchange a registered app's
// id + secret for a read-only bearer token, then query oauth.reddit.com.

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
const OAUTH_BASE = 'https://oauth.reddit.com'

async function getRedditToken () {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error(
      'Reddit OAuth requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET. ' +
      'Register a "script" app at https://www.reddit.com/prefs/apps'
    )
  }

  const basic = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT
    },
    body: 'grant_type=client_credentials'
  })

  if (!res.ok) {
    throw new Error(`Reddit token request failed: HTTP ${res.status} — check client id/secret`)
  }

  const json = await res.json()
  if (!json.access_token) {
    throw new Error('Reddit token response missing access_token')
  }
  return json.access_token
}

// ─── CLI ────────────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const opts = { out: '', limit: 500, perq: 50 }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--out': opts.out = args[++i] || ''; break
      case '--limit': opts.limit = parseInt(args[++i], 10) || 500; break
      case '--perq': opts.perq = Math.min(parseInt(args[++i], 10) || 50, 100); break
    }
  }

  if (!opts.out) {
    console.error('Usage: node scripts/reddit/fetch.mjs --out <path> [--limit N] [--perq N]')
    process.exit(1)
  }

  return opts
}

// ─── Helpers ────────────────────────────────────────────────────────

function epochToISO (seconds) {
  if (!seconds) return null
  return new Date(seconds * 1000).toISOString()
}

function htmlDecode (text) {
  return (text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function firstImageFromPreview (post) {
  const preview = post.preview?.images?.[0]
  if (!preview) return null
  return (
    preview.source?.url ||
    preview.resolutions?.[preview.resolutions.length - 1]?.url ||
    null
  )
    ? htmlDecode(
        preview.source?.url ||
        preview.resolutions?.[preview.resolutions.length - 1]?.url ||
        null
      )
    : null
}

function externalUrlForPost (post) {
  const permalink = post.permalink
    ? `https://www.reddit.com${post.permalink}`
    : null

  if (!post.url) return permalink

  // Prefer canonical Reddit discussion page for self/text posts
  if (post.is_self) return permalink

  // For outbound links, keep Reddit permalink as canonical discussion URL,
  // but preserve external URL separately as sourceUrl.
  return permalink || post.url
}

function transformPost (post) {
  const permalink = post.permalink
    ? `https://www.reddit.com${post.permalink}`
    : ''
  const canonicalUrl = externalUrlForPost(post)
  const externalSourceUrl = post.is_self ? null : (post.url || null)

  return {
    id: post.id || urlToId(canonicalUrl || permalink || externalSourceUrl || ''),
    title: htmlDecode((post.title || '').trim()),
    description: truncate(htmlDecode((post.selftext || '').trim()), 500),
    content: truncate(htmlDecode((post.selftext || '').trim()), 2000),
    url: canonicalUrl || permalink || externalSourceUrl || '',
    sourceUrl: externalSourceUrl,
    imageUrl: firstImageFromPreview(post),
    publishedAt: epochToISO(post.created_utc),
    sourceName: `r/${post.subreddit || ''}`,
    subredditUrl: post.subreddit ? `https://www.reddit.com/r/${post.subreddit}/` : null,
    authorName: post.author || '',
    score: post.score ?? 0,
    commentCount: post.num_comments ?? 0,
    over18: post.over_18 ?? false,
    isVideo: post.is_video ?? false,
    domain: post.domain || '',
    subreddit: post.subreddit || ''
  }
}

// ─── Noise filter ───────────────────────────────────────────────────

function isNoiseRedditPost (article) {
  if (isNoiseArticle(article)) return true

  const text = `${article.title} ${article.description || ''}`.toLowerCase()

  if (text.includes('ufo catcher')) return true
  if (text.includes('game clip')) return true
  if (text.includes('movie scene')) return true
  if (text.includes('fan art')) return true
  if (text.includes('lego ufo')) return true

  if (article.over18) return true

  return false
}

// ─── Fetch ──────────────────────────────────────────────────────────

async function fetchSearch (subreddit, query, limit, token) {
  const params = new URLSearchParams({
    q: query,
    restrict_sr: '1',
    sort: 'new',
    t: 'year',
    limit: String(limit),
    raw_json: '1'
  })

  // oauth.reddit.com mirrors the public search endpoint but requires a bearer
  // token. The path is `/search` (no `.json` suffix) under the OAuth host.
  const url = `${OAUTH_BASE}/r/${subreddit}/search?${params.toString()}`

  console.log(`\n── Search: r/${subreddit} → ${query}`)

  const start = Date.now()
  let posts = []

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': USER_AGENT,
        Accept: 'application/json'
      }
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const json = await res.json()
    posts = (json.data?.children || []).map(x => x.data).filter(Boolean)
  } catch (err) {
    console.error(`  Error: ${err.message}`)
  }

  const dur = ((Date.now() - start) / 1000).toFixed(2)
  console.log(`  Fetched: ${posts.length} posts (${dur}s)`)

  return posts
}

// ─── Main ───────────────────────────────────────────────────────────

async function main () {
  const opts = parseArgs()

  console.log('Searches:  ' + REDDIT_SEARCHES.length)
  console.log('Per query: ' + opts.perq)
  console.log('Limit:     ' + opts.limit)
  console.log()

  console.log('Authenticating with Reddit (app-only OAuth)...')
  const token = await getRedditToken()
  console.log('✓ Token acquired\n')

  const seen = new Set()
  const allArticles = []

  for (const search of REDDIT_SEARCHES) {
    if (allArticles.length >= opts.limit) break

    const posts = await fetchSearch(search.subreddit, search.query, opts.perq, token)

    let added = 0
    let noise = 0

    for (const raw of posts) {
      const article = transformPost(raw)
      const key = article.url || article.id

      if (seen.has(key)) continue
      if (isNoiseRedditPost(article)) { noise++; continue }
      if (!article.publishedAt) continue

      seen.add(key)
      allArticles.push(article)
      added++

      if (allArticles.length >= opts.limit) break
    }

    console.log(`  New: ${added}${noise > 0 ? `, ${noise} noise filtered` : ''} (total: ${allArticles.length})`)

    await new Promise(r => setTimeout(r, 1200))
  }

  console.log('\nTotal after dedup: ' + allArticles.length)

  const trimmed = allArticles
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, opts.limit)

  mkdirSync(dirname(SOURCE_FILE), { recursive: true })

  const { merged } = mergeArticles(SOURCE_FILE, trimmed, {
    arrayField: 'articles',
    urlField: 'url',
    dateField: 'publishedAt',
    max: opts.limit
  })

  const output = {
    generatedAt: new Date().toISOString(),
    queries: REDDIT_SEARCHES.length,
    totalResults: merged.length,
    articles: merged
  }

  writeFileSync(SOURCE_FILE, JSON.stringify(output, null, 2), 'utf-8')
  console.log('Wrote ' + merged.length + ' articles -> ' + SOURCE_FILE)

  mkdirSync(dirname(opts.out), { recursive: true })
  copyFileSync(SOURCE_FILE, opts.out)
  console.log('Copied -> ' + opts.out)
}

main().catch(err => {
  console.error('\nReddit fetch failed: ' + err.message)
  process.exit(1)
})
