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
 *   node scraper.mjs --years 2026 --puppeteer           # bypass Cloudflare via headless Chrome
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
import { createWriteStream, createReadStream } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import nodeFetch from "node-fetch"
import { parser } from "stream-json"
import { streamArray } from "stream-json/streamers/stream-array.js"
import { streamValues } from "stream-json/streamers/stream-values.js"
import { pick } from "stream-json/filters/pick.js"
import { chain } from "stream-chain"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
// Persistent Chrome profile. A fresh (cookie-less) profile every launch reads
// as a brand-new bot, which is what makes Cloudflare hold the "Performing
// security verification" interstitial forever. Reusing one profile keeps the
// cf_clearance cookie between runs and looks like a returning human.
const PUPPETEER_PROFILE_DIR = path.join(SCRIPT_DIR, ".puppeteer-profile")

// Lazy-load Tor agent only when --tor is used
let torAgent = null
async function getTorAgent () {
  if (!torAgent) {
    const { SocksProxyAgent } = await import("socks-proxy-agent")
    torAgent = new SocksProxyAgent("socks5h://127.0.0.1:9050")
  }
  return torAgent
}

// Lazy-load Puppeteer only when --puppeteer is used
let puppeteerBrowser = null
let puppeteerPage = null

async function getPuppeteerPage () {
  if (puppeteerPage) return puppeteerPage

  // Two backends for getting a Chrome page past Cloudflare:
  //
  //   --connect  → ATTACH to a real Chrome you launched yourself with
  //                --remote-debugging-port and solved the challenge in by hand.
  //                Most robust: CF's own JS challenge only runs (shows the
  //                spinner, then redirects) in a genuine, human-driven browser;
  //                in a launched automation it never even starts. Once you've
  //                cleared it manually, CF trusts the session's cf_clearance
  //                cookie and won't re-challenge, so the walk just reuses it.
  //
  //   (default)  → LAUNCH via puppeteer-real-browser: rebrowser-puppeteer-core
  //                (patches the CDP Runtime.enable leak) driving system Chrome,
  //                with turnstile:true to auto-solve. Works only where CF still
  //                lets automation solve the challenge.
  if (opts.connect) {
    const cdpUrl = typeof opts.connect === "string" ? opts.connect : DEFAULT_CDP_URL
    let connect
    try {
      ({ connect } = await import("rebrowser-puppeteer-core"))
    } catch {
      throw new Error(
        "rebrowser-puppeteer-core not installed. Run: yarn add -D puppeteer-real-browser"
      )
    }
    log(`Puppeteer: attaching to existing Chrome at ${cdpUrl} ...`)
    try {
      puppeteerBrowser = await connect({ browserURL: cdpUrl, defaultViewport: null })
    } catch (err) {
      // eslint-disable-next-line preserve-caught-error
      throw new Error(
        `Could not attach to Chrome at ${cdpUrl}. Launch Chrome with remote ` +
        `debugging first (see "yarn chrome:debug"), open nuforc.org, and solve ` +
        `the Cloudflare challenge once. (${err.message})`
      )
    }
    // Every tab in the default context shares the cf_clearance cookie, so any
    // tab is already authenticated. Reuse an open nuforc tab if there is one,
    // otherwise open a fresh (still-authenticated) tab.
    const pages = await puppeteerBrowser.pages()
    puppeteerPage =
      pages.find(p => { try { return p.url().includes("nuforc.org") } catch { return false } }) ||
      await puppeteerBrowser.newPage()
    // Don't touch the UA — the real Chrome's own UA is exactly what CF issued
    // the clearance against; overriding it would invalidate the session.
  } else {
    let connect
    try {
      ({ connect } = await import("puppeteer-real-browser"))
    } catch {
      throw new Error(
        "puppeteer-real-browser not installed. Run: yarn add -D puppeteer-real-browser"
      )
    }

    const launchArgs = []
    // Chrome needs the proxy passed explicitly. Keep the socks5:// scheme (the
    // library's `proxy` option is http-oriented), so route Tor through args.
    if (opts.tor) {
      launchArgs.push("--proxy-server=socks5://127.0.0.1:9050")
    }

    const { browser, page } = await connect({
      headless: false,
      turnstile: true,
      args: launchArgs,
      // customConfig maps to chrome-launcher options. userDataDir persists the
      // cf_clearance cookie across runs, so repeat runs skip the challenge.
      customConfig: {
        userDataDir: PUPPETEER_PROFILE_DIR
      }
    })

    puppeteerBrowser = browser
    puppeteerPage = page

    // Only override Chrome's real UA if a genuine one was configured. Sending
    // the literal placeholder is an instant WAF red flag — let the visible
    // Chrome use its own legitimate UA. Mirrors the CF_CLEARANCE guard in
    // buildFetchOptions().
    if (USER_AGENT && USER_AGENT !== "PASTE_BROWSER_USER_AGENT_HERE") {
      await puppeteerPage.setUserAgent(USER_AGENT)
    }
  }
  await puppeteerPage.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://nuforc.org/subndx/?id=all"
  })

  // Warm up: hit the index page once so Cloudflare can issue clearance cookies
  const warmupUrl = "https://nuforc.org/subndx/?id=all"
  log(opts.connect
    ? "Puppeteer: reusing attached Chrome session (solve the challenge in that window if it appears)..."
    : "Puppeteer(real-browser): warming up (auto-solving Cloudflare Turnstile if present)...")
  try {
    await puppeteerPage.goto(warmupUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    })
  } catch (err) {
    // The interstitial redirect can interrupt navigation — the page may still
    // hold the challenge HTML, so don't bail here. The challenge gate below is
    // the real check.
    debug(`Warmup navigation note: ${err.message}`)
  }

  // Do NOT start fetching IDs until the "Performing security verification"
  // interstitial actually clears. The old fixed 8s sleep let the ID walk begin
  // mid-challenge — every probe then got the interstitial HTML (no "Occurred")
  // and was misread as a 404, collapsing the binary search.
  try {
    await waitForChallengeCleared(puppeteerPage, warmupUrl, 120000)
    log("Puppeteer: ready — security verification cleared")
  } catch (err) {
    // eslint-disable-next-line preserve-caught-error
    throw new Error(
      `NUFORC "Performing security verification" page did not clear within 120s. ` +
      `Solve it in the open Chrome window, then re-run. (${err.message})`
    )
  }

  return puppeteerPage
}

