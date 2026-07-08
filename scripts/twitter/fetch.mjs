#!/usr/bin/env node

/**
 * Twitter / X UAP News Fetcher
 *
 * Two backends, selected via flags:
 *
 *   1. API (default)        — twitter-api-v2, requires TWITTER_BEARER_TOKEN
 *   2. Browser (--browser)  — puppeteer + manual login + network interception
 *                             No DOM parsing: listens for SearchTimeline GraphQL
 *                             responses and walks the JSON tree.
 *
 * Browser flow:
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ 1. Launch visible Chrome                                       │
 *   │ 2. Navigate to x.com/login                                     │
 *   │ 3. Pause for human login (handle 2FA / captcha manually)       │
 *   │ 4. Press Enter in terminal when home timeline is visible       │
 *   │ 5. Script navigates each search URL, scrolls, captures JSON    │
 *   │ 6. Same transform/dedup/merge pipeline as the API path         │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Why network interception over DOM:
 *   - SearchTimeline responses contain clean structured data (id, metrics,
 *     author, created_at) that the DOM only renders.
 *   - X's class names are hashed and rotate; rebuilding numeric metrics from
 *     rendered text is fragile.
 *   - The walker is resilient to response-shape drift: it matches any
 *     { __typename: 'Tweet', rest_id } node and refuses to descend into known
 *     quote/retweet keys so only top-level results are collected.
 *
 * Dispatcher mirrors scripts/nuforc-scrapper/scraper.mjs: puppeteer is
 * lazy-loaded only when --browser is set, so the API path has zero added
 * startup cost.
 *
 * Usage:
 *   # API backend (default)
 *   TWITTER_BEARER_TOKEN=xxx node scripts/twitter/fetch.mjs --out public/data/twitter-articles.json
 *
 *   # Browser backend (no token required)
 *   node scripts/twitter/fetch.mjs --browser --out public/data/twitter-articles.json
 *
 * Options:
 *   --out         Output file path (required)
 *   --limit       Max articles to keep after dedup (default: 500)
 *   --perq        Max results per query (default: 100)
 *   --browser     Use puppeteer + manual login + network interception
 *   --headless    Run puppeteer headless (browser mode only; default: false)
 */

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
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

// ─── Browser-mode constants ─────────────────────────────────────────

const LOGIN_URL = 'https://x.com/login'
const SEARCH_URL = (q) => `https://x.com/search?q=${encodeURIComponent(q)}&src=typed_query&f=live`
const SEARCH_TIMELINE_MARKER = 'SearchTimeline'

const SCROLL_PAUSE_MS = 1800
const QUERY_PAUSE_MS = 5000
const NAV_SETTLE_MS = 4000
const MAX_SCROLLS_PER_QUERY = 60
const NO_GROWTH_SCROLL_LIMIT = 4
const API_QUERY_PAUSE_MS = 1200
const SCROLL_FRACTION = 0.9

// Keys whose subtrees contain nested tweets (quotes / retweets) that we do
// NOT want to count as separate search results. The walker refuses to descend
// into these so only top-level entries are collected.
const NESTED_TWEET_KEYS = new Set([
  'retweeted_status_result',
  'quoted_status_result',
  'retweeted_status',
  'quoted_status'
])

const LOGIN_PROMPT = '\n→ Log in manually in the Chrome window, then press Enter here when the home timeline is visible: '

// ─── CLI ────────────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const opts = { out: '', limit: 500, perq: 100, browser: false, headless: false }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--out': opts.out = args[++i] || ''; break
      case '--limit': opts.limit = parseInt(args[++i], 10) || 500; break
      case '--perq': opts.perq = parseInt(args[++i], 10) || 100; break
      case '--browser': opts.browser = true; break
      case '--headless': opts.headless = true; break
    }
  }
  if (!opts.out) {
    console.error('Usage: node scripts/twitter/fetch.mjs --out <path> [--limit N] [--perq N] [--browser] [--headless]')
    console.error('  Without --browser: requires TWITTER_BEARER_TOKEN env var')
    process.exit(1)
  }
  return opts
}

// ─── Shared transform shape ─────────────────────────────────────────
//
// Both backends funnel through this so downstream code (noise filter, dedup,
// merge, public/data consumers) only ever sees one article shape.

function buildArticle ({ id, text, screen, name, profileImageUrl, verified, lang, createdAt, imageUrl, metrics }) {
  return {
    id,
    text: (text || '').trim(),
    url: `https://x.com/${screen || 'i'}/status/${id}`,
    publishedAt: createdAt || null,
    lang: lang || 'en',
    authorName: name || '',
    authorUsername: screen || '',
    authorImageUrl: profileImageUrl || null,
    authorVerified: verified || false,
    imageUrl: imageUrl || null,
    likeCount: metrics?.like ?? 0,
    repostCount: metrics?.repost ?? 0,
    replyCount: metrics?.reply ?? 0,
    quoteCount: metrics?.quote ?? 0
  }
}

