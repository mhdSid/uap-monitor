import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '../../src/enums'
import type { GeomagneticRecord, Sighting } from '../../src/types'

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

function makeSighting (occurredAt: string, id = 's1'): Sighting {
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
    coordinates: { lat: 0, lng: 0 },
    region: '',
    country: '',
    continent: Continent.AMERICAS,
    status: SightingStatus.PENDING,
    credibility: 50
  }
}

function record (date: string, kp: (number | null)[], apDaily: number | null = 10): GeomagneticRecord {
  return { date, kp, ap: kp.map(() => null), apDaily }
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

async function setup (data: GeomagneticRecord[]) {
  mockFetch.mockResolvedValue(ok({
    generatedAt: '',
    source: 'GFZ',
    totalDays: data.length,
    dateRange: { from: '', to: '' },
    data
  }))
  const { useGeomagnetic } = await import('@/composables/use-geomagnetic')
  const geo = useGeomagnetic()
  await geo.load()
  return geo
}

// ─── load + caching ─────────────────────────────────────────────────

describe('useGeomagnetic — load', () => {
  it('caches the response across calls', async () => {
    mockFetch.mockResolvedValue(ok({
      generatedAt: '', source: 'GFZ', totalDays: 1, dateRange: { from: '', to: '' },
      data: [record('2024-06-15', [1, 2, 3, 4, 5, 6, 7, 8])]
    }))

    const { useGeomagnetic } = await import('@/composables/use-geomagnetic')
    const geo = useGeomagnetic()

    const a = await geo.load()
    const b = await geo.load()
    expect(a).toBe(b)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(geo.getCount()).toBe(1)
  })

  it('returns [] silently on fetch error', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useGeomagnetic } = await import('@/composables/use-geomagnetic')
    const geo = useGeomagnetic()
    expect(await geo.load()).toEqual([])
    expect(geo.getCount()).toBe(0)
    expect(geo.getCollection()).toBeNull()
  })

  it('handles a collection with missing data field as []', async () => {
    mockFetch.mockResolvedValue(ok({
      generatedAt: '', source: 'GFZ', totalDays: 0, dateRange: { from: '', to: '' }
    }))
    const { useGeomagnetic } = await import('@/composables/use-geomagnetic')
    const geo = useGeomagnetic()
    expect(await geo.load()).toEqual([])
  })
})

// ─── getDailyKp ─────────────────────────────────────────────────────