async function closePuppeteer () {
  if (puppeteerBrowser) {
    try {
      // --connect attaches to a browser we didn't launch — detach and leave it
      // running so the solved Cloudflare session survives for the next run.
      // --puppeteer launched it, so close it.
      if (opts.connect) {
        await puppeteerBrowser.disconnect()
      } else {
        await puppeteerBrowser.close()
      }
    } catch { /* ignore */ }
    puppeteerBrowser = null
    puppeteerPage = null
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = "https://nuforc.org"
const DETAIL_URL = (id) => `${BASE_URL}/sighting/?id=${id}`
const RAW_CACHE_FILE = "nuforc_raw_cache.json"
const DEFAULT_OUTPUT = "nuforc_output.json"
const DEFAULT_DELAY_MS = 1000
const CONSECUTIVE_MISS_LIMIT = 100
const RESUME_LOOK_AHEAD = 50
const PAST_RANGE_LIMIT = 25

// Paste cf_clearance cookie value from your browser (DevTools → Application → Cookies → nuforc.org)
// Token is bound to USER_AGENT below — both must come from the same browser session.
// Typically valid ~24h. Used only when --puppeteer is NOT set.
const CF_CLEARANCE = "PASTE_CF_CLEARANCE_HERE"
const USER_AGENT = "PASTE_BROWSER_USER_AGENT_HERE"

// Default CDP endpoint for --connect (attach to a Chrome started with
// --remote-debugging-port=9222). Override with `--connect http://host:port`.
const DEFAULT_CDP_URL = "http://127.0.0.1:9222"

// ─── CLI ─────────────────────────────────────────────────────────────────────

const program = new Command()
program
  .name("nuforc-scraper")
  .description("Scrape NUFORC UFO sighting reports with caching & schema transform")
  .option("--cache", "Use cached raw data instead of scraping")
  .option("--schema <file>", "JSON schema file for output transformation")
  .option("--output <file>", "Output file path", DEFAULT_OUTPUT)
  .option("--raw-file <file>", "Raw cache file path", RAW_CACHE_FILE)
  .option("--start-id <n>", "Sighting ID to start walking backwards from", v => parseInt(v, 10))
  .option("--years <range>", "Year or year range (e.g. 2025, 2020-2026)")
  .option("--limit <n>", "Max number of records to collect", v => parseInt(v, 10))
  .option("--concurrency <n>", "Number of parallel requests (be polite)", v => parseInt(v, 10), 3)
  .option("--delay <ms>", "Delay between requests in ms", v => parseInt(v, 10), DEFAULT_DELAY_MS)
  .option("--miss-limit <n>", "Stop after N consecutive misses", v => parseInt(v, 10), CONSECUTIVE_MISS_LIMIT)
  .option("--resume", "Resume scraping — skip IDs already in raw cache")
  .option("--merge <file>", "Merge transformed output into this existing JSON file (creates backup)")
  .option("--merge-key <field>", "Field to deduplicate on when merging (dot notation for nested, e.g. 'id' or 'sighting_id')", "id")
  .option("--merge-strategy <s>", "How to handle duplicates: 'keep-existing' or 'keep-new'", "keep-new")
  .option("--tor", "Route requests through Tor (socks5h://127.0.0.1:9050)")
  .option("--puppeteer", "Use headless Chrome (puppeteer) to bypass Cloudflare bot challenges — requires `puppeteer` package installed")
  .option("--puppeteer-headless", "Run puppeteer in headless mode (default: true)", true)
  .option("--connect [url]", "Attach to a Chrome you started with --remote-debugging-port (default http://127.0.0.1:9222) and reuse its manually-solved Cloudflare session instead of launching")
  .option("--verbose", "Verbose logging")
  .option("--past-range-limit <n>", "When --years is set, stop after N consecutive records older than the range", v => parseInt(v, 10), PAST_RANGE_LIMIT)
  .parse()

const opts = program.opts()

// ─── Utilities ───────────────────────────────────────────────────────────────

function log (...args) {
  console.log(`[${new Date().toISOString()}]`, ...args)
}

function debug (...args) {
  if (opts.verbose) console.log(`  [debug]`, ...args)
}

function sleep (ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseYearRange (rangeStr) {
  if (!rangeStr) return null
  const parts = rangeStr.split("-").map(Number)
  if (parts.length === 1) return { from: parts[0], to: parts[0] }
  return { from: parts[0], to: parts[1] }
}

function yearFromOccurred (occurred) {
  if (!occurred) return null
  const match = occurred.match(/(\d{4})/)
  return match ? parseInt(match[1]) : null
}

function matchesYearFilter (record, yearRange) {
  if (!yearRange) return true
  const year = yearFromOccurred(record.occurred)
  if (!year) return true
  return year >= yearRange.from && year <= yearRange.to
}

// ─── Streaming JSON I/O ──────────────────────────────────────────────────────
//
// V8 has a hard ~512MB cap on individual string primitives. Any attempt to
// read or write a JSON file larger than that as a single string will throw
// "Invalid string length". At 150K+ records with long description text, both
// the raw cache (`nuforc_raw_cache.json`) and merge targets (`__sources/*.json`)
// routinely cross this threshold.
//
// All readers (`loadRawCache`, `loadJsonArray`) stream-parse with stream-json,
// emitting one record at a time — no intermediate full-file string.
// All writers (`writeJsonArrayStream`, `saveRawCache`) write record-by-record
// directly to a file stream — compact JSON, no pretty-print, no buffering.
//
// The in-memory JS array of ~150K parsed objects is fine (V8 hidden classes
// compress object keys across records). Bump `--max-old-space-size=4096` on
// the node command line if heap pressure becomes an issue.

async function writeJsonArrayStream (filePath, records) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(filePath, { encoding: "utf-8" })
    stream.on("error", reject)
    stream.on("finish", resolve)
    stream.write("[\n")
    for (let i = 0; i < records.length; i++) {
      stream.write(JSON.stringify(records[i]))
      if (i < records.length - 1) stream.write(",\n")
    }
    stream.write("\n]\n")
    stream.end()
  })
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
//
// Dispatcher pattern: fetchPage and fetchWithRetry route through one of two
// backends (HTTP via node-fetch, or headless Chrome via puppeteer) chosen by
// --puppeteer. Future backends (FlareSolverr, Playwright) plug in here.

async function buildFetchOptions () {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml",
    Referer: "https://nuforc.org/subndx/?id=all"
  }
  if (CF_CLEARANCE && CF_CLEARANCE !== "PASTE_CF_CLEARANCE_HERE") {
    headers.Cookie = `cf_clearance=${CF_CLEARANCE}`
  }
  const fetchOpts = { headers }
  if (opts.tor) {
    fetchOpts.agent = await getTorAgent()
  }
  return fetchOpts
}

