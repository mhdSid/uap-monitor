import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '../../src/enums'
import type { Fireball, GdeltArticle, GnewsArticle, RedditArticle, Sighting, TwitterArticle } from '../../src/types'

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

function makeSighting (overrides: Partial<Sighting> = {}): Sighting {
  return {
    id: 's1',
    source: DataSourceId.NUFORC,
    occurredAt: '2024-06-15T12:00:00Z',
    reportedAt: '2024-06-15T12:00:00Z',
    postedAt: '2024-06-15T12:00:00Z',
    location: '',
    shape: SightingShape.UNKNOWN,
    duration: '',
    observers: 0,
    summary: '',
    description: '',
    characteristics: [],
    coordinates: { lat: 33.4, lng: -112.1 },
    region: '',
    country: '',
    continent: Continent.AMERICAS,
    status: SightingStatus.PENDING,
    credibility: 50,
    ...overrides
  }
}

function makeFireball (overrides: Partial<Fireball> = {}): Fireball {
  return {
    id: 'fb-1',
    date: '2024-06-15T11:00:00Z',
    lat: 33.5,
    lng: -112.0,
    altitude: null,
    velocity: null,
    energy: null,
    impactEnergy: null,
    source: 'NASA',
    ...overrides
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

// ─── haversineKm ────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('returns 0 for identical points', async () => {
    const { haversineKm } = await import('@/composables/use-fireball')
    expect(haversineKm(40, -74, 40, -74)).toBe(0)
  })

  it('matches a quarter great-circle (equator → north pole)', async () => {
    const { haversineKm } = await import('@/composables/use-fireball')
    // π·R/2 ≈ 10007.54 km
    expect(haversineKm(0, 0, 90, 0)).toBeCloseTo(10007.54, 1)
  })

  it('matches a half great-circle (antipodal across equator)', async () => {
    const { haversineKm } = await import('@/composables/use-fireball')
    // π·R ≈ 20015.09 km
    expect(haversineKm(0, 0, 0, 180)).toBeCloseTo(20015.09, 1)
  })

  it('is symmetric in argument order', async () => {
    const { haversineKm } = await import('@/composables/use-fireball')
    const a = haversineKm(33.4, -112.1, 35.7, -78.6)
    const b = haversineKm(35.7, -78.6, 33.4, -112.1)
    expect(a).toBeCloseTo(b, 6)
  })

  it('roughly matches a known city pair (Phoenix → NYC ≈ 3450 km)', async () => {
    const { haversineKm } = await import('@/composables/use-fireball')
    const km = haversineKm(33.4, -112.1, 40.7, -74.0)
    expect(km).toBeGreaterThan(3400)
    expect(km).toBeLessThan(3500)
  })
})

// ─── load + caching ─────────────────────────────────────────────────

describe('useFireball — load', () => {
  it('caches the response across calls', async () => {
    mockFetch.mockResolvedValue(ok({
      generatedAt: '2024-01-01',
      source: 'NASA',
      totalResults: 1,
      withCoordinates: 1,
      fireballs: [makeFireball()]
    }))

    const { useFireball } = await import('@/composables/use-fireball')
    const fb = useFireball()

    const a = await fb.load()
    const b = await fb.load()
    expect(a).toBe(b)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(fb.getCount()).toBe(1)
    expect(fb.getCollection()?.source).toBe('NASA')
  })

  it('returns [] silently on fetch error', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useFireball } = await import('@/composables/use-fireball')
    const fb = useFireball()

    expect(await fb.load()).toEqual([])
    expect(fb.getCount()).toBe(0)
    expect(fb.getCollection()).toBeNull()
  })

  it('handles a collection with missing fireballs field as []', async () => {
    mockFetch.mockResolvedValue(ok({ generatedAt: '2024-01-01', source: 'NASA', totalResults: 0, withCoordinates: 0 }))
    const { useFireball } = await import('@/composables/use-fireball')
    const fb = useFireball()
    expect(await fb.load()).toEqual([])
  })
})

// ─── findNearSighting ───────────────────────────────────────────────