describe('useGeomagnetic — getDailyKp', () => {
  it('returns the record for a known date', async () => {
    const geo = await setup([record('2024-06-15', [1, 2, 3, 4, 5, 6, 7, 8])])
    expect(geo.getDailyKp('2024-06-15')?.kp).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('returns null for an unknown date', async () => {
    const geo = await setup([record('2024-06-15', [1, 2, 3, 4, 5, 6, 7, 8])])
    expect(geo.getDailyKp('1999-01-01')).toBeNull()
  })

  it('returns null before load', async () => {
    const { useGeomagnetic } = await import('@/composables/use-geomagnetic')
    const geo = useGeomagnetic()
    expect(geo.getDailyKp('2024-06-15')).toBeNull()
  })
})

// ─── findKpForSighting (interval mapping) ───────────────────────────

describe('useGeomagnetic — findKpForSighting', () => {
  // Eight 3-hour intervals, one distinct value per interval for unambiguous mapping
  const KP_BY_INTERVAL = [1, 2, 3, 4, 5, 6, 7, 8]

  it('maps UTC hour 0–2 to interval 0', async () => {
    const geo = await setup([record('2024-06-15', KP_BY_INTERVAL, 12)])
    expect(geo.findKpForSighting(makeSighting('2024-06-15T00:30:00Z')).kp).toBe(1)
    expect(geo.findKpForSighting(makeSighting('2024-06-15T02:59:00Z')).kp).toBe(1)
  })

  it('maps UTC hour 3 to interval 1', async () => {
    const geo = await setup([record('2024-06-15', KP_BY_INTERVAL, 12)])
    expect(geo.findKpForSighting(makeSighting('2024-06-15T03:00:00Z')).kp).toBe(2)
  })

  it('maps UTC hour 21–23 to interval 7', async () => {
    const geo = await setup([record('2024-06-15', KP_BY_INTERVAL, 12)])
    expect(geo.findKpForSighting(makeSighting('2024-06-15T21:00:00Z')).kp).toBe(8)
    expect(geo.findKpForSighting(makeSighting('2024-06-15T23:59:00Z')).kp).toBe(8)
  })

  it('returns the empty result when occurredAt is invalid', async () => {
    const geo = await setup([record('2024-06-15', KP_BY_INTERVAL, 12)])
    expect(geo.findKpForSighting(makeSighting('not-a-date'))).toEqual({
      kp: null, apDaily: null, kpMax: null, isStorm: false
    })
  })

  it('returns the empty result for a date with no data', async () => {
    const geo = await setup([record('2024-06-15', KP_BY_INTERVAL, 12)])
    expect(geo.findKpForSighting(makeSighting('1999-01-01T12:00:00Z'))).toEqual({
      kp: null, apDaily: null, kpMax: null, isStorm: false
    })
  })

  it('exposes apDaily and the daily Kp max', async () => {
    const geo = await setup([record('2024-06-15', [1, 2, 3, 4, 5, 6, 7, 8], 42)])
    const result = geo.findKpForSighting(makeSighting('2024-06-15T00:30:00Z'))
    expect(result.apDaily).toBe(42)
    expect(result.kpMax).toBe(8)
  })

  it('computes kpMax ignoring nulls', async () => {
    const geo = await setup([record('2024-06-15', [null, 2, null, 4, null, 6, null, 8])])
    expect(geo.findKpForSighting(makeSighting('2024-06-15T00:30:00Z')).kpMax).toBe(8)
  })

  it('returns kpMax = null when all interval values are null', async () => {
    const geo = await setup([record('2024-06-15', [null, null, null, null, null, null, null, null])])
    expect(geo.findKpForSighting(makeSighting('2024-06-15T00:30:00Z')).kpMax).toBeNull()
  })

  it('flags isStorm when the interval Kp meets the threshold', async () => {
    const geo = await setup([record('2024-06-15', [1, 1, 1, 1, 5, 1, 1, 1])])
    expect(geo.findKpForSighting(makeSighting('2024-06-15T12:00:00Z')).isStorm).toBe(true)
  })

  it('flags isStorm when the daily max meets the threshold (even if interval value does not)', async () => {
    const geo = await setup([record('2024-06-15', [1, 1, 1, 1, 6, 1, 1, 1])])
    // Interval 0 (hour 0) → kp = 1, but day max = 6
    expect(geo.findKpForSighting(makeSighting('2024-06-15T00:00:00Z')).isStorm).toBe(true)
  })

  it('does not flag isStorm when nothing crosses the threshold', async () => {
    const geo = await setup([record('2024-06-15', [1, 1, 1, 1, 4, 1, 1, 1])])
    expect(geo.findKpForSighting(makeSighting('2024-06-15T00:00:00Z')).isStorm).toBe(false)
  })
})

// ─── getKpDistribution ──────────────────────────────────────────────

describe('useGeomagnetic — getKpDistribution', () => {
  it('returns 10 buckets indexed by floor(Kp)', async () => {
    const geo = await setup([
      record('2024-06-15', [0.5, 1.2, 2.9, 3.0, 4.7, 5.0, 6.0, 7.5])
    ])
    const sightings = [
      makeSighting('2024-06-15T00:00:00Z', 'a'), // bucket 0
      makeSighting('2024-06-15T03:00:00Z', 'b'), // bucket 1
      makeSighting('2024-06-15T06:00:00Z', 'c'), // bucket 2
      makeSighting('2024-06-15T09:00:00Z', 'd'), // bucket 3
      makeSighting('2024-06-15T12:00:00Z', 'e'), // bucket 4
      makeSighting('2024-06-15T15:00:00Z', 'f'), // bucket 5
      makeSighting('2024-06-15T18:00:00Z', 'g'), // bucket 6
      makeSighting('2024-06-15T21:00:00Z', 'h')  // bucket 7
    ]
    expect(geo.getKpDistribution(sightings)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 0, 0])
  })

  it('clamps Kp ≥ 9 into bucket 9', async () => {
    const geo = await setup([record('2024-06-15', [9.7, 9.1, 9.0, 8, 8, 8, 8, 8])])
    const result = geo.getKpDistribution([
      makeSighting('2024-06-15T00:00:00Z', 'a'), // 9.7 → bucket 9
      makeSighting('2024-06-15T03:00:00Z', 'b'), // 9.1 → bucket 9
      makeSighting('2024-06-15T06:00:00Z', 'c')  // 9.0 → bucket 9
    ])
    expect(result[9]).toBe(3)
    expect(result[8]).toBe(0)
  })

  it('skips sightings with no Kp value', async () => {
    const geo = await setup([record('2024-06-15', [null, 2, 3, 4, 5, 6, 7, 8])])
    const result = geo.getKpDistribution([
      makeSighting('2024-06-15T00:00:00Z', 'no-kp'),
      makeSighting('2024-06-15T03:00:00Z', 'kp2')
    ])
    expect(result.reduce((a, b) => a + b, 0)).toBe(1)
    expect(result[2]).toBe(1)
  })

  it('returns all-zero buckets before load', async () => {
    const { useGeomagnetic } = await import('@/composables/use-geomagnetic')
    const geo = useGeomagnetic()
    expect(geo.getKpDistribution([makeSighting('2024-06-15T00:00:00Z')])).toEqual(new Array(10).fill(0))
  })
})

// ─── getStormSightings ──────────────────────────────────────────────

describe('useGeomagnetic — getStormSightings', () => {
  it('keeps sightings whose interval Kp meets the default threshold (5)', async () => {
    const geo = await setup([record('2024-06-15', [1, 2, 5, 6, 1, 1, 1, 1])])
    const sightings = [
      makeSighting('2024-06-15T00:00:00Z', 'kp-1'),
      makeSighting('2024-06-15T06:00:00Z', 'kp-5'),
      makeSighting('2024-06-15T09:00:00Z', 'kp-6')
    ]
    expect(geo.getStormSightings(sightings).map(s => s.id).sort()).toEqual(['kp-5', 'kp-6'])
  })

  it('respects a custom minKp', async () => {
    const geo = await setup([record('2024-06-15', [3, 4, 5, 6, 7, 8, 9, 1])])
    const sightings = [
      makeSighting('2024-06-15T00:00:00Z', 'kp-3'),
      makeSighting('2024-06-15T06:00:00Z', 'kp-5'),
      makeSighting('2024-06-15T18:00:00Z', 'kp-9')
    ]
    expect(geo.getStormSightings(sightings, 7).map(s => s.id)).toEqual(['kp-9'])
  })
})

// ─── getMonthlyCorrelation ──────────────────────────────────────────

describe('useGeomagnetic — getMonthlyCorrelation', () => {
  it('aggregates avg, max, sighting count, and storm count per YYYY-MM', async () => {
    const geo = await setup([
      record('2024-06-15', [2, 4, 6, 1, 1, 1, 1, 1]),
      record('2024-06-20', [3, 3, 3, 3, 3, 3, 3, 3]),
      record('2024-07-05', [9, 9, 9, 9, 9, 9, 9, 9])
    ])
    const sightings = [
      makeSighting('2024-06-15T00:00:00Z', 'a'), // kp=2
      makeSighting('2024-06-15T03:00:00Z', 'b'), // kp=4
      makeSighting('2024-06-15T06:00:00Z', 'c'), // kp=6 → storm
      makeSighting('2024-06-20T00:00:00Z', 'd'), // kp=3
      makeSighting('2024-07-05T00:00:00Z', 'e')  // kp=9 → storm
    ]
    const result = geo.getMonthlyCorrelation(sightings)
    const june = result.get('2024-06')
    const july = result.get('2024-07')

    expect(june?.sightingCount).toBe(4)
    expect(june?.maxKp).toBe(6)
    expect(june?.stormSightingCount).toBe(1)
    expect(june?.avgKp).toBe(3.8) // (2+4+6+3)/4

    expect(july?.sightingCount).toBe(1)
    expect(july?.stormSightingCount).toBe(1)
    expect(july?.maxKp).toBe(9)
    expect(july?.avgKp).toBe(9)
  })

  it('still counts a sighting in sightingCount when its Kp is null, but excludes it from avg/max', async () => {
    const geo = await setup([record('2024-06-15', [null, 4, 4, 4, 4, 4, 4, 4])])
    const sightings = [
      makeSighting('2024-06-15T00:00:00Z', 'no-kp'),
      makeSighting('2024-06-15T03:00:00Z', 'with-kp')
    ]
    const june = geo.getMonthlyCorrelation(sightings).get('2024-06')
    expect(june?.sightingCount).toBe(2)
    expect(june?.avgKp).toBe(4)
    expect(june?.maxKp).toBe(4)
    expect(june?.stormSightingCount).toBe(0)
  })

  it('skips sightings with no occurredAt', async () => {
    const geo = await setup([record('2024-06-15', [1, 2, 3, 4, 5, 6, 7, 8])])
    const result = geo.getMonthlyCorrelation([makeSighting('', 'empty')])
    expect(result.size).toBe(0)
  })
})
