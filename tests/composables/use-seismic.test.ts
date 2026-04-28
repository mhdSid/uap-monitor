import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '../../src/enums'
import type { Earthquake, EarthquakeManifest, Sighting } from '../../src/types'

// ─── Response helpers ───────────────────────────────────────────────

function ok (body: unknown, contentType = 'application/json'): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (k: string) => k.toLowerCase() === 'content-type' ? contentType : null },
    json: async () => body
  } as unknown as Response
}

function fail (status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    headers: { get: () => null },
    json: async () => ({})
  } as unknown as Response
}

// ─── Fixtures ───────────────────────────────────────────────────────

function quake (overrides: Partial<Earthquake> = {}): Earthquake {
  return {
    id: 'eq-1',
    time: '2024-06-15T11:00:00Z',
    lat: 33.5,
    lng: -112.0,
    depth: 10,
    magnitude: 5.0,
    magType: 'mb',
    place: 'somewhere',
    ...overrides
  }
}

function makeSighting (occurredAt: string, id = 's1', coords = { lat: 33.4, lng: -112.1 }): Sighting {
  return {
    id,
    source: DataSourceId.NUFORC,
    occurredAt,
    reportedAt: occurredAt,
    postedAt: occurredAt,
    location: '',
    shape: SightingShape.UNKNOWN,
    duration: '',
    observers: 0,
    summary: '',
    description: '',
    characteristics: [],
    coordinates: coords,
    region: '',
    country: '',
    continent: Continent.AMERICAS,
    status: SightingStatus.PENDING,
    credibility: 50
  }
}

function manifestFor (years: number[]): EarthquakeManifest {
  const yMap: Record<string, { count: number; file: string }> = {}
  for (const y of years) yMap[String(y)] = { count: 1, file: `eq-${y}.json` }
  return {
    generatedAt: '',
    source: 'USGS',
    totalRecords: years.length,
    dateRange: { from: '', to: '' },
    minMagnitude: 4.0,
    years: yMap
  }
}

// ─── Setup ──────────────────────────────────────────────────────────

const mockFetch = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── load ───────────────────────────────────────────────────────────

describe('useSeismic — load', () => {
  it('caches the manifest across calls', async () => {
    mockFetch.mockResolvedValue(ok(manifestFor([2024])))
    const { useSeismic } = await import('@/composables/use-seismic')
    const seis = useSeismic()

    const a = await seis.load()
    const b = await seis.load()
    expect(a).toBe(b)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(seis.getTotalCount()).toBe(1)
  })

  it('returns null on error and stays null on retry (sticky)', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useSeismic } = await import('@/composables/use-seismic')
    const seis = useSeismic()
    expect(await seis.load()).toBeNull()
    expect(await seis.load()).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ─── ensureYears ────────────────────────────────────────────────────

describe('useSeismic — ensureYears', () => {
  it('fetches each year exactly once across repeated calls', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('earthquakes-manifest.json')) return ok(manifestFor([2023, 2024, 2025]))
      if (url.endsWith('eq-2023.json')) return ok([quake({ id: 'q23', time: '2023-06-01T00:00:00Z' })])
      if (url.endsWith('eq-2024.json')) return ok([quake({ id: 'q24', time: '2024-06-01T00:00:00Z' })])
      if (url.endsWith('eq-2025.json')) return ok([quake({ id: 'q25', time: '2025-06-01T00:00:00Z' })])
      throw new Error(`Unexpected: ${url}`)
    })

    const { useSeismic } = await import('@/composables/use-seismic')
    const seis = useSeismic()
    await seis.load()

    // First call: range 2024–2024 + 1-year buffer in each direction = 2023, 2024, 2025
    await seis.ensureYears(2024, 2024)
    expect(mockFetch).toHaveBeenCalledTimes(4) // manifest + 3 years

    // Second call: same range — nothing new should fetch
    await seis.ensureYears(2024, 2024)
    expect(mockFetch).toHaveBeenCalledTimes(4)

    expect(seis.getCount()).toBe(3)
  })

  it('dedups concurrent fetches for the same year', async () => {
    let resolveYear: ((r: Response) => void) | null = null
    const yearPromise = new Promise<Response>((r) => { resolveYear = r })

    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('earthquakes-manifest.json')) return ok(manifestFor([2024]))
      if (url.endsWith('eq-2024.json')) return yearPromise
      throw new Error(`Unexpected: ${url}`)
    })

    const { useSeismic } = await import('@/composables/use-seismic')
    const seis = useSeismic()
    await seis.load()

    const p1 = seis.ensureYears(2024, 2024)
    const p2 = seis.ensureYears(2024, 2024)

    resolveYear!(ok([quake({ id: 'q24', time: '2024-06-01T00:00:00Z' })]))
    await Promise.all([p1, p2])

    // 1 manifest + 1 year fetch (deduped)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('caches an empty array on year-fetch failure (no retry)', async () => {
    let yearAttempts = 0
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('earthquakes-manifest.json')) return ok(manifestFor([2024]))
      if (url.endsWith('eq-2024.json')) {
        yearAttempts++
        return fail(500, 'Down')
      }
      throw new Error(`Unexpected: ${url}`)
    })

    const { useSeismic } = await import('@/composables/use-seismic')
    const seis = useSeismic()
    await seis.load()

    await seis.ensureYears(2024, 2024)
    await seis.ensureYears(2024, 2024)
    expect(yearAttempts).toBe(1)
  })

  it('skips years not in the manifest', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('earthquakes-manifest.json')) return ok(manifestFor([2024]))
      if (url.endsWith('eq-2024.json')) return ok([])
      throw new Error(`Unexpected: ${url}`)
    })
    const { useSeismic } = await import('@/composables/use-seismic')
    const seis = useSeismic()
    await seis.load()

    // Range 1900–1900: with ±1 year buffer, requests 1899/1900/1901 — none in manifest
    await seis.ensureYears(1900, 1900)
    // 1 manifest + 0 year fetches
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ─── findNearSighting ───────────────────────────────────────────────

