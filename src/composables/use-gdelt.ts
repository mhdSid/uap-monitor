import type { GdeltArticle, GdeltCollection, SightingFilter } from '@/types'
import { useToast } from '@/components/toast'

const DATA_PATH = '/data/gdelt-articles.json'

let cachedArticles: GdeltArticle[] | null = null
let cachedCollection: GdeltCollection | null = null

export function useGdelt() {
  const toast = useToast()

  async function load(): Promise<GdeltArticle[]> {
    if (cachedArticles) return cachedArticles

    try {
      const res = await fetch(DATA_PATH)
      if (!res.ok) {
        // No GDELT data yet — not an error, just not populated
        cachedArticles = []
        return []
      }

      const data: GdeltCollection = await res.json()
      cachedCollection = data
      cachedArticles = data.articles ?? []
      return cachedArticles
    } catch {
      cachedArticles = []
      return []
    }
  }

  /**
   * Filter articles by the main app filter (search only — shape/continent
   * don't apply to news articles).
   */
  function filterArticles(
    articles: GdeltArticle[],
    filter: SightingFilter
  ): GdeltArticle[] {
    if (!filter.search) return articles

    const q = filter.search.toLowerCase()
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.domain.toLowerCase().includes(q) ||
      (a.country ?? '').toLowerCase().includes(q) ||
      (a.sourceName ?? '').toLowerCase().includes(q)
    )
  }

  function getCollection(): GdeltCollection | null {
    return cachedCollection
  }

  function getCount(): number {
    return cachedArticles?.length ?? 0
  }

  return { load, filterArticles, getCollection, getCount }
}