// NUFORC sits behind Wordfence, which serves rate-limit notices as HTTP 503
// with HTML body text like "Exceeded the maximum number of requests per
// minute for crawlers." Detect both the status and the body so we can apply
// a long exponential backoff instead of the generic-error 1s one.
const RATE_LIMIT_PATTERNS = [
  /exceeded the (?:maximum )?number of requests per minute/i,
  /requests per minute for crawlers/i,
  /access to this site has been limited/i,
  /wordfence/i
]

function isRateLimitBody (html) {
  if (!html || html.length > 20000) return false // real sighting pages are larger
  return RATE_LIMIT_PATTERNS.some(re => re.test(html))
}

class RateLimitError extends Error {
  constructor (url) {
    super(`Rate-limited by NUFORC for ${url}`)
    this.name = "RateLimitError"
  }
}

// ─── Cloudflare Challenge Detection ──────────────────────────────────────────
//
// NUFORC sits behind Cloudflare's managed challenge, which serves a black
// interstitial titled "nuforc.org" with the body text "Performing security
// verification" (older variant: "Just a moment"). The real page only appears
// once the challenge clears. Any fetch made before it clears returns the
// interstitial HTML — no "Occurred" field — which the ID walk misreads as a 404.
const CHALLENGE_MARKERS = [
  "Just a moment",
  "Performing security verification",
  "Verifying you are human",
  "needs to review the security of your connection"
]