// ─── API backend ────────────────────────────────────────────────────

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

function transformApiTweet (tweet, userMap, mediaMap) {
  const author = userMap.get(tweet.author_id) || {}
  const mediaKeys = tweet.attachments?.media_keys || []
  const imageUrl = mediaKeys.reduce((found, key) => found || mediaMap.get(key) || null, null)

  return buildArticle({
    id: tweet.id,
    text: tweet.text,
    screen: author.username,
    name: author.name,
    profileImageUrl: author.profileImageUrl,
    verified: author.verified,
    lang: tweet.lang,
    createdAt: tweet.created_at,
    imageUrl,
    metrics: {
      like: tweet.public_metrics?.like_count,
      repost: tweet.public_metrics?.retweet_count,
      reply: tweet.public_metrics?.reply_count,
      quote: tweet.public_metrics?.quote_count
    }
  })
}

async function fetchQueryApi (client, query, limit) {
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
      results.push(transformApiTweet(tweet, userMap, mediaMap))
    }
  } catch (err) {
    console.error(`  Error: ${err.message}`)
  }

  const dur = ((Date.now() - start) / 1000).toFixed(2)
  console.log(`  Fetched: ${results.length} tweets (${dur}s)`)
  return results
}

// ─── Browser backend ────────────────────────────────────────────────

let puppeteerBrowser = null
let puppeteerPage = null

async function getPuppeteerPage (headless) {
  if (puppeteerPage) return puppeteerPage

  let puppeteer
  try {
    puppeteer = (await import('puppeteer')).default
  } catch {
    throw new Error('Puppeteer not installed. Run: yarn add -D puppeteer')
  }

  puppeteerBrowser = await puppeteer.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage'
    ],
    defaultViewport: null
  })

  puppeteerPage = await puppeteerBrowser.newPage()
  return puppeteerPage
}

async function closePuppeteer () {
  if (puppeteerBrowser) {
    try { await puppeteerBrowser.close() } catch { /* ignore */ }
    puppeteerBrowser = null
    puppeteerPage = null
  }
}

function sleep (ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function waitForEnter (prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => {
    rl.question(prompt, () => {
      rl.close()
      res()
    })
  })
}

async function manualLogin (page) {
  console.log('\n── Opening x.com/login...')
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })
  await waitForEnter(LOGIN_PROMPT)
}

/**
 * Recursively find every { __typename: 'Tweet', rest_id } node, deduped by id.
 * Refuses to descend into known quote/retweet keys so only top-level search
 * results are collected (not the tweets they reference).
 */
function walkForTweets (node, out) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walkForTweets(item, out)
    return
  }
  if (node.__typename === 'Tweet' && node.rest_id) {
    if (!out.has(node.rest_id)) out.set(node.rest_id, node)
    return
  }
  for (const key of Object.keys(node)) {
    if (NESTED_TWEET_KEYS.has(key)) continue
    walkForTweets(node[key], out)
  }
}

function transformBrowserTweet (raw) {
  const id = raw.rest_id
  const userResult = raw.core?.user_results?.result || {}
  const userLegacy = userResult.legacy || {}
  const verified = Boolean(userResult.is_blue_verified || userLegacy.verified)

  // Long tweets ("notes") expose full text only at note_tweet.note_tweet_results
  const noteTweetText = raw.note_tweet?.note_tweet_results?.result?.text
  const text = noteTweetText || raw.legacy?.full_text || ''

  const createdRaw = raw.legacy?.created_at
  const createdAt = createdRaw ? new Date(createdRaw).toISOString() : null

  const mediaList = raw.legacy?.extended_entities?.media || raw.legacy?.entities?.media || []
  const photo = mediaList.find(m => m.type === 'photo')
  const imageUrl = photo?.media_url_https || null

  return buildArticle({
    id,
    text,
    screen: userLegacy.screen_name,
    name: userLegacy.name,
    profileImageUrl: userLegacy.profile_image_url_https,
    verified,
    lang: raw.legacy?.lang,
    createdAt,
    imageUrl,
    metrics: {
      like: raw.legacy?.favorite_count,
      repost: raw.legacy?.retweet_count,
      reply: raw.legacy?.reply_count,
      quote: raw.legacy?.quote_count
    }
  })
}

