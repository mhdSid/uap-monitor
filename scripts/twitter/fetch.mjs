#!/usr/bin/env node

/**
 * Twitter / X UAP News Fetcher — powered by twitter-api-v2
 *
 * Fetches recent tweets about UAP/UFO sightings with author data and
 * media attachments. Consistent with GDELT/GNews pipeline pattern.
 *
 * Usage:
 *   TWITTER_BEARER_TOKEN=xxx node scripts/twitter/fetch.mjs --out public/data/twitter-articles.json
 *
 * Options:
 *   --out     Output file path (required)
 *   --limit   Max articles to keep after dedup (default: 500)
 *   --perq    Max results per query (default: 100)
 */

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TwitterApi } from 'twitter-api-v2'
import { mergeArticles, isNoiseArticle } from '../shared-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const SOURCE_FILE = resolve(PROJECT_ROOT, '__sources', 'twitter-articles.json')

// ─── Queries ────────────────────────────────────────────────────────

const TWITTER_QUERIES = [
  '(ufo OR uap OR "unidentified object") (saw OR spotted OR seeing OR hovering OR flying) lang:en -is:retweet -is:reply -movie -film -trailer -anime -game -gaming -marvel -netflix',
  '("strange lights" OR "mysterious lights" OR "weird lights") (sky OR above OR hovering) lang:en -is:retweet -is:reply -movie -film -trailer -game',
  '("triangle lights" OR "triangular craft" OR "black triangle" OR "orange orb") (saw OR spotted OR hovering) lang:en -is:retweet -is:reply -movie -film',
  '(ufo OR uap) (video OR photo OR footage OR captured OR filmed) (sky OR night) lang:en -is:retweet -is:reply -movie -film -game',
  '("uap sighting" OR "ufo sighting" OR "uap report" OR "ufo report") lang:en -is:retweet -is:reply -movie -film'
]

// ─── CLI ────────────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const opts = { out: '', limit: 500, perq: 100 }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--out': opts.out = args[++i] || ''; break
      case '--limit': opts.limit = parseInt(args[++i], 10) || 500; break
      case '--perq': opts.perq = parseInt(args[++i], 10) || 100; break
    }
  }
  if (!opts.out) {
    console.error('Usage: TWITTER_BEARER_TOKEN=xxx node scripts/twitter/fetch.mjs --out <path> [--limit N] [--perq N]')
    process.exit(1)
  }
  return opts
}

// ─── Transform ──────────────────────────────────────────────────────

function buildUserMap (includes) {
  const map = new Map()
  if (includes?.users) {
    for (const u of includes.users) {
      map.set(u.id, {
        name: u.name || '',
        username: u.username || '',
        profileImageUrl: u.profile_image_url || null,
        verified: u.verified ?? false
      })
    }
  }
  return map
}

function buildMediaMap (includes) {
  const map = new Map()
  if (includes?.media) {
    for (const m of includes.media) {
      if (m.type === 'photo' && (m.url || m.preview_image_url)) {
        map.set(m.media_key, m.url || m.preview_image_url)
      }
    }
  }
  return map
}

function transformTweet (tweet, userMap, mediaMap) {
  const author = userMap.get(tweet.author_id) || {}
  const mediaKeys = tweet.attachments?.media_keys || []
  const imageUrl = mediaKeys.reduce((found, key) => found || mediaMap.get(key) || null, null)

  return {
    id: tweet.id,
    text: (tweet.text || '').trim(),
    url: `https://x.com/${author.username || 'i'}/status/${tweet.id}`,
    publishedAt: tweet.created_at || null,
    lang: tweet.lang || 'en',
    authorName: author.name || '',
    authorUsername: author.username || '',
    authorImageUrl: author.profileImageUrl || null,
    authorVerified: author.verified || false,
    imageUrl,
    likeCount: tweet.public_metrics?.like_count ?? 0,
    repostCount: tweet.public_metrics?.retweet_count ?? 0,
    replyCount: tweet.public_metrics?.reply_count ?? 0,
    quoteCount: tweet.public_metrics?.quote_count ?? 0
  }
}

// ─── Noise filter ───────────────────────────────────────────────────

function isNoiseTweet (article) {
  if (isNoiseArticle({ ...article, title: article.text })) return true
  const t = article.text.toLowerCase()
  if (t.includes('ufo catcher') || t.includes('ufo game')) return true
  return false
}

// ─── Fetch ──────────────────────────────────────────────────────────

async function fetchQuery (client, query, limit) {
  console.log(`\n── Query: ${query.slice(0, 80)}...`)
  const start = Date.now()
  const results = []

  try {
    const response = await client.v2.search(query, {
      'tweet.fields': ['created_at', 'public_metrics', 'author_id', 'attachments', 'lang'],
      'user.fields': ['name', 'username', 'profile_image_url', 'verified'],
      'media.fields': ['url', 'preview_image_url', 'type'],
      expansions: ['author_id', 'attachments.media_keys'],
      max_results: Math.min(limit, 100)
    })

    const userMap = buildUserMap(response.includes)
    const mediaMap = buildMediaMap(response.includes)

    const tweets = response.data?.data || []
    for (const tweet of tweets) {
      if (results.length >= limit) break
      results.push(transformTweet(tweet, userMap, mediaMap))
    }
  } catch (err) {
    console.error(`  Error: ${err.message}`)
  }

  const dur = ((Date.now() - start) / 1000).toFixed(2)
  console.log(`  Fetched: ${results.length} tweets (${dur}s)`)
  return results
}

// ─── Main ───────────────────────────────────────────────────────────

async function main () {
  const token = process.env.TWITTER_BEARER_TOKEN
  if (!token) {
    console.error('Missing TWITTER_BEARER_TOKEN environment variable')
    process.exit(1)
  }

  const opts = parseArgs()
  const client = new TwitterApi(token)

  console.log('Queries:   ' + TWITTER_QUERIES.length)
  console.log('Per query: ' + opts.perq)
  console.log('Limit:     ' + opts.limit)
  console.log()

  const seen = new Set()
  const allArticles = []

  for (const query of TWITTER_QUERIES) {
    if (allArticles.length >= opts.limit) break

    const tweets = await fetchQuery(client, query, opts.perq)

    let added = 0
    let noise = 0
    for (const t of tweets) {
      if (seen.has(t.id)) continue
      if (isNoiseTweet(t)) { noise++; continue }
      if (!t.publishedAt) continue
      seen.add(t.id)
      allArticles.push(t)
      added++
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
    queries: TWITTER_QUERIES.length,
    totalResults: merged.length,
    articles: merged
  }

  writeFileSync(SOURCE_FILE, JSON.stringify(output, null, 2), 'utf-8')
  console.log('Wrote ' + merged.length + ' articles -> ' + SOURCE_FILE)

  mkdirSync(dirname(opts.out), { recursive: true })
  copyFileSync(SOURCE_FILE, opts.out)
  console.log('Copied -> ' + opts.out)
}

main().catch(err => { console.error('\nTwitter fetch failed: ' + err.message); process.exit(1) })
