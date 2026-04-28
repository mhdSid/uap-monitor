import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSourceLoader, createArticleLoader } from '../../src/composables/use-fetch'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '../../src/enums'
import type { SourceManifest } from '../../src/types'

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

// ─── Sighting fixture ───────────────────────────────────────────────

function rawSighting (id: string, occurredAt: string): Record<string, unknown> {
  return {
    id,
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
    coordinates: null,
    region: '',
    country: '',
    continent: Continent.AMERICAS,
    status: SightingStatus.PENDING,
    credibility: 50
  }
}

// ─── Manifest fixtures ──────────────────────────────────────────────

const SIMPLE_MANIFEST: SourceManifest = {
  generatedAt: '2024-01-01',
  totalRecords: 6,
  years: {
    '2020': { count: 2, file: '2020.json', sizeKB: 1 },
    '2021': { count: 2, file: '2021.json', sizeKB: 1 },
    '2022': { count: 2, file: '2022.json', sizeKB: 1 }
  }
}

const COMPLEX_MANIFEST: SourceManifest = {
  generatedAt: '2024-01-01',
  totalRecords: 60,
  years: {
    '1947': { count: 10, file: '1947.json', sizeKB: 2 },
    '1950s': { count: 20, file: '1950s.json', sizeKB: 4, years: [1950, 1951, 1952, 1953] },
    'ancient': { count: 30, file: 'ancient.json', sizeKB: 6, years: [70, 1200, 1500] }
  }
}

// ─── Setup ──────────────────────────────────────────────────────────

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── createSourceLoader: manifest ───────────────────────────────────

describe('createSourceLoader — loadManifest', () => {
  it('loads, validates, and caches the manifest', async () => {
    mockFetch.mockResolvedValue(ok(SIMPLE_MANIFEST))
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })

    const a = await loader.loadManifest()
    const b = await loader.loadManifest()
    expect(a).toBe(b)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('returns null on fetch error and reports it', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Server Error'))
    const onError = vi.fn()
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true,
      onError
    })

    const result = await loader.loadManifest()
    expect(result).toBeNull()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('caches the error — does not refetch after first failure', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Server Error'))
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true,
      onError: () => {}
    })

    await loader.loadManifest()
    await loader.loadManifest()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed manifest shape', async () => {
    mockFetch.mockResolvedValue(ok({ wrong: 'shape' }))
    const onError = vi.fn()
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true,
      onError
    })

    expect(await loader.loadManifest()).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Malformed Test manifest'))
  })

  it('runs the validateManifest hook and rejects when it returns false', async () => {
    mockFetch.mockResolvedValue(ok(SIMPLE_MANIFEST))
    const onError = vi.fn()
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true,
      validateManifest: () => false,
      onError
    })

    expect(await loader.loadManifest()).toBeNull()
    expect(onError).toHaveBeenCalledOnce()
  })
})

// ─── createSourceLoader: chunks ─────────────────────────────────────

describe('createSourceLoader — loadChunk', () => {
  it('returns [] for an unknown chunk key', async () => {
    mockFetch.mockResolvedValueOnce(ok(SIMPLE_MANIFEST))
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })
    await loader.loadManifest()
    expect(await loader.loadChunk('1900')).toEqual([])
  })

  it('parses raw response into Sightings and caches them', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/data/m.json') return ok(SIMPLE_MANIFEST)
      if (url === '/data/2020.json') {
        return ok([rawSighting('s1', '2020-01-01'), rawSighting('s2', '2020-06-01')])
      }
      throw new Error(`Unexpected: ${url}`)
    })

    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })
    await loader.loadManifest()

    const first = await loader.loadChunk('2020')
    const second = await loader.loadChunk('2020')

    expect(first.map(s => s.id)).toEqual(['s1', 's2'])
    expect(second).toBe(first) // cached, same reference
    // 1 manifest fetch + 1 chunk fetch
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('dedups concurrent calls for the same key', async () => {
    let resolveChunk: ((r: Response) => void) | null = null
    const chunkPromise = new Promise<Response>((r) => { resolveChunk = r })

    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/data/m.json') return ok(SIMPLE_MANIFEST)
      if (url === '/data/2020.json') return chunkPromise
      throw new Error(`Unexpected: ${url}`)
    })

    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })
    await loader.loadManifest()

    const p1 = loader.loadChunk('2020')
    const p2 = loader.loadChunk('2020')

    resolveChunk!(ok([rawSighting('s1', '2020-01-01')]))
    const [a, b] = await Promise.all([p1, p2])

    expect(a).toBe(b)
    // 1 manifest + 1 chunk fetch (dedup)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns [] on chunk fetch error and does not cache the failure', async () => {
    let chunkAttempts = 0
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/data/m.json') return ok(SIMPLE_MANIFEST)
      if (url === '/data/2020.json') {
        chunkAttempts++
        if (chunkAttempts === 1) return fail(500, 'Down')
        return ok([rawSighting('s1', '2020-01-01')])
      }
      throw new Error(`Unexpected: ${url}`)
    })

    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true,
      onError: () => {}
    })
    await loader.loadManifest()

    expect(await loader.loadChunk('2020')).toEqual([])
    // Retry — error not cached, so it should re-fetch and succeed
    const second = await loader.loadChunk('2020')
    expect(second.map(s => s.id)).toEqual(['s1'])
    expect(chunkAttempts).toBe(2)
  })
})

