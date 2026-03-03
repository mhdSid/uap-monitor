import type { GnewsArticle, GnewsCollection, SightingFilter } from '@/types'

const DATA_PATH = '/data/gnews-articles.json'

let cachedArticles: GnewsArticle[] | null = null
let cachedCollection: GnewsCollection | null = null

export function useGnews() {
  async function load(): Promise<GnewsArticle[]> {
    if (cachedArticles) return cachedArticles

    try {
      const res = await fetch(DATA_PATH)
      if (!res.ok) {
        cachedArticles = []
        return []
      }

      const data: GnewsCollection = await res.json()
      cachedCollection = data
      cachedArticles = data.articles ?? []
      return cachedArticles
    } catch {
      cachedArticles = []
      return []
    }
  }

  function filterArticles(
    articles: GnewsArticle[],
    filter: SightingFilter
  ): GnewsArticle[] {
    if (!filter.search) return articles

    const q = filter.search.toLowerCase()
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.sourceName.toLowerCase().includes(q)
    )
  }

  function getCollection(): GnewsCollection | null {
    return cachedCollection
  }

  function getCount(): number {
    return cachedArticles?.length ?? 0
  }

  return { load, filterArticles, getCollection, getCount }
}