describe('useSeismic — findNearSighting', () => {
  async function setup (quakes: Earthquake[], manifestYears: number[] = [2024]): Promise<{
    findNearSighting: ReturnType<typeof import('@/composables/use-seismic').useSeismic>['findNearSighting']
    getCorrelatedPairs: ReturnType<typeof import('@/composables/use-seismic').useSeismic>['getCorrelatedPairs']
    getCorrelatedPairsAsync: ReturnType<typeof import('@/composables/use-seismic').useSeismic>['getCorrelatedPairsAsync']
    getEQLCandidates: ReturnType<typeof import('@/composables/use-seismic').useSeismic>['getEQLCandidates']
    getMonthlyCorrelation: ReturnType<typeof import('@/composables/use-seismic').useSeismic>['getMonthlyCorrelation']
  }> {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('earthquakes-manifest.json')) return ok(manifestFor(manifestYears))
      if (url.match(/eq-\d+\.json$/)) {
        const year = Number(url.match(/eq-(\d+)\.json$/)![1])
        return ok(quakes.filter(q => Number(q.time.slice(0, 4)) === year))
      }
      throw new Error(`Unexpected: ${url}`)
    })

    const { useSeismic } = await import('@/composables/use-seismic')
    const seis = useSeismic()
    await seis.load()
    await seis.ensureYears(manifestYears[0], manifestYears[manifestYears.length - 1])
    return seis
  }

  it('returns [] when sighting has no coordinates', async () => {
    const seis = await setup([quake()])
    const sighting: Sighting = { ...makeSighting('2024-06-15T12:00:00Z'), coordinates: null }
    expect(seis.findNearSighting(sighting)).toEqual([])
  })

  it('returns [] when occurredAt is invalid', async () => {
    const seis = await setup([quake()])
    expect(seis.findNearSighting(makeSighting('not-a-date'))).toEqual([])
  })

  it('filters by distance (default 300 km)', async () => {
    const seis = await setup([
      quake({ id: 'near', lat: 33.5, lng: -112.0, time: '2024-06-15T12:00:00Z' }), // ~14 km
      quake({ id: 'far',  lat: 40.7, lng: -74.0,  time: '2024-06-15T12:00:00Z' })  // ~3450 km
    ])
    const result = seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'))
    expect(result.map(r => r.earthquake.id)).toEqual(['near'])
  })

  it('filters by hours window (default 72)', async () => {
    const seis = await setup([
      quake({ id: 'within',  time: '2024-06-15T11:00:00Z' }),  // -1h
      quake({ id: 'outside', time: '2024-06-12T11:00:00Z' })   // -73h
    ])
    const result = seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'))
    expect(result.map(r => r.earthquake.id)).toEqual(['within'])
  })

  it('respects custom maxKm and maxHours', async () => {
    const seis = await setup([
      quake({ id: 'mid', lat: 34.4, lng: -112.1, time: '2024-06-15T08:00:00Z' }) // ~111 km, -4h
    ])
    expect(seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'), { maxKm: 50 })).toHaveLength(0)
    expect(seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'), { maxHours: 1 })).toHaveLength(0)
    expect(seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'), { maxKm: 200, maxHours: 24 })).toHaveLength(1)
  })

  it('sorts results by ascending distance', async () => {
    const seis = await setup([
      quake({ id: 'near',   lat: 33.45, lng: -112.05, time: '2024-06-15T12:00:00Z' }),
      quake({ id: 'middle', lat: 34.0,  lng: -112.0,  time: '2024-06-15T12:00:00Z' }),
      quake({ id: 'far',    lat: 35.0,  lng: -112.0,  time: '2024-06-15T12:00:00Z' })
    ])
    const result = seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'))
    expect(result.map(r => r.earthquake.id)).toEqual(['near', 'middle', 'far'])
  })

  it('hoursDelta is positive when the quake is after the sighting (current implementation)', async () => {
    // NOTE: NearbyEarthquake JSDoc says the opposite — flagged for review.
    const seis = await setup([
      quake({ id: 'after', time: '2024-06-15T15:00:00Z' }) // 3h after sighting
    ])
    const result = seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'))
    expect(result[0].hoursDelta).toBe(3)
  })

  it('flags isEQLCandidate when distance < 120 km, |hours| ≤ 48, mag ≥ 4.5, depth ≤ 30', async () => {
    const seis = await setup([
      quake({ id: 'eql',     lat: 33.5, lng: -112.0, time: '2024-06-15T11:00:00Z', magnitude: 5.0, depth: 10 }),
      quake({ id: 'too-far', lat: 35.0, lng: -112.0, time: '2024-06-15T11:00:00Z', magnitude: 5.0, depth: 10 }), // ~178km
      quake({ id: 'low-mag', lat: 33.5, lng: -112.0, time: '2024-06-15T11:00:00Z', magnitude: 4.0, depth: 10 }),
      quake({ id: 'deep',    lat: 33.5, lng: -112.0, time: '2024-06-15T11:00:00Z', magnitude: 5.0, depth: 50 })
    ])
    const result = seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'))
    const byId = new Map(result.map(r => [r.earthquake.id, r]))
    expect(byId.get('eql')?.isEQLCandidate).toBe(true)
    expect(byId.get('too-far')?.isEQLCandidate).toBe(false) // ~178km, beyond EQL's 120km
    expect(byId.get('low-mag')?.isEQLCandidate).toBe(false)
    expect(byId.get('deep')?.isEQLCandidate).toBe(false)
  })

  it('treats null depth as eligible for EQL (only excludes when depth is set and > 30)', async () => {
    const seis = await setup([
      quake({ id: 'no-depth', lat: 33.5, lng: -112.0, time: '2024-06-15T11:00:00Z', magnitude: 5.0, depth: null })
    ])
    const result = seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'))
    expect(result[0].isEQLCandidate).toBe(true)
  })

  it('skips quakes with null lat or lng during indexing', async () => {
    const seis = await setup([
      quake({ id: 'no-lat', lat: null, time: '2024-06-15T11:00:00Z' }),
      quake({ id: 'good',                      time: '2024-06-15T11:00:00Z' })
    ])
    const result = seis.findNearSighting(makeSighting('2024-06-15T12:00:00Z'))
    expect(result.map(r => r.earthquake.id)).toEqual(['good'])
  })
})

// ─── Bulk correlation ───────────────────────────────────────────────

describe('useSeismic — getCorrelatedPairs / getMonthlyCorrelation', () => {
  async function setup (quakes: Earthquake[], years = [2024]): Promise<ReturnType<typeof import('@/composables/use-seismic').useSeismic>> {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('earthquakes-manifest.json')) return ok(manifestFor(years))
      if (url.match(/eq-\d+\.json$/)) {
        const year = Number(url.match(/eq-(\d+)\.json$/)![1])
        return ok(quakes.filter(q => Number(q.time.slice(0, 4)) === year))
      }
      throw new Error(`Unexpected: ${url}`)
    })
    const { useSeismic } = await import('@/composables/use-seismic')
    const seis = useSeismic()
    await seis.load()
    await seis.ensureYears(years[0], years[years.length - 1])
    return seis
  }

  it('emits one pair per (sighting, nearby quake) combination', async () => {
    const seis = await setup([
      quake({ id: 'q1', lat: 33.5, lng: -112.0, time: '2024-06-15T11:00:00Z' }),
      quake({ id: 'q2', lat: 33.5, lng: -112.0, time: '2024-06-15T13:00:00Z' })
    ])
    const sightings = [
      makeSighting('2024-06-15T12:00:00Z', 's-a'),
      makeSighting('2024-06-15T12:00:00Z', 's-b')
    ]
    const pairs = seis.getCorrelatedPairs(sightings)
    expect(pairs).toHaveLength(4) // 2 sightings × 2 quakes
    expect(new Set(pairs.map(p => p.sighting.id))).toEqual(new Set(['s-a', 's-b']))
  })

  it('getCorrelatedPairsAsync returns the same result as the sync version', async () => {
    const seis = await setup([
      quake({ id: 'q1', lat: 33.5, lng: -112.0, time: '2024-06-15T11:00:00Z' })
    ])
    const sightings = [
      makeSighting('2024-06-15T12:00:00Z', 's-a'),
      makeSighting('2024-06-15T12:00:00Z', 's-b')
    ]
    const sync = seis.getCorrelatedPairs(sightings)
    const async_ = await seis.getCorrelatedPairsAsync(sightings)
    expect(async_.length).toBe(sync.length)
  })

  it('getEQLCandidates returns only pairs flagged as EQL', async () => {
    const seis = await setup([
      quake({ id: 'eql',     lat: 33.5, lng: -112.0, time: '2024-06-15T11:00:00Z', magnitude: 5.0, depth: 10 }),
      quake({ id: 'low-mag', lat: 33.5, lng: -112.0, time: '2024-06-15T11:00:00Z', magnitude: 4.0, depth: 10 })
    ])
    const result = seis.getEQLCandidates([makeSighting('2024-06-15T12:00:00Z')])
    expect(result.map(r => r.earthquake.id)).toEqual(['eql'])
  })

  it('getMonthlyCorrelation aggregates by YYYY-MM with deduped sighting + EQL counts', async () => {
    const seis = await setup([
      // Two quakes near the same sighting in June
      quake({ id: 'q1', lat: 33.5, lng: -112.0, time: '2024-06-15T11:00:00Z', magnitude: 5.0, depth: 10 }),
      quake({ id: 'q2', lat: 33.5, lng: -112.0, time: '2024-06-15T13:00:00Z', magnitude: 5.0, depth: 10 }),
      // One quake near a sighting in July
      quake({ id: 'q3', lat: 33.5, lng: -112.0, time: '2024-07-10T12:00:00Z', magnitude: 5.0, depth: 10 })
    ])
    const sightings = [
      makeSighting('2024-06-15T12:00:00Z', 'june-1'),
      makeSighting('2024-07-10T12:00:00Z', 'july-1')
    ]
    const result = seis.getMonthlyCorrelation(sightings)
    const june = result.get('2024-06')
    const july = result.get('2024-07')

    expect(june?.quakeCount).toBe(2)         // 2 pairs
    expect(june?.correlatedSightings).toBe(1) // but only 1 unique sighting
    expect(june?.eqlCandidates).toBe(1)

    expect(july?.quakeCount).toBe(1)
    expect(july?.correlatedSightings).toBe(1)
  })

  it('skips months with no correlated pairs entirely', async () => {
    const seis = await setup([
      quake({ id: 'q1', lat: 33.5, lng: -112.0, time: '2024-07-10T12:00:00Z' })
    ])
    const sightings = [
      makeSighting('2024-06-15T12:00:00Z', 'june-orphan'),
      makeSighting('2024-07-10T12:00:00Z', 'july-paired')
    ]
    const result = seis.getMonthlyCorrelation(sightings)
    expect(result.has('2024-06')).toBe(false)
    expect(result.has('2024-07')).toBe(true)
  })
})