/**
 * Attaches a response listener that collects tweets across the page's lifetime.
 * Returns the shared Map plus a detach() to clean up. Fresh collector per
 * query keeps results scoped — late responses from a previous query land in
 * a detached listener and are discarded.
 */
function attachTweetCollector (page) {
  const collected = new Map()
  let responseCount = 0

  const onResponse = async (response) => {
    const url = response.url()
    if (!url.includes(SEARCH_TIMELINE_MARKER)) return
    if (response.status() !== 200) return
    try {
      const body = await response.json()
      walkForTweets(body, collected)
      responseCount++
    } catch {
      /* response not JSON, aborted, or already consumed — ignore */
    }
  }

  page.on('response', onResponse)

  return {
    collected,
    stats: () => ({ responses: responseCount, tweets: collected.size }),
    detach: () => page.off('response', onResponse)
  }
}

async function scrollAndCollect (page, collector, limit) {
  let prevSize = collector.collected.size
  let noGrowth = 0

  for (let scroll = 0; scroll < MAX_SCROLLS_PER_QUERY; scroll++) {
    if (collector.collected.size >= limit) break

    await page.evaluate((fraction) => {
      window.scrollBy(0, window.innerHeight * fraction)
    }, SCROLL_FRACTION)
    await sleep(SCROLL_PAUSE_MS)

    const size = collector.collected.size
    if (size === prevSize) {
      noGrowth++
      if (noGrowth >= NO_GROWTH_SCROLL_LIMIT) break
    } else {
      noGrowth = 0
      prevSize = size
    }
  }
}

async function fetchQueryBrowser (page, query, limit) {
  console.log(`\n── Query: ${query.slice(0, 80)}...`)
  const start = Date.now()
  const collector = attachTweetCollector(page)

  try {
    await page.goto(SEARCH_URL(query), { waitUntil: 'domcontentloaded' })
    await sleep(NAV_SETTLE_MS)
    await scrollAndCollect(page, collector, limit)
  } catch (err) {
    console.error(`  Error: ${err.message}`)
  }

  const results = []
  for (const raw of collector.collected.values()) {
    if (results.length >= limit) break
    try {
      results.push(transformBrowserTweet(raw))
    } catch (err) {
      console.error(`  Transform error for tweet ${raw.rest_id}: ${err.message}`)
    }
  }

  collector.detach()
  const dur = ((Date.now() - start) / 1000).toFixed(2)
  const { responses } = collector.stats()
  console.log(`  Fetched: ${results.length} tweets from ${responses} responses (${dur}s)`)
  return results
}

// ─── Noise filter ───────────────────────────────────────────────────

function isNoiseTweet (article) {
  if (isNoiseArticle({ ...article, title: article.text })) return true
  const t = article.text.toLowerCase()
  if (t.includes('ufo catcher') || t.includes('ufo game')) return true
  return false
}

// ─── Main ───────────────────────────────────────────────────────────

async function main () {
  const opts = parseArgs()

  let apiClient = null
  let page = null

  if (opts.browser) {
    page = await getPuppeteerPage(opts.headless)
    await manualLogin(page)
  } else {
    const token = process.env.TWITTER_BEARER_TOKEN
    if (!token) {
      console.error('Missing TWITTER_BEARER_TOKEN environment variable (or pass --browser)')
      process.exit(1)
    }
    apiClient = new TwitterApi(token)
  }

  console.log('Backend:   ' + (opts.browser ? 'browser (puppeteer + manual login)' : 'api (twitter-api-v2)'))
  console.log('Queries:   ' + TWITTER_QUERIES.length)
  console.log('Per query: ' + opts.perq)
  console.log('Limit:     ' + opts.limit)
  console.log()

  const seen = new Set()
  const allArticles = []

  for (const query of TWITTER_QUERIES) {
    if (allArticles.length >= opts.limit) break

    const tweets = opts.browser
      ? await fetchQueryBrowser(page, query, opts.perq)
      : await fetchQueryApi(apiClient, query, opts.perq)

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
    await sleep(opts.browser ? QUERY_PAUSE_MS : API_QUERY_PAUSE_MS)
  }

  console.log('\nTotal after dedup: ' + allArticles.length)

  const trimmed = allArticles
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, opts.limit)

  mkdirSync(dirname(SOURCE_FILE), { recursive: true })

  const { merged } = mergeArticles(SOURCE_FILE, trimmed, {
    arrayField: 'articles',
    urlField: 'id',
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

  await closePuppeteer()
}

main().catch(async (err) => {
  console.error('\nTwitter fetch failed: ' + err.message)
  await closePuppeteer()
  process.exit(1)
})
