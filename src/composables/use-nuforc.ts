import type { NuforcManifest, Sighting, SightingFilter, YearChunkMeta } from '@/types'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '@/enums'
import { useToast } from '@/components/toast'

// ─── Constants ──────────────────────────────────────────────────────

const DATA_DIR = 'data'
const MANIFEST_FILE = 'nuforc-manifest.json'

/** Default: load last 2 years of data on first mount */
const DEFAULT_RANGE_YEARS = 2

// ─── State (module-level singleton) ─────────────────────────────────

let manifest: NuforcManifest | null = null
let manifestError: string | null = null
const chunkCache = new Map<string, Sighting[]>()
const pendingFetches = new Map<string, Promise<Sighting[]>>()

// ─── Resolve base URL from deployment context ───────────────────────

function resolveBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return base.endsWith('/') ? base : `${base}/`
}

function dataUrl(filename: string): string {
  return `${resolveBaseUrl()}${DATA_DIR}/${filename}`
}

// ─── JSON fetch with typed parse + error handling ───────────────────

async function fetchJson<T>(url: string): Promise<T> {
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

// ─── Validation ─────────────────────────────────────────────────────

function isValidManifest(data: unknown): data is NuforcManifest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.generatedAt === 'string' &&
    typeof obj.totalRecords === 'number' &&
    typeof obj.years === 'object' &&
    obj.years !== null
  )
}

const VALID_SHAPES = new Set<string>(Object.values(SightingShape))
const VALID_STATUSES = new Set<string>(Object.values(SightingStatus))
const VALID_CONTINENTS = new Set<string>(Object.values(Continent))
const VALID_SOURCES = new Set<string>(Object.values(DataSourceId))

function parseSighting(raw: unknown): Sighting | null {
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
    : DataSourceId.NUFORC

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
  }
}

function parseChunk(raw: unknown): Sighting[] {
  if (!Array.isArray(raw)) return []
  const sightings: Sighting[] = []
  for (const item of raw) {
    const parsed = parseSighting(item)
    if (parsed) sightings.push(parsed)
  }
  return sightings
}

// ─── Filter engine ──────────────────────────────────────────────────

function applyFilters(sightings: Sighting[], filter: SightingFilter): Sighting[] {
  let result = sightings

  if (filter.search) {
    const q = filter.search.toLowerCase()
    result = result.filter((s) =>
      s.summary.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.region.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      s.shape.toLowerCase().includes(q),
    )
  }
  if (filter.shape) {
    result = result.filter((s) => s.shape === filter.shape)
  }
  if (filter.continent) {
    result = result.filter((s) => s.continent === filter.continent)
  }
  if (filter.country) {
    const country = filter.country.toLowerCase()
    result = result.filter((s) => s.country.toLowerCase() === country)
  }
  if (filter.minCredibility !== undefined && filter.minCredibility > 0) {
    result = result.filter((s) => s.credibility >= filter.minCredibility!)
  }

  return result
}

// ─── Composable ─────────────────────────────────────────────────────

export function useNuforc() {
  const toast = useToast()

  /**
   * Load the manifest. Cached after first successful fetch.
   */
  async function loadManifest(): Promise<NuforcManifest | null> {
    if (manifest) return manifest
    if (manifestError) return null

    try {
      const data = await fetchJson<unknown>(dataUrl(MANIFEST_FILE))

      if (!isValidManifest(data)) {
        throw new Error('Malformed NUFORC manifest')
      }

      manifest = data
      return manifest
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load NUFORC manifest'
      manifestError = message
      toast.error(message)
      return null
    }
  }

  /**
   * Fetch a single year chunk. Deduplicates concurrent requests.
   */
  async function loadYear(year: string): Promise<Sighting[]> {
    if (chunkCache.has(year)) return chunkCache.get(year)!

    if (pendingFetches.has(year)) return pendingFetches.get(year)!

    const m = manifest
    if (!m || !m.years[year]) return []

    const meta: YearChunkMeta = m.years[year]

    const promise = fetchJson<unknown>(dataUrl(meta.file))
      .then((raw) => {
        const sightings = parseChunk(raw)
        chunkCache.set(year, sightings)
        pendingFetches.delete(year)
        return sightings
      })
      .catch((err) => {
        pendingFetches.delete(year)
        const message = err instanceof Error ? err.message : `Failed to load ${meta.file}`
        toast.error(message)
        return [] as Sighting[]
      })

    pendingFetches.set(year, promise)
    return promise
  }

  /**
   * Load a range of years (inclusive). Returns merged, sorted (newest first).
   */
  async function loadYearRange(fromYear: number, toYear: number): Promise<Sighting[]> {
    const m = await loadManifest()
    if (!m) return []

    const years: string[] = []
    for (let y = fromYear; y <= toYear; y++) {
      const key = String(y)
      if (m.years[key]) years.push(key)
    }

    const chunks = await Promise.all(years.map(loadYear))
    const merged = chunks.flat()

    merged.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    return merged
  }

  /**
   * Load the default range (latest N years from the manifest).
   */
  async function loadDefault(): Promise<Sighting[]> {
    const m = await loadManifest()
    if (!m) return []

    const availableYears = Object.keys(m.years).map(Number).sort((a, b) => b - a)
    if (availableYears.length === 0) return []

    const latest = availableYears[0]
    const from = latest - DEFAULT_RANGE_YEARS + 1

    return loadYearRange(from, latest)
  }

  /**
   * Get all cached sightings (across all loaded years), optionally filtered.
   */
  function getCached(filter?: SightingFilter): Sighting[] {
    const all: Sighting[] = []
    for (const chunk of chunkCache.values()) {
      all.push(...chunk)
    }
    all.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

    return filter ? applyFilters(all, filter) : all
  }

  /**
   * Available years from the manifest (sorted descending).
   */
  function getAvailableYears(): number[] {
    if (!manifest) return []
    return Object.keys(manifest.years).map(Number).sort((a, b) => b - a)
  }

  /**
   * Whether a year's data is already cached.
   */
  function isYearLoaded(year: number): boolean {
    return chunkCache.has(String(year))
  }

  /**
   * Total record count from the manifest.
   */
  function getTotalCount(): number {
    return manifest?.totalRecords ?? 0
  }

  /**
   * Count of currently loaded sightings.
   */
  function getLoadedCount(): number {
    let count = 0
    for (const chunk of chunkCache.values()) {
      count += chunk.length
    }
    return count
  }

  return {
    loadManifest,
    loadYear,
    loadYearRange,
    loadDefault,
    getCached,
    getAvailableYears,
    isYearLoaded,
    getTotalCount,
    getLoadedCount,
  }
}
