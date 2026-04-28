import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GdeltArticle } from '../../src/types'

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

function article (overrides: Partial<GdeltArticle>): GdeltArticle {
  return {
    id: 'a1',
    title: '',
    url: 'https://example.com',
    domain: 'example.com',
    publishedAt: '2024-06-15T00:00:00Z',
    language: 'en',
    sourceName: 'Example News',
    country: 'us',
    tone: 0,
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

// ─── Tests ──────────────────────────────────────────────────────────

describe('useGdelt — load', () => {
  it('loads articles from the configured file and caches them', async () => {
    mockFetch.mockResolvedValue(ok({
      generatedAt: '2024-01-01',
      query: 'UAP',
      totalResults: 2,
      articles: [
        article({ id: 'a', title: 'Triangle craft over Phoenix' }),
        article({ id: 'b', title: 'Disk reported in Brazil' })
      ]
    }))

    const { useGdelt } = await import('@/composables/use-gdelt')
    const gd = useGdelt()

    const a = await gd.load()
    const b = await gd.load()
    expect(a).toBe(b)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(gd.getCount()).toBe(2)
    expect(gd.getCollection()?.query).toBe('UAP')
  })

  it('requests the gdelt-articles.json file', async () => {
    mockFetch.mockResolvedValue(ok({ generatedAt: '', query: '', totalResults: 0, articles: [] }))
    const { useGdelt } = await import('@/composables/use-gdelt')
    const gd = useGdelt()
    await gd.load()
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('gdelt-articles.json'))
  })

  it('returns [] silently on fetch error', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useGdelt } = await import('@/composables/use-gdelt')
    const gd = useGdelt()
    expect(await gd.load()).toEqual([])
    expect(gd.getCount()).toBe(0)
    expect(gd.getCollection()).toBeNull()
  })
})

describe('useGdelt — filterArticles', () => {
  it('returns articles unchanged when search is empty or undefined', async () => {
    const { useGdelt } = await import('@/composables/use-gdelt')
    const gd = useGdelt()
    const articles = [article({ id: 'a' })]
    expect(gd.filterArticles(articles, { search: '' })).toEqual(articles)
    expect(gd.filterArticles(articles, {})).toEqual(articles)
  })

  it('matches case-insensitively across title, domain, country, and sourceName', async () => {
    const { useGdelt } = await import('@/composables/use-gdelt')
    const gd = useGdelt()
    const articles = [
      article({ id: 'title',  title: 'Triangle Sighting',           domain: 'a.com', country: 'us', sourceName: 'A' }),
      article({ id: 'domain', title: '',                            domain: 'triangle.news', country: 'us', sourceName: 'B' }),
      article({ id: 'src',    title: '',                            domain: 'b.com', country: 'us', sourceName: 'Triangle Wire' }),
      article({ id: 'none',   title: '',                            domain: 'b.com', country: 'us', sourceName: 'Other' })
    ]
    const result = gd.filterArticles(articles, { search: 'TRIANGLE' })
    expect(result.map(a => a.id).sort()).toEqual(['domain', 'src', 'title'])
  })
})
