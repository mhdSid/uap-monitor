import type { RedditArticle, RedditCollection, SightingFilter } from '@/types'
import { createArticleLoader } from './use-fetch'

const loader = createArticleLoader<RedditArticle, RedditCollection>({
  file: 'reddit-articles.json',
  label: 'Reddit',
  searchFields: ['title', 'description', 'content', 'authorName', 'subreddit', 'sourceName']
})

export function useReddit () {
  function filterArticles (articles: RedditArticle[], filter: SightingFilter) {
    return loader.filterArticles(articles, filter.search ?? '')
  }

  return {
    load: loader.load,
    filterArticles,
    getCollection: loader.getCollection,
    getCount: loader.getCount
  }
}