// ─── createSourceLoader: ranges ─────────────────────────────────────

describe('createSourceLoader — loadYearRange / loadProgressive', () => {
  function manifestPlusChunks (): void {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/data/m.json') return ok(SIMPLE_MANIFEST)
      if (url === '/data/2020.json') return ok([rawSighting('a', '2020-06-01')])
      if (url === '/data/2021.json') return ok([rawSighting('b', '2021-06-01')])
      if (url === '/data/2022.json') return ok([rawSighting('c', '2022-06-01')])
      throw new Error(`Unexpected: ${url}`)
    })
  }

  it('loadYearRange merges chunks and sorts newest-first', async () => {
    manifestPlusChunks()
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })

    const result = await loader.loadYearRange(2020, 2022)
    expect(result.map(s => s.id)).toEqual(['c', 'b', 'a'])
  })

  it('loadProgressive emits chunks newest-first, accumulating on each call', async () => {
    manifestPlusChunks()
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })

    const emitted: string[][] = []
    await loader.loadProgressive(2020, 2022, (chunk) => {
      emitted.push(chunk.map(s => s.id))
    })

    expect(emitted).toEqual([
      ['c'],
      ['c', 'b'],
      ['c', 'b', 'a']
    ])
  })

  it('returns [] when manifest cannot be loaded', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true,
      onError: () => {}
    })
    expect(await loader.loadYearRange(2020, 2022)).toEqual([])
  })
})

// ─── createSourceLoader: query helpers ──────────────────────────────

describe('createSourceLoader — query helpers', () => {
  it('getAvailableYears (simpleYears) sorts numeric keys descending', async () => {
    mockFetch.mockResolvedValueOnce(ok(SIMPLE_MANIFEST))
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })
    await loader.loadManifest()
    expect(loader.getAvailableYears()).toEqual([2022, 2021, 2020])
  })

  it('getAvailableYears (complex) prefers meta.years for decade and ancient keys', async () => {
    mockFetch.mockResolvedValueOnce(ok(COMPLEX_MANIFEST))
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.CHRONOLOGY,
      label: 'Test',
      simpleYears: false
    })
    await loader.loadManifest()
    expect(loader.getAvailableYears()).toEqual([1953, 1952, 1951, 1950, 1947, 1500, 1200, 70])
  })

  it('getYearCounts: simple year keys map directly', async () => {
    mockFetch.mockResolvedValueOnce(ok(SIMPLE_MANIFEST))
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })
    await loader.loadManifest()

    const counts = loader.getYearCounts()
    expect(counts.get(2020)).toBe(2)
    expect(counts.get(2021)).toBe(2)
    expect(counts.get(2022)).toBe(2)
  })

  it('getYearCounts: decade and ancient keys distribute count across listed years', async () => {
    mockFetch.mockResolvedValueOnce(ok(COMPLEX_MANIFEST))
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.CHRONOLOGY,
      label: 'Test',
      simpleYears: false
    })
    await loader.loadManifest()

    const counts = loader.getYearCounts()
    // 1947 is a simple key
    expect(counts.get(1947)).toBe(10)
    // 1950s: count=20 / 4 years = 5 each
    expect(counts.get(1950)).toBe(5)
    expect(counts.get(1953)).toBe(5)
    // ancient: count=30 / 3 years = 10 each
    expect(counts.get(70)).toBe(10)
    expect(counts.get(1500)).toBe(10)
  })

  it('getTotalCount returns manifest.totalRecords (or 0 when unloaded)', async () => {
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })
    expect(loader.getTotalCount()).toBe(0)

    mockFetch.mockResolvedValueOnce(ok(SIMPLE_MANIFEST))
    await loader.loadManifest()
    expect(loader.getTotalCount()).toBe(6)
  })

  it('getLoadedCount sums sightings across cached chunks', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/data/m.json') return ok(SIMPLE_MANIFEST)
      if (url === '/data/2020.json') return ok([rawSighting('a', '2020-01-01')])
      if (url === '/data/2021.json') return ok([rawSighting('b', '2021-01-01'), rawSighting('c', '2021-02-01')])
      throw new Error(`Unexpected: ${url}`)
    })
    const loader = createSourceLoader({
      manifestFile: 'm.json',
      defaultSource: DataSourceId.NUFORC,
      label: 'Test',
      simpleYears: true
    })
    await loader.loadManifest()
    expect(loader.getLoadedCount()).toBe(0)
    await loader.loadChunk('2020')
    expect(loader.getLoadedCount()).toBe(1)
    await loader.loadChunk('2021')
    expect(loader.getLoadedCount()).toBe(3)
  })
})