describe('useFireball — findNearSighting', () => {
  async function setup (fireballs: Fireball[]) {
    mockFetch.mockResolvedValue(ok({
      generatedAt: '',
      source: 'NASA',
      totalResults: fireballs.length,
      withCoordinates: fireballs.length,
      fireballs
    }))
    const { useFireball } = await import('@/composables/use-fireball')
    const fb = useFireball()
    await fb.load()
    return fb
  }

  it('returns [] when sighting has no coordinates', async () => {
    const fb = await setup([makeFireball()])
    expect(fb.findNearSighting(makeSighting({ coordinates: null }))).toEqual([])
  })

  it('returns [] when not loaded', async () => {
    // Fail the fetch — this leaves cached = []
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useFireball } = await import('@/composables/use-fireball')
    const fb = useFireball()
    await fb.load()
    expect(fb.findNearSighting(makeSighting())).toEqual([])
  })

  it('skips fireballs with null lat or lng', async () => {
    const fb = await setup([
      makeFireball({ id: 'no-lat', lat: null }),
      makeFireball({ id: 'no-lng', lng: null }),
      makeFireball({ id: 'good' })
    ])
    const result = fb.findNearSighting(makeSighting())
    expect(result.map(f => f.id)).toEqual(['good'])
  })

  it('filters by distance (default 200 km)', async () => {
    const fb = await setup([
      makeFireball({ id: 'near', lat: 33.5, lng: -112.0 }),    // ~14 km
      makeFireball({ id: 'far',  lat: 40.7, lng: -74.0 })      // ~3450 km
    ])
    const result = fb.findNearSighting(makeSighting())
    expect(result.map(f => f.id)).toEqual(['near'])
  })

  it('filters by hours window (default 72)', async () => {
    const fb = await setup([
      makeFireball({ id: 'within',  date: '2024-06-15T11:00:00Z' }), // -1h
      makeFireball({ id: 'outside', date: '2024-06-10T11:00:00Z' })  // -120h
    ])
    const result = fb.findNearSighting(makeSighting())
    expect(result.map(f => f.id)).toEqual(['within'])
  })

  it('respects custom maxKm and maxHours', async () => {
    const fb = await setup([
      makeFireball({ id: 'mid', lat: 34.4, lng: -112.1, date: '2024-06-15T08:00:00Z' }) // ~111km, -4h
    ])
    expect(fb.findNearSighting(makeSighting(), { maxKm: 50 })).toHaveLength(0)
    expect(fb.findNearSighting(makeSighting(), { maxKm: 200 })).toHaveLength(1)
    expect(fb.findNearSighting(makeSighting(), { maxHours: 1 })).toHaveLength(0)
    expect(fb.findNearSighting(makeSighting(), { maxHours: 24 })).toHaveLength(1)
  })
})

// ─── findRelatedNews ────────────────────────────────────────────────

describe('useFireball — findRelatedNews', () => {
  function gdelt (id: string, publishedAt: string): GdeltArticle {
    return { id, title: '', url: '', domain: '', publishedAt, language: '', tone: 0 }
  }
  function gnews (id: string, publishedAt: string): GnewsArticle {
    return { id, title: '', url: '', publishedAt, sourceName: '', description: '', content: '', imageUrl: null } as GnewsArticle
  }
  function tweet (id: string, publishedAt: string): TwitterArticle {
    return {
      id, text: '', url: '', publishedAt, lang: '',
      authorName: '', authorUsername: '', authorVerified: false,
      likeCount: 0, repostCount: 0, replyCount: 0, quoteCount: 0
    }
  }
  function reddit (id: string, publishedAt: string): RedditArticle {
    return {
      id, title: '', url: '', publishedAt,
      sourceName: '', subreddit: '', authorName: '', score: 0, commentCount: 0
    } as RedditArticle
  }

  it('keeps articles within the default 7-day window across all four feeds', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useFireball } = await import('@/composables/use-fireball')
    const fb = useFireball()
    await fb.load()

    const sighting = makeSighting({ occurredAt: '2024-06-15T00:00:00Z' })

    const result = fb.findRelatedNews(
      sighting,
      [gdelt('g-near', '2024-06-13T00:00:00Z'), gdelt('g-far', '2024-06-01T00:00:00Z')],
      [gnews('n-near', '2024-06-18T00:00:00Z'), gnews('n-far', '2024-07-01T00:00:00Z')],
      [tweet('t-near', '2024-06-15T05:00:00Z'), tweet('t-far', '2024-06-01T00:00:00Z')],
      [reddit('r-near', '2024-06-10T00:00:00Z'), reddit('r-far', '2024-05-01T00:00:00Z')]
    )

    expect(result.gdelt.map(a => a.id)).toEqual(['g-near'])
    expect(result.gnews.map(a => a.id)).toEqual(['n-near'])
    expect(result.twitterNews.map(a => a.id)).toEqual(['t-near'])
    expect(result.redditNews.map(a => a.id)).toEqual(['r-near'])
  })

  it('respects custom limit', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useFireball } = await import('@/composables/use-fireball')
    const fb = useFireball()
    await fb.load()

    const sighting = makeSighting({ occurredAt: '2024-06-15T00:00:00Z' })
    const articles = Array.from({ length: 10 }, (_, i) => gdelt(`a-${i}`, '2024-06-15T00:00:00Z'))

    const result = fb.findRelatedNews(sighting, articles, [], [], [], { limit: 3 })
    expect(result.gdelt).toHaveLength(3)
  })

  it('respects custom maxDays', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useFireball } = await import('@/composables/use-fireball')
    const fb = useFireball()
    await fb.load()

    const sighting = makeSighting({ occurredAt: '2024-06-15T00:00:00Z' })
    const articles = [
      gdelt('day-2', '2024-06-13T00:00:00Z'),
      gdelt('day-5', '2024-06-10T00:00:00Z')
    ]
    expect(fb.findRelatedNews(sighting, articles, [], [], [], { maxDays: 3 }).gdelt.map(a => a.id))
      .toEqual(['day-2'])
  })
})