function isChallengeHtml (html) {
  if (!html) return false
  return CHALLENGE_MARKERS.some(m => html.includes(m))
}

/**
 * Block until the Cloudflare interstitial clears on the current puppeteer page.
 * Resolves with the post-challenge HTML; throws if it never clears in `timeout`.
 * Because Chrome launches non-headless, the user can also solve it by hand.
 */
async function waitForChallengeCleared (page, url, timeout = 30000) {
  const html = await page.content()
  if (!isChallengeHtml(html)) return html

  debug(`Puppeteer: challenge detected on ${url}, waiting for resolution...`)
  await page.waitForFunction(
    (markers) => {
      const title = document.title || ""
      const body = document.body ? document.body.innerText : ""
      return !markers.some(m => title.includes(m) || body.includes(m))
    },
    { timeout, polling: 500 },
    CHALLENGE_MARKERS
  )
  return page.content()
}

async function fetchPagePuppeteer (url) {
  const page = await getPuppeteerPage()
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
  const status = response ? response.status() : 0

  // If a Cloudflare challenge is showing, wait for the real content to appear.
  let html
  try {
    html = await waitForChallengeCleared(page, url)
  } catch {
    throw new Error(`HTTP challenge unresolved for ${url}`)
  }

  // Body-text check runs first: Wordfence may serve 200 or 503 depending on
  // its config, but the body is always recognizable.
  if (isRateLimitBody(html)) throw new RateLimitError(url)
  if (status === 429 || status === 503) throw new RateLimitError(url)
  if (status >= 400) throw new Error(`HTTP ${status} for ${url}`)
  return html
}

async function fetchPageHttp (url) {
  const fetchOpts = await buildFetchOptions()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await nodeFetch(url, { ...fetchOpts, signal: controller.signal })
    // 429/503 + Wordfence body-text route through RateLimitError so the
    // retry loop applies the long backoff rather than the generic 1s one.
    if (res.status === 429 || res.status === 503) {
      throw new RateLimitError(url)
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const html = await res.text()
    if (isRateLimitBody(html)) throw new RateLimitError(url)
    return html
  } finally {
    clearTimeout(timeout)
  }
}

// Both --puppeteer (launch) and --connect (attach) drive a real Chrome, so
// they share the puppeteer fetch backend. Everything else uses node-fetch.
function usePuppeteerBackend () {
  return opts.puppeteer || opts.connect
}

async function fetchPage (url) {
  return usePuppeteerBackend() ? fetchPagePuppeteer(url) : fetchPageHttp(url)
}

async function fetchWithRetry (url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (usePuppeteerBackend()) return await fetchPagePuppeteer(url)

      const fetchOpts = await buildFetchOptions()
      const res = await nodeFetch(url, fetchOpts)
      if (res.status === 429 || res.status === 503) {
        const wait = Math.pow(2, attempt) * 3000
        log(`Rate limited (${res.status}), backing off ${wait}ms...`)
        await sleep(wait)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      if (isRateLimitBody(html)) throw new RateLimitError(url)
      return html
    } catch (err) {
      if (attempt === retries) throw err
      // Wordfence rate-limit bans run 30–60 min, so escalate aggressively.
      // 30s → 60s → 120s gives transient throttles room to recover; if it's
      // a real ban the retry loop exhausts and the URL is marked errored.
      const isRateLimit = err instanceof RateLimitError
      const wait = isRateLimit
        ? Math.pow(2, attempt) * 30000
        : Math.pow(2, attempt) * 1000
      if (isRateLimit) {
        log(`Rate limited by Wordfence, backing off ${Math.round(wait / 1000)}s (attempt ${attempt}/${retries - 1})...`)
      } else {
        debug(`Attempt ${attempt} failed for ${url}: ${err.message}, retrying in ${wait}ms`)
      }
      await sleep(wait)
    }
  }
}

