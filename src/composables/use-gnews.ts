import type { GnewsArticle, GnewsCollection, SightingFilter } from '@/types'
import { createArticleLoader } from './use-fetch'

const loader = createArticleLoader<GnewsArticle, GnewsCollection>({
  file: 'gnews-articles.json',
  label: 'GNews',
  searchFields: ['title', 'description', 'content', 'sourceName']
})

export function useGnews () {
  function filterArticles (articles: GnewsArticle[], filter: SightingFilter) {
    return loader.filterArticles(articles, filter.search ?? '')
  }

  return {
    load: loader.load,
    filterArticles,
    getCollection: loader.getCollection,
    getCount: loader.getCount
  }
}
