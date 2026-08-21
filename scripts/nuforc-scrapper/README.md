# NUFORC Scraper

Scrapes UFO sighting reports from [nuforc.org](https://nuforc.org). Outputs a raw JSON cache, then lets you reshape that cache into any structure via schema files — without re-scraping.

## How it works

```
Scrape mode          Cache mode (--cache)
─────────────        ───────────────────────────────────────────────
Walk IDs backwards   Raw cache ──→ schema transform ──→ output.json
  ↓                                                  ↘
Detail pages                                    --merge destination
  ↓                                             (backup created)
Raw cache (JSON)
```

## Setup

```bash
yarn install   # installs puppeteer-real-browser (used for the Cloudflare bypass)
```

The `--connect` and `--puppeteer` flows drive your **system Google Chrome**, so Chrome must be installed. Cache/merge modes (`--cache`) need neither Chrome nor network.

## Quick start

```bash
# 1. Fetch 2026 sightings — nuforc.org is behind Cloudflare, so use the
#    2-step "connect" flow (see "Getting past Cloudflare" below):
yarn chrome:debug                 # opens Chrome — solve the challenge once, leave it open
yarn scrape:nuforc:2026:connect   # in a second terminal — attaches and scrapes

# 2. Transform cached data with a schema (no network)
node scraper.mjs --cache --schema schemas/minimal.json

# 3. Transform + merge into an existing dataset (no network)
node scraper.mjs --cache --schema schemas/huggingface.json --output nuforc_scraped.json --merge __sources/nuforc.json
```

## Getting past Cloudflare

nuforc.org sits behind a Cloudflare **"Performing security verification"** challenge. A plain HTTP request gets a `403`, and a normally-automated Chrome (`--puppeteer`) is detected and held on that page forever. The reliable way is to solve the challenge **once by hand** in a real Chrome, then have the scraper **attach** to that browser with `--connect`.

### The simple 2-step flow (recommended)

**Terminal 1 — open a real Chrome and solve the challenge:**

```bash
yarn chrome:debug
```

This opens Google Chrome (with remote debugging on port `9222`) at the sightings page. Wait for the Cloudflare spinner to finish and the sightings list to load, then **leave the window open**.

**Terminal 2 — scrape by attaching to that Chrome:**

```bash
yarn scrape:nuforc:2026:connect
```

The scraper reuses the already-solved session, so Cloudflare never re-challenges. When it finishes it leaves Chrome open — the next run reuses the same clearance (re-solve only if you closed the window or it expired, ~a day later).

> Keep `--concurrency 1` in connect/puppeteer mode: it drives a single browser tab.

If you don't use the yarn scripts, the equivalent is:

```bash
# Terminal 1: launch Chrome with remote debugging (macOS path shown)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir=scripts/nuforc-scrapper/.chrome-debug-profile \
  "https://nuforc.org/subndx/?id=all"

# Terminal 2: attach and scrape
node scraper.mjs --resume --connect --years 2026-2026 \
  --start-id 199767 --concurrency 1 --delay 3000 --past-range-limit 25
```

### Fully automated (may or may not work)

```bash
yarn scrape:nuforc:2026:2026
```

This launches Chrome via [`puppeteer-real-browser`](https://www.npmjs.com/package/puppeteer-real-browser) and tries to auto-solve the Turnstile widget. If Cloudflare has tightened detection it can hang on the verification page — fall back to the `--connect` flow above.

### Backends at a glance

| Flag | What it does | When to use |
|---|---|---|
| _(none)_ | Plain HTTP via node-fetch | Only works if Cloudflare isn't challenging (rare) |
| `--connect [url]` | Attaches to a Chrome you solved by hand (default `http://127.0.0.1:9222`) | **Recommended** — most reliable |
| `--puppeteer` | Launches Chrome + auto-solves Turnstile | Try for hands-off runs; falls back to `--connect` |
| `--tor` | Routes through Tor | Rarely works — Cloudflare blocks Tor exit IPs |

## Scrape mode

Walks backwards from a sighting ID, fetching each detail page from nuforc.org. Saves everything to a single raw JSON cache file.

```bash
# Scrape year range with known start ID
node scraper.mjs --start-id 196128 --years 2026

# Auto-discover the latest ID (binary search, ~18 probes)
node scraper.mjs --years 2026

# Test with a small batch
node scraper.mjs --start-id 196128 --years 2026 --limit 10 --verbose

# Resume an interrupted scrape (merges with existing cache)
node scraper.mjs --resume --start-id 194883 --years 2026

# Route through Tor
node scraper.mjs --start-id 196128 --years 2026 --tor
```

The scraper stops when it hits `--miss-limit` consecutive empty IDs (default 100), or when all recent records fall before your `--years` range.

## Cache mode (`--cache`)

Reads the raw cache, applies a schema, writes the output. No network requests. You can run this as many times as you want with different schemas.

```bash
# Output raw records as-is
node scraper.mjs --cache

# Apply a schema
node scraper.mjs --cache --schema schemas/full.json

# Different schema, different output
node scraper.mjs --cache --schema schemas/minimal.json --output sightings_compact.json

# Filter cached records by year
node scraper.mjs --cache --schema schemas/full.json --years 2026 --output uap_2026.json
```

## Merge (`--merge`)

Merges transformed output into an existing JSON file without losing data. Always creates a hidden backup first.

```bash
node scraper.mjs --cache --schema schemas/huggingface.json --output nuforc_scraped.json --merge __sources/nuforc.json
```

What happens:
1. Transforms raw cache → writes `nuforc_scraped.json` (just the new batch)
2. Reads `__sources/nuforc.json`
3. Backs up to `__sources/.nuforc.json.backup` (hidden, same dir)
4. Deduplicates by merge key, writes merged result back

If the merge target doesn't exist yet, it simply creates it.

```bash
# Custom dedup key (default is "id")
--merge-key sighting_id

# Nested key via dot notation
--merge-key event.id

# Keep existing records on conflict instead of overwriting
--merge-strategy keep-existing
```

## CLI arguments

| Flag | Description | Default |
|---|---|---|
| **Mode** | | |
| `--cache` | Use cached raw data instead of scraping | — |
| **Scrape options** | | |
| `--start-id <n>` | Sighting ID to walk backwards from. If omitted, auto-discovers via binary search | auto |
| `--years <range>` | Year or range: `2026` or `2020-2026` | all |
| `--limit <n>` | Max records to collect | ∞ |
| `--concurrency <n>` | Parallel requests (use `1` with `--connect`/`--puppeteer`) | `3` |
| `--delay <ms>` | Delay between requests | `1000` |
| `--miss-limit <n>` | Stop after N consecutive empty/out-of-range IDs | `100` |
| `--past-range-limit <n>` | With `--years`, stop after N consecutive records older than the range | `25` |
| `--resume` | Skip IDs already in the raw cache | — |
| `--connect [url]` | Attach to a Chrome started with `--remote-debugging-port` and reuse its solved Cloudflare session (see [Getting past Cloudflare](#getting-past-cloudflare)) | `http://127.0.0.1:9222` |
| `--puppeteer` | Launch Chrome via `puppeteer-real-browser` and auto-solve the Cloudflare challenge | off |
| `--tor` | Route through Tor (`socks5h://127.0.0.1:9050`) | off |
| **Output options** | | |
| `--schema <file>` | JSON schema file for transforming output | — |
| `--output <file>` | Output file path | `nuforc_output.json` |
| `--raw-file <file>` | Raw cache file path | `nuforc_raw_cache.json` |
| **Merge options** | | |
| `--merge <file>` | Merge output into this existing JSON file (creates backup) | — |
| `--merge-key <field>` | Dedup field, supports dot notation (`event.id`) | `id` |
| `--merge-strategy <s>` | `keep-new` or `keep-existing` on duplicates | `keep-new` |
| **General** | | |
| `--verbose` | Verbose logging | off |

## Schemas

A schema maps your desired output structure to raw cache fields.

### Raw cache fields

Every scraped record contains:

| Field | Example |
|---|---|
| `_sighting_id` | `196099` |
| `_source_url` | `https://nuforc.org/sighting/?id=196099` |
| `_scraped_at` | `2026-02-28T12:00:00.000Z` |
| `occurred` | `2026-02-14 21:40 Local` |
| `reported` | `2026-02-14 19:09 Pacific` |
| `posted` | `2026-02-27` |
| `duration` | `10 seconds` |
| `num_observers` | `1` |
| `location` | `Cinnaminson, NJ, USA` |
| `location_details` | `in my backyard` |
| `_city` | `Cinnaminson` |
| `_state` | `NJ` |
| `_country` | `USA` |
| `shape` | `Triangle` |
| `color` | `golden` |
| `estimated_size` | `20 feet` |
| `estimated_speed` | `30mph` |
| `viewed_from` | `Land` |
| `direction_from_viewer` | `east to west` |
| `angle_of_elevation` | `70` |
| `closest_distance` | `200 feet` |
| `characteristics` | `Made a sound, Animals reacted` |
| `summary` | `5 orange oblong orbs in a triangle formation` |
| `description` | `I saw a triangle formation of 5 roughly...` |

### Schema mapping syntax

```jsonc
{
  // Direct field
  "id": "_sighting_id",

  // Nested objects
  "location": {
    "city": "_city",
    "country": "_country"
  },

  // Default value (pipe)
  "shape": "shape | Unknown",

  // Fallback chain (double pipe)
  "text": "summary || description",

  // Literal string
  "source": "$literal:NUFORC"
}
```

### Type directives

Prefix a field reference with a directive to cast/transform:

| Directive | Effect | Example |
|---|---|---|
| `$int:` | Parse integer | `"$int:num_observers"` → `1` |
| `$float:` | Parse float | `"$float:angle_of_elevation"` → `70.0` |
| `$bool:` | Truthy check | `"$bool:description"` → `true` |
| `$split:` | Comma → array | `"$split:characteristics"` → `["Made a sound", "Animals reacted"]` |
| `$split(;):` | Custom delimiter | `"$split(;):field"` |
| `$upper:` | Uppercase | `"$upper:shape"` → `"TRIANGLE"` |
| `$lower:` | Lowercase | `"$lower:shape"` → `"triangle"` |
| `$trim:` | Trim whitespace | `"$trim:summary"` |
| `$date:` | Normalize to `YYYY-MM-DD HH:mm:ss` | `"$date:occurred"` → `"2026-02-14 21:40:00"` |
| `$date(Local):` | Normalize + suffix | `"$date(Local):occurred"` → `"2026-02-14 21:40:00 Local"` |

Directives combine with defaults: `"$int:num_observers | 0"`

### Example: minimal schema

```json
{
  "id": "_sighting_id",
  "date": "occurred",
  "city": "_city",
  "state": "_state",
  "country": "_country",
  "shape": "shape",
  "summary": "summary || description",
  "url": "_source_url"
}
```

### Included schemas

| File | Description |
|---|---|
| `schemas/full.json` | All fields, nested by category |
| `schemas/minimal.json` | Compact: id, date, location, shape, summary |
| `schemas/uap-timeline.json` | Designed for UAP timeline/monitoring apps |

## Typical workflow

```bash
# Scrape
node scraper.mjs --start-id 196128 --years 2026

# Quick look at raw data
node scraper.mjs --cache --output preview.json --years 2026

# Shape for your app
node scraper.mjs --cache --schema schemas/uap-timeline.json --output timeline.json

# Merge into your dataset
node scraper.mjs --cache --schema schemas/huggingface.json \
  --output nuforc_scraped.json \
  --merge __sources/nuforc.json \
  --merge-key sighting_id

# Later: scrape more, resume where you left off
node scraper.mjs --resume --start-id 196200 --years 2026

# Re-transform + merge (backup auto-created each time)
node scraper.mjs --cache --schema schemas/huggingface.json \
  --output nuforc_scraped.json \
  --merge __sources/nuforc.json \
  --merge-key sighting_id
```