// ─── Detail Page Parser ─────────────────────────────────────────────────────

/**
 * Clean residual JS/CSS/HTML artifacts from extracted text.
 * Handles bare CSS/JS without wrapping <style>/<script> tags.
 *
 * Strategy: line-by-line filtering first (catches full lines of CSS/JS),
 * then inline cleanup (catches fragments within mixed lines).
 */
function sanitizeText (text) {
  if (!text) return null

  // ── Phase 1: Line-level filtering ────────────────────────────────────
  // Remove entire lines that are clearly CSS, JS, or artifacts

  const lines = text.split("\n")
  const cleaned = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      cleaned.push("")
      continue
    }

    // CSS: selector { ... } on one line (handles nested braces too)
    if (/^[.#]?[\w-]+[^{]*\{.*\}\s*$/.test(trimmed) && !/^[A-Z]/.test(trimmed)) continue
    // CSS: @-rules on one line: @media (...) { ... }  @keyframes { ... }
    if (/^@[\w-]+[\s(].*\{.*\}\s*$/.test(trimmed)) continue
    // CSS: @-rule opening: @media (max-width: 768px) {
    if (/^@[\w-]+\s*(?:\([^)]*\))?\s*\{?\s*$/.test(trimmed)) continue
    // CSS: opening selector {
    // eslint-disable-next-line no-useless-escape
    if (/^[.#][\w->+~\s,.:#\[\]='"*]+\{\s*$/.test(trimmed)) continue
    // CSS: closing }
    if (/^\}?\s*\}\s*;?\s*$/.test(trimmed)) continue
    // CSS: property: value;
    if (/^(?:margin|padding|width|height|display|position|overflow|float|clear|color|font(?:-\w+)?|background(?:-\w+)?|border(?:-\w+)?|text-(?:align|decoration|transform|indent|overflow|shadow)|line-height|z-index|opacity|visibility|cursor|content|top|right|bottom|left|max-width|min-width|max-height|min-height|box-sizing|flex(?:-\w+)?|grid(?:-\w+)?|transform|transition|animation|vertical-align|white-space|word-break|list-style|outline|appearance|resize|object-fit|pointer-events|src|fill|stroke)\s*:[^]*;?\s*$/i.test(trimmed)) continue
    // CSS: !important or lone units
    if (/^\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|pt)\s*;?\s*$/.test(trimmed)) continue
    // CSS: standalone selector (e.g. .vjs-big-play-button)
    if (/^[.#][\w-]+(?:\s*[,>+~]\s*[.#]?[\w-]+)*\s*$/.test(trimmed)) continue

    // JS: var/let/const/function declarations
    if (/^\s*(?:var|let|const|function)\s+/.test(trimmed)) continue
    // JS: window./document./console. calls
    if (/^\s*(?:window|document|console|navigator|self)\./.test(trimmed)) continue
    // JS: method calls like player.ready(, $.fn., etc
    if (/^\s*\w+\.\w+\s*\(/.test(trimmed)) continue
    // JS: closing }); or })
    if (/^[}\]);,]+\s*$/.test(trimmed)) continue
    // JS: arrow functions
    if (/^\s*(?:\w+|\([^)]*\))\s*=>\s*/.test(trimmed)) continue
    // JS: if/else/for/while/return/new/typeof
    if (/^\s*(?:if|else|for|while|return|new|typeof|try|catch|throw|switch|case|break|continue)\s*[\s({]/.test(trimmed)) continue
    // JS: assignment to DOM: something.style.x = ...
    if (/\.\s*style\s*\./.test(trimmed)) continue
    // JS: property assignments: vid.src = '...', el.width = 640
    if (/^\s*\w+\.\w+\s*=\s*.+;?\s*$/.test(trimmed) && !/[.]\s*$/.test(trimmed)) continue
    // JS: common event/DOM methods
    if (/(?:addEventListener|removeEventListener|querySelector|getElementById|getElementsBy|createElement|appendChild|innerHTML|className|classList|setAttribute)\s*[.(]/.test(trimmed)) continue
    // JS: object literal properties — key: "string", key: number, key: true/false
    if (/^\s*[\w$]+\s*:\s*(?:["'][^"']*["']|\d+(?:\.\d+)?|true|false|null|undefined|\[.*\]|\{.*\})\s*,?\s*$/.test(trimmed)) continue

    // Media: videojs, flowplayer, jwplayer, MusePlayer, etc
    if (/\b(?:videojs|flowplayer|jwplayer|plyr|hls\.js|dash\.js|wistia|brightcove|MusePlayer|EmbedPlayer|MediaElement|Kaltura|SproutVideo)\b/i.test(trimmed)) continue
    // Media: player operations
    if (/\bplayer\b.*(?:setup|init|ready|play|pause|src|load|dispose|on|off)\s*\(/i.test(trimmed)) continue

    // URLs to assets
    if (/^https?:\/\/\S+\.(?:js|css|mp4|webm|m3u8|woff|ttf|svg)\b/.test(trimmed)) continue
    // Data URIs
    if (/^data:/.test(trimmed)) continue

    // HTML attributes orphaned: class="..." id="..."
    if (/^(?:class|id|style|data-[\w-]+|aria-[\w-]+)\s*=\s*["']/.test(trimmed)) continue

    cleaned.push(line)
  }

  // ── Phase 2: Inline cleanup ──────────────────────────────────────────
  // Remove fragments embedded within otherwise good lines

  let result = cleaned.join("\n")

  result = result
    // Inline CSS properties: display: block; within a sentence
    .replace(/\b(?:display|margin|padding|width|height|position|overflow|opacity|visibility|z-index|float|clear)\s*:\s*[^;.!?\n]+;/gi, "")
    // !important
    .replace(/!important/gi, "")
    // url() references
    .replace(/url\s*\([^)]*\)/gi, "")
    // Inline JS: window.xxx, document.xxx
    .replace(/(?:window|document|console)\.\w[\w.]*/g, "")
    // HTML entities
    .replace(/&(?:amp|lt|gt|quot|nbsp|#\d+);/g, " ")
    // HTML comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Stray braces
    .replace(/[{}]/g, "")
    // Stray semicolons at start/end of line
    .replace(/^\s*;+\s*$/gm, "")

    // ── Whitespace normalization ──────────────────────────────────────
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+$/gm, "")
    .trim()

  if (result.length < 3) return null
  return result
}

/**
 * Sanitize all text fields in a raw record.
 * Called in --cache mode to clean previously scraped dirty data.
 */
const TEXT_FIELDS_TO_SANITIZE = ["summary", "description", "location_details"]

function sanitizeRecord (record) {
  const cleaned = { ...record }
  for (const field of TEXT_FIELDS_TO_SANITIZE) {
    if (cleaned[field] && typeof cleaned[field] === "string") {
      cleaned[field] = sanitizeText(cleaned[field])
    }
  }
  return cleaned
}

function parseDetailPage (html, sightingId) {
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

  // Extract media URLs before we strip them (some sightings have videos/images)
  const mediaUrls = []
  const mediaPattern = /<(?:video|source|iframe|a)\b[^>]*(?:src|href)=["']([^"']+\.(?:mp4|webm|m3u8|mov|jpg|jpeg|png|gif)(?:[^"']*)?)["'][^>]*>/gi
  let mediaMatch
  while ((mediaMatch = mediaPattern.exec(primaryHtml)) !== null) {
    mediaUrls.push(mediaMatch[1])
  }

  let summary = null
  let description = null

  const textHtml = primaryHtml
    // 1. Remove entire block elements + their content (script, style, video, iframe, etc.)
    .replace(/<(script|style|iframe|video|object|embed|noscript|svg|source|track)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Also catch self-closing/void versions: <iframe ... />, <source ... />
    .replace(/<(iframe|video|object|embed|source|track|link)\b[^>]*\/?>/gi, "")
    // 2. Convert <br> to newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // 3. Strip remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // 4. Decode HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")

  const lines = textHtml
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    // 5. Filter out lines that look like JS/CSS/HTML artifacts
    .filter((line) => {
      // CSS-like: selectors, properties, braces
      if (/^\s*[.#]?[\w-]+\s*\{/.test(line)) return false
      if (/^\s*[\w-]+\s*:\s*[^;]+;\s*$/.test(line) && !line.includes(":") === false && /\{|\}|;/.test(line) && !/^\w+:/.test(line)) return false
      if (/^\s*\}\s*$/.test(line)) return false
      // JS-like: var/let/const/function declarations, common JS patterns
      if (/^\s*(var|let|const|function|if|else|for|while|return|window\.|document\.|new |typeof )\b/.test(line)) return false
      // URL-like standalone lines (src references)
      if (/^https?:\/\/\S+\.(js|css|mp4|webm|m3u8)/.test(line)) return false
      // Common media player / embed artifacts
      if (/^(videojs|flowplayer|jwplayer|wistia|vimeo|youtube)/i.test(line)) return false
      if (/player\.(setup|play|on|ready|src)\s*\(/i.test(line)) return false
      // Data URIs, base64
      if (/^data:/.test(line)) return false
      // Very short lines that are just punctuation/code fragments
      if (/^[{}();,[\]]+$/.test(line)) return false
      return true
    })

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
      summary = sanitizeText(contentLines[0])
      description = contentLines.length > 1
        ? sanitizeText(contentLines.slice(1).join("\n"))
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
    media_urls: mediaUrls.length > 0 ? mediaUrls : null,
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

function transformRecord (raw, schema) {
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

function resolveMapping (raw, mappingStr) {
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

function applyDirective (name, arg, value) {
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

function splitValue (value, delimiter) {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value
  return String(value)
    .split(delimiter)
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeDate (value, suffix) {
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

function transformAllRecords (records, schema) {
  return records.map((raw) => transformRecord(raw, schema))
}

// ─── Raw cache I/O ──────────────────────────────────────────────────────────
//
// Format: `{ "metadata": { ... }, "records": [ ... ] }`
// Both reads and writes stream — see note above `writeJsonArrayStream`.

async function loadRawCache (filePath) {
  try {
    await fs.access(filePath)
  } catch (err) {
    if (err.code === "ENOENT") return null
    throw err
  }

  let metadata = {}
  const records = []

  // Stream metadata — it's small, but streaming it avoids a second full-file
  // read. `pick` + `streamValues` assembles the metadata object and emits it
  // as a single data event.
  await new Promise((resolve, reject) => {
    const pipeline = chain([
      createReadStream(filePath),
      parser(),
      pick({ filter: "metadata" }),
      streamValues()
    ])
    pipeline.on("data", ({ value }) => { metadata = value })
    pipeline.on("end", resolve)
    pipeline.on("error", reject)
  })

  // Stream records one at a time — this is the large array that would bust
  // V8's string cap if read via fs.readFile.
  await new Promise((resolve, reject) => {
    const pipeline = chain([
      createReadStream(filePath),
      parser(),
      pick({ filter: "records" }),
      streamArray()
    ])
    pipeline.on("data", ({ value }) => records.push(value))
    pipeline.on("end", resolve)
    pipeline.on("error", reject)
  })

  return { metadata, records }
}

async function saveRawCache (filePath, data) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(filePath, { encoding: "utf-8" })
    stream.on("error", reject)
    stream.on("finish", resolve)
    // Metadata is small — stringify safely. Records stream one at a time.
    stream.write(`{"metadata":${JSON.stringify(data.metadata)},"records":[\n`)
    for (let i = 0; i < data.records.length; i++) {
      stream.write(JSON.stringify(data.records[i]))
      if (i < data.records.length - 1) stream.write(",\n")
    }
    stream.write("\n]}\n")
    stream.end()
  })
}

// ─── Merge Utilities ────────────────────────────────────────────────────────
//
// --merge <file> merges transformed output into an existing JSON array file.
//
// Flow:
//   1. Read existing merge destination → existingRecords[]  (streamed)
//   2. Create hidden backup:  dir/.filename.backup.json
//   3. Deduplicate by --merge-key (default: "id")
//   4. Write merged result to the merge destination              (streamed)
//
// The --output file still gets written as-is (just the new transformed data).
// The --merge file gets the combined set.

/**
 * Resolve a dot-notation key from an object.
 *   getByPath({ a: { b: 1 } }, "a.b") → 1
 *   getByPath({ id: 5 }, "id") → 5
 */
function getByPath (obj, keyPath) {
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
async function createBackup (filePath) {
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
function mergeRecords (existingRecords, newRecords, mergeKey, strategy) {
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
 * Load a JSON array file via stream-parse.
 *
 * Returns null if the file doesn't exist, [] if it's empty, otherwise the
 * array. Non-array root elements throw — previously we wrapped them in a
 * single-element array, but that masks real data corruption and the merge
 * targets in this project are always arrays (written by writeJsonArrayStream).
 */
async function loadJsonArray (filePath) {
  try {
    await fs.access(filePath)
  } catch (err) {
    if (err.code === "ENOENT") return null
    throw err
  }

  const records = []
  await new Promise((resolve, reject) => {
    const pipeline = chain([
      createReadStream(filePath),
      parser(),
      streamArray()
    ])
    pipeline.on("data", ({ value }) => records.push(value))
    pipeline.on("end", resolve)
    pipeline.on("error", reject)
  })
  return records
}

function buildCacheData (records, yearRange, collected, notFound, outOfRange) {
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

async function probeId (id) {
  try {
    const text = await fetchPage(DETAIL_URL(id))
    return text.includes("Occurred")
  } catch (err) {
    debug(`Probe ${id} failed: ${err.message}`)
    return false
  }
}

async function discoverLatestId (cachedMax = 0) {
  let lo = Math.max(1, cachedMax)
  let hi = Math.max(cachedMax + 5000, 200000)
  let lastValid = null

  log(`Binary search for latest sighting ID (range ${lo}–${hi})...`)

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

async function runScrapeMode () {
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
  log(`Puppeteer: ${opts.puppeteer ? "enabled" : "disabled"}`)
  if (opts.connect) log(`Connect: attaching to Chrome at ${typeof opts.connect === "string" ? opts.connect : DEFAULT_CDP_URL}`)
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
  let cachedMax = 0
  if (opts.resume) {
    existingCache = await loadRawCache(opts.rawFile)
    if (existingCache) {
      for (const r of existingCache.records) {
        existingIds.add(r._sighting_id)
        if (r._sighting_id > cachedMax) cachedMax = r._sighting_id
      }
      log(`Resume: ${existingIds.size} records already cached (max ID: ${cachedMax})`)
    }
  }

  // Discover start ID — derive from cache only when not explicitly given
  let startId = opts.startId
  if (opts.resume && cachedMax > 0 && !startId) {
    startId = cachedMax + RESUME_LOOK_AHEAD
    log(`Resume: auto-starting from ${startId} (cachedMax=${cachedMax} + lookAhead=${RESUME_LOOK_AHEAD})`)
  }
  if (!startId) {
    log("No --start-id given, probing for latest sighting ID...")
    startId = await discoverLatestId(cachedMax)
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
    // Resume safety: stop once walk reaches cached territory.
    // Must be before batch building — otherwise the boundary batch
    // gets built then dropped.
    if (opts.resume && cachedMax > 0 && currentId <= cachedMax) {
      log(`Reached cached territory (currentId=${currentId} ≤ cachedMax=${cachedMax}) — stopping.`)
      break
    }

    const batchIds = []
    for (let i = 0; i < concurrency && (currentId - i) > 0; i++) {
      const id = currentId - i
      if (!existingIds.has(id)) {
        batchIds.push(id)
      }
    }
    currentId -= concurrency

    if (batchIds.length === 0) {
      // Cached IDs prove the ID space is populated — these aren't misses
      consecutiveMisses = 0
      consecutivePastRange = 0
      continue
    }

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

    // Early stop: track records older than our target year range.
    // Only "ok" records carry signal — not_found/error batches are neutral
    // (we don't know what year those IDs were).
    if (yearRange && collected > 0) {
      const okCount = batchResults.filter(r => r.status === "ok").length
      if (okCount > 0) {
        if (batchPastRange === okCount) {
          // Every successful record in this batch was older than our range
          consecutivePastRange += batchPastRange
        } else {
          // At least one record landed in range — we haven't passed yet
          consecutivePastRange = 0
        }
      }
      // okCount === 0 → leave counter unchanged (no signal either way)
    }
    if (consecutivePastRange >= opts.pastRangeLimit) {
      log(`${consecutivePastRange} consecutive records before ${yearRange.from} — stopping early.`)
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

async function runCacheMode () {
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

  // Sanitize text fields (cleans dirty data from previously scraped records)
  log(`Sanitizing text fields...`)
  records = records.map(sanitizeRecord)

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
  await writeJsonArrayStream(opts.output, outputRecords)
  log(`✓ Saved ${outputRecords.length} transformed records to ${opts.output}`)

  // ── Merge ──────────────────────────────────────────────────────────────
  if (opts.merge) {
    log("")
    log(`Merging into ${opts.merge}...`)

    const existingRecords = await loadJsonArray(opts.merge)

    if (existingRecords === null) {
      // Merge target doesn't exist yet — just write the output directly
      log(`Merge target does not exist — creating ${opts.merge}`)
      await fs.mkdir(path.dirname(opts.merge), { recursive: true })
      await writeJsonArrayStream(opts.merge, outputRecords)
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

      await writeJsonArrayStream(opts.merge, merged)

      log(`✓ Merged into ${opts.merge}`)
      log(`  Previously: ${stats.kept} records`)
      log(`  Added: ${stats.added} new`)
      log(`  Updated: ${stats.updated} (strategy: ${opts.mergeStrategy})`)
      log(`  Total: ${merged.length} records`)
    }
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

async function main () {
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
  } finally {
    await closePuppeteer()
  }
}

main()
