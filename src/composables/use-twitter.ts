import type { TwitterArticle, TwitterCollection, SightingFilter } from '@/types'
import { createArticleLoader } from './use-fetch'

const loader = createArticleLoader<TwitterArticle, TwitterCollection>({
  file: 'twitter-articles.json',
  label: 'Twitter',
  searchFields: ['text', 'authorName', 'authorUsername']
})

export function useTwitter () {
  function filterArticles (articles: TwitterArticle[], filter: SightingFilter) {
    return loader.filterArticles(articles, filter.search ?? '')
  }

  return {
    load: loader.load,
    filterArticles,
    getCollection: loader.getCollection,
    getCount: loader.getCount
  }
}