// ─── createArticleLoader ────────────────────────────────────────────

interface TestArticle {
  id: string
  title: string
  author: string
  views: number
}

interface TestCollection {
  generatedAt: string
  articles: TestArticle[]
}

describe('createArticleLoader', () => {
  it('loads articles and caches them', async () => {
    mockFetch.mockResolvedValue(ok({
      generatedAt: '2024-01-01',
      articles: [
        { id: '1', title: 'Hello', author: 'Alice', views: 10 },
        { id: '2', title: 'World', author: 'Bob', views: 20 }
      ]
    }))

    const loader = createArticleLoader<TestArticle, TestCollection>({
      file: 'articles.json',
      label: 'Test',
      searchFields: ['title', 'author']
    })

    const first = await loader.load()
    const second = await loader.load()
    expect(first).toBe(second)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(loader.getCount()).toBe(2)
    expect(loader.getCollection()?.generatedAt).toBe('2024-01-01')
  })

  it('returns [] silently on fetch error', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const loader = createArticleLoader<TestArticle, TestCollection>({
      file: 'articles.json',
      label: 'Test',
      searchFields: ['title']
    })

    const result = await loader.load()
    expect(result).toEqual([])
    expect(loader.getCount()).toBe(0)
    expect(loader.getCollection()).toBeNull()
  })

  it('handles a collection with missing articles field as []', async () => {
    mockFetch.mockResolvedValue(ok({ generatedAt: '2024-01-01' }))
    const loader = createArticleLoader<TestArticle, TestCollection>({
      file: 'articles.json',
      label: 'Test',
      searchFields: ['title']
    })

    expect(await loader.load()).toEqual([])
  })

  it('filterArticles returns input as-is when search is empty', () => {
    const loader = createArticleLoader<TestArticle, TestCollection>({
      file: 'articles.json',
      label: 'Test',
      searchFields: ['title']
    })
    const articles = [{ id: '1', title: 'Hi', author: 'A', views: 1 }]
    expect(loader.filterArticles(articles, '')).toBe(articles)
  })

  it('filterArticles matches case-insensitively across configured fields', () => {
    const loader = createArticleLoader<TestArticle, TestCollection>({
      file: 'articles.json',
      label: 'Test',
      searchFields: ['title', 'author']
    })
    const articles: TestArticle[] = [
      { id: '1', title: 'Triangle Sighting', author: 'Alice', views: 10 },
      { id: '2', title: 'Disk Report',       author: 'Bob',   views: 20 },
      { id: '3', title: 'Other',             author: 'Triangle Press', views: 5 }
    ]
    const result = loader.filterArticles(articles, 'TRIANGLE')
    expect(result.map(a => a.id).sort()).toEqual(['1', '3'])
  })

  it('filterArticles ignores non-string values on configured fields', () => {
    const loader = createArticleLoader<TestArticle, TestCollection>({
      file: 'articles.json',
      label: 'Test',
      searchFields: ['title', 'views'] // views is a number
    })
    const articles: TestArticle[] = [
      { id: '1', title: 'No match here', author: 'A', views: 42 }
    ]
    expect(loader.filterArticles(articles, '42')).toEqual([])
  })
})
