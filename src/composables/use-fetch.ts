/**
 * use-fetch — shared data-fetching infrastructure for source composables.
 *
 * Provides:
 *  - URL resolution (dataUrl)
 *  - Typed JSON fetching (fetchJson)
 *  - Sighting parsing + validation (parseSighting / parseChunk)
 *  - Chunk cache + dedup (createSourceLoader factory)
 *  - Year range helpers (getChunkKeysForRange, loadYearRange, loadProgressive)
 *  - Manifest query helpers (getAvailableYears, getYearCounts, etc.)
 */

import type { Sighting, YearChunkMeta } from '@/types'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '@/enums'

// ─── URL helpers ────────────────────────────────────────────────────

const DATA_DIR = 'data'

function resolveBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return base.endsWith('/') ? base : `${base}/`
}

export function dataUrl(filename: string): string {
  return `${resolveBaseUrl()}${DATA_DIR}/${filename}`
}

// ─── JSON fetch ─────────────────────────────────────────────────────

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} — ${url}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json') && !contentType.includes('text/')) {
    throw new Error(`Unexpected content-type "${contentType}" from ${url}`)
  }

  const text = await response.text()

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid JSON from ${url}`)
  }
}

// ─── Validation sets ────────────────────────────────────────────────

const VALID_SHAPES = new Set<string>(Object.values(SightingShape))
const VALID_STATUSES = new Set<string>(Object.values(SightingStatus))
const VALID_CONTINENTS = new Set<string>(Object.values(Continent))
const VALID_SOURCES = new Set<string>(Object.values(DataSourceId))

// ─── Sighting parser ────────────────────────────────────────────────

/**
 * Parse a raw JSON object into a validated Sighting.
 * @param raw  - Unknown JSON value
 * @param defaultSource - Fallback DataSourceId when raw.source is missing/invalid
 */
export function parseSighting(raw: unknown, defaultSource: DataSourceId): Sighting | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const id = typeof r.id === 'string' ? r.id : typeof r.id === 'number' ? String(r.id) : null
  if (!id) return null

  const occurredAt = typeof r.occurredAt === 'string' ? r.occurredAt : ''
  if (!occurredAt) return null

  const shape = typeof r.shape === 'string' && VALID_SHAPES.has(r.shape)
    ? (r.shape as SightingShape)
    : SightingShape.UNKNOWN

  const status = typeof r.status === 'string' && VALID_STATUSES.has(r.status)
    ? (r.status as SightingStatus)
    : SightingStatus.PENDING

  const continent = typeof r.continent === 'string' && VALID_CONTINENTS.has(r.continent)
    ? (r.continent as Continent)
    : Continent.AMERICAS

  const source = typeof r.source === 'string' && VALID_SOURCES.has(r.source)
    ? (r.source as DataSourceId)
    : defaultSource

  const coordinates = (
    typeof r.coordinates === 'object' &&
    r.coordinates !== null &&
    typeof (r.coordinates as Record<string, unknown>).lat === 'number' &&
    typeof (r.coordinates as Record<string, unknown>).lng === 'number'
  )
    ? { lat: (r.coordinates as { lat: number }).lat, lng: (r.coordinates as { lng: number }).lng }
    : null

  return {
    id,
    source,
    subSource: typeof r.subSource === 'string' ? r.subSource : undefined,
    occurredAt,
    reportedAt: typeof r.reportedAt === 'string' ? r.reportedAt : occurredAt,
    postedAt: typeof r.postedAt === 'string' ? r.postedAt : occurredAt,
    location: typeof r.location === 'string' ? r.location : '',
    shape,
    duration: typeof r.duration === 'string' ? r.duration : '',
    observers: typeof r.observers === 'number' ? r.observers : 0,
    summary: typeof r.summary === 'string' ? r.summary : '',
    description: typeof r.description === 'string' ? r.description : '',
    characteristics: Array.isArray(r.characteristics) ? r.characteristics : [],
    coordinates,
    region: typeof r.region === 'string' ? r.region : '',
    country: typeof r.country === 'string' ? r.country : '',
    continent,
    status,
    credibility: typeof r.credibility === 'number' ? Math.min(100, Math.max(0, r.credibility)) : 0,
    tags: Array.isArray(r.tags) ? r.tags : undefined,
    strangeness: typeof r.strangeness === 'number' ? r.strangeness : undefined,
    ref: typeof r.ref === 'string' ? r.ref : undefined
  }
}

export function parseChunk(raw: unknown, defaultSource: DataSourceId): Sighting[] {
  if (!Array.isArray(raw)) return []
  const sightings: Sighting[] = []
  for (const item of raw) {
    const parsed = parseSighting(item, defaultSource)
    if (parsed) sightings.push(parsed)
  }
  return sightings
}

// ─── Sort helper ────────────────────────────────────────────────────

export function sortNewestFirst(sightings: Sighting[]): Sighting[] {
  return sightings.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

// ─── Manifest validation ────────────────────────────────────────────

/** Base manifest shape: generatedAt + totalRecords + years */
export function isValidManifest(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.generatedAt === 'string' &&
    typeof obj.totalRecords === 'number' &&
    typeof obj.years === 'object' &&
    obj.years !== null
  )
}

// ─── Chunk key resolution ───────────────────────────────────────────

/**
 * Resolve which chunk keys overlap a year range.
 * Handles: numeric years ("1947"), decade keys ("1800s"), and "ancient".
 * For simple year-only manifests, pass `simpleYears: true` to skip decade/ancient logic.
 */
export function getChunkKeysForRange(
  yearKeys: string[],
  fromYear: number,
  toYear: number,
  simpleYears = false
): string[] {
  const keys: string[] = []

  for (const key of yearKeys) {
    if (simpleYears) {
      const y = parseInt(key, 10)
      if (!isNaN(y) && y >= fromYear && y <= toYear) keys.push(key)
      continue
    }

    if (key === 'ancient') {
      if (fromYear < 1800) keys.push(key)
      continue
    }

    if (key.endsWith('s')) {
      const decade = parseInt(key, 10)
      if (!isNaN(decade) && decade + 9 >= fromYear && decade <= toYear) {
        keys.push(key)
      }
      continue
    }

    const year = parseInt(key, 10)
    if (!isNaN(year) && year >= fromYear && year <= toYear) {
      keys.push(key)
    }
  }

  return keys
}

// ─── Source loader factory ──────────────────────────────────────────

export interface ManifestLike {
  generatedAt: string
  totalRecords: number
  years: Record<string, YearChunkMeta>
}

export interface SourceLoaderConfig {
  /** Manifest JSON filename, e.g. 'nuforc-manifest.json' */
  manifestFile: string
  /** Default DataSourceId for parsed sightings */
  defaultSource: DataSourceId
  /** Label for log messages */
  label: string
  /** Whether manifest keys are simple numeric years only (no decades/ancient) */
  simpleYears?: boolean
  /** Additional manifest validation beyond base shape */
  validateManifest?: (data: unknown) => boolean
  /** Error handler: toast or console.warn */
  onError?: (message: string) => void
}

export interface SourceLoader<M extends ManifestLike = ManifestLike> {
  loadManifest(): Promise<M | null>
  loadChunk(key: string): Promise<Sighting[]>
  loadYearRange(fromYear: number, toYear: number): Promise<Sighting[]>
  loadProgressive(
    fromYear: number,
    toYear: number,
    onChunk: (sightings: Sighting[]) => void,
  ): Promise<Sighting[]>
  getAvailableYears(): number[]
  getTotalCount(): number
  getYearCounts(): Map<number, number>
  getLoadedCount(): number
  /** Direct access to the cached manifest (null if not yet loaded) */
  getManifest(): M | null
}

/**
 * Create a source loader with built-in caching, dedup, progressive loading.
 * Each source composable calls this once and extends with source-specific helpers.
 */
export function createSourceLoader<M extends ManifestLike = ManifestLike>(
  config: SourceLoaderConfig
): SourceLoader<M> {
  let manifest: M | null = null
  let manifestError: string | null = null
  const chunkCache = new Map<string, Sighting[]>()
  const pendingFetches = new Map<string, Promise<Sighting[]>>()

  const reportError = config.onError ?? ((msg: string) => console.warn(`[${config.label}] ${msg}`))

  // ── Manifest ────────────────────────────────────────────────────

  async function loadManifest(): Promise<M | null> {
    if (manifest) return manifest
    if (manifestError) return null

    try {
      const data = await fetchJson<unknown>(dataUrl(config.manifestFile))

      if (!isValidManifest(data)) {
        throw new Error(`Malformed ${config.label} manifest`)
      }
      if (config.validateManifest && !config.validateManifest(data)) {
        throw new Error(`Malformed ${config.label} manifest`)
      }

      manifest = data as M
      return manifest
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to load ${config.label} manifest`
      manifestError = message
      reportError(message)
      return null
    }
  }

  // ── Chunks ──────────────────────────────────────────────────────

  async function loadChunk(key: string): Promise<Sighting[]> {
    if (chunkCache.has(key)) return chunkCache.get(key)!
    if (pendingFetches.has(key)) return pendingFetches.get(key)!

    const m = manifest
    if (!m || !m.years[key]) return []

    const meta: YearChunkMeta = m.years[key]

    const promise = fetchJson<unknown>(dataUrl(meta.file))
      .then((raw) => {
        const sightings = parseChunk(raw, config.defaultSource)
        chunkCache.set(key, sightings)
        pendingFetches.delete(key)
        return sightings
      })
      .catch((err) => {
        pendingFetches.delete(key)
        reportError(`Failed to load ${meta.file}: ${err instanceof Error ? err.message : err}`)
        return [] as Sighting[]
      })

    pendingFetches.set(key, promise)
    return promise
  }

  // ── Range loading ───────────────────────────────────────────────

  function resolveKeys(fromYear: number, toYear: number): string[] {
    if (!manifest) return []
    return getChunkKeysForRange(
      Object.keys(manifest.years),
      fromYear,
      toYear,
      config.simpleYears
    )
  }

  async function loadYearRange(fromYear: number, toYear: number): Promise<Sighting[]> {
    const m = await loadManifest()
    if (!m) return []

    const keys = resolveKeys(fromYear, toYear)
    const chunks = await Promise.all(keys.map(loadChunk))
    return sortNewestFirst(chunks.flat())
  }

  async function loadProgressive(
    fromYear: number,
    toYear: number,
    onChunk: (sightings: Sighting[]) => void
  ): Promise<Sighting[]> {
    const m = await loadManifest()
    if (!m) return []

    // Most recent first so user sees newest data immediately
    const keys = resolveKeys(fromYear, toYear).reverse()
    let all: Sighting[] = []

    for (const key of keys) {
      const chunk = await loadChunk(key)
      all = [...all, ...chunk]
      sortNewestFirst(all)
      onChunk(all)
    }

    return all
  }

  // ── Query helpers ───────────────────────────────────────────────

  function getAvailableYears(): number[] {
    if (!manifest) return []

    if (config.simpleYears) {
      return Object.keys(manifest.years).map(Number).sort((a, b) => b - a)
    }

    const years: number[] = []
    for (const [key, meta] of Object.entries(manifest.years)) {
      if (meta.years && meta.years.length > 0) {
        years.push(...meta.years)
        continue
      }
      if (key === 'ancient' || key.endsWith('s')) continue
      const y = parseInt(key, 10)
      if (!isNaN(y)) years.push(y)
    }
    return years.sort((a, b) => b - a)
  }

  function getTotalCount(): number {
    return manifest?.totalRecords ?? 0
  }

  function getYearCounts(): Map<number, number> {
    const counts = new Map<number, number>()
    if (!manifest) return counts
    for (const [key, meta] of Object.entries(manifest.years)) {
      const y = parseInt(key, 10)
      if (!isNaN(y) && !key.endsWith('s')) {
        // Simple year key: "1947" → count goes directly
        counts.set(y, (counts.get(y) || 0) + meta.count)
      } else if (meta.years && meta.years.length > 0) {
        // Ancient or decade chunk with listed years — distribute evenly
        const perYear = Math.max(1, Math.round(meta.count / meta.years.length))
        for (const yr of meta.years) {
          counts.set(yr, (counts.get(yr) || 0) + perYear)
        }
      }
    }
    return counts
  }

  function getLoadedCount(): number {
    let count = 0
    for (const chunk of chunkCache.values()) {
      count += chunk.length
    }
    return count
  }

  function getManifest(): M | null {
    return manifest
  }

  return {
    loadManifest,
    loadChunk,
    loadYearRange,
    loadProgressive,
    getAvailableYears,
    getTotalCount,
    getYearCounts,
    getLoadedCount,
    getManifest
  }
}

