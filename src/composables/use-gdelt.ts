import type { GdeltArticle, GdeltCollection, SightingFilter } from '@/types'
import { createArticleLoader } from './use-fetch'

const loader = createArticleLoader<GdeltArticle, GdeltCollection>({
  file: 'gdelt-articles.json',
  label: 'GDELT',
  searchFields: ['title', 'domain', 'country', 'sourceName']
})

export function useGdelt () {
  function filterArticles (articles: GdeltArticle[], filter: SightingFilter) {
    return loader.filterArticles(articles, filter.search ?? '')
  }

  return {
    load: loader.load,
    filterArticles,
    getCollection: loader.getCollection,
    getCount: loader.getCount
  }
}