// ─── Article loader factory ─────────────────────────────────────────

export interface ArticleCollection<A> {
  articles?: A[]
  [key: string]: unknown
}

export interface ArticleLoaderConfig<A, C extends ArticleCollection<A>> {
  /** JSON filename relative to data dir, e.g. 'gdelt-articles.json' */
  file: string
  /** Label for logs */
  label: string
  /** Fields to match against when filtering by search query */
  searchFields: (keyof A & string)[]
  /** Optional error handler */
  onError?: (message: string) => void
}

export interface ArticleLoader<A, C extends ArticleCollection<A>> {
  load(): Promise<A[]>
  filterArticles(articles: A[], search: string): A[]
  getCollection(): C | null
  getCount(): number
}

export function createArticleLoader<A extends Record<string, unknown>, C extends ArticleCollection<A>>(
  config: ArticleLoaderConfig<A, C>
): ArticleLoader<A, C> {
  let cachedArticles: A[] | null = null
  let cachedCollection: C | null = null

  const reportError = config.onError ?? ((msg) => console.warn(`[${config.label}] ${msg}`))

  async function load(): Promise<A[]> {
    if (cachedArticles) return cachedArticles

    try {
      const data = await fetchJson<C>(dataUrl(config.file))
      cachedCollection = data
      cachedArticles = data.articles ?? []
      return cachedArticles
    } catch {
      // No data yet — not an error, just not populated
      cachedArticles = []
      return []
    }
  }

  function filterArticles(articles: A[], search: string): A[] {
    if (!search) return articles
    const q = search.toLowerCase()
    return articles.filter(a =>
      config.searchFields.some(field => {
        const val = a[field]
        return typeof val === 'string' && val.toLowerCase().includes(q)
      })
    )
  }

  function getCollection(): C | null {
    return cachedCollection
  }

  function getCount(): number {
    return cachedArticles?.length ?? 0
  }

  return { load, filterArticles, getCollection, getCount }
}
