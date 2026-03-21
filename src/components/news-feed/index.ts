import './styles.css'
import { cx } from './cx'

import { Component } from '@/core'
import { h, clearChildren, setText } from '@/core/dom'
import { DataGrid } from '@/components/data-grid'
import { Loader } from '@/components/loader'
import { TextInput } from '@/components/text-input'
import { ChipGroup } from '@/components/chip'
import { GdeltModal } from '@/components/gdelt-modal'
import { GnewsModal } from '@/components/gnews-modal'
import { TwitterModal } from '@/components/twitter-modal'
import { RedditModal } from '@/components/reddit-modal'
import { INTEL_FEED, ARIA } from '@/data/strings'
import { ComponentSize } from '@/enums'
import { intelFeedColumns } from './columns'
import { useGdelt, useGnews, useTwitter, useReddit, useAppStore, useDebounce } from '@/composables'
import { tokenMatch } from '@/utils/search'
import type { IntelArticle, GdeltArticle, GnewsArticle, TwitterArticle, RedditArticle, DataGridColumn, SightingFilter } from '@/types'
import { createCountTag } from '../tags'

// ─── Helpers ────────────────────────────────────────────────────────

function gdeltToIntel (a: GdeltArticle): IntelArticle {
  return {
    id: a.id,
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
    sourceName: a.sourceName || a.domain,
    intelSource: 'gdelt',
    tone: a.tone,
    country: a.country,
    domain: a.domain,
    imageUrl: a.imageUrl
  }
}

function gnewsToIntel (a: GnewsArticle): IntelArticle {
  return {
    id: a.id,
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
    sourceName: a.sourceName,
    intelSource: 'gnews',
    description: a.description,
    imageUrl: a.imageUrl
  }
}

function twitterToIntel (a: TwitterArticle): IntelArticle {
  return {
    id: a.id,
    title: a.text,
    url: a.url,
    publishedAt: a.publishedAt,
    sourceName: a.authorUsername ? `@${a.authorUsername}` : a.authorName,
    intelSource: 'twitter',
    imageUrl: a.imageUrl,
    authorUsername: a.authorUsername,
    authorVerified: a.authorVerified,
    likeCount: a.likeCount,
    repostCount: a.repostCount
  }
}

function redditToIntel (a: RedditArticle): IntelArticle {
  return {
    id: a.id,
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
    sourceName: a.sourceName,
    intelSource: 'reddit',
    description: a.description,
    imageUrl: a.imageUrl,
    subreddit: a.subreddit,
    commentCount: a.commentCount,
    score: a.score,
    domain: a.domain
  }
}

/** Source priority: lower = higher rank when publishedAt is equal */
const SOURCE_PRIORITY: Record<string, number> = {
  twitter: 0,
  reddit: 1,
  gnews: 2,
  gdelt: 3
}

function mergeAndDedupe (
  twitter: TwitterArticle[],
  reddit: RedditArticle[],
  gnews: GnewsArticle[],
  gdelt: GdeltArticle[]
): IntelArticle[] {
  const seen = new Set<string>()
  const merged: IntelArticle[] = []

  for (const a of twitter) {
    if (!seen.has(a.id)) { seen.add(a.id); merged.push(twitterToIntel(a)) }
  }
  for (const a of reddit) {
    if (!seen.has(a.id)) { seen.add(a.id); merged.push(redditToIntel(a)) }
  }
  for (const a of gnews) {
    if (!seen.has(a.url)) { seen.add(a.url); merged.push(gnewsToIntel(a)) }
  }
  for (const a of gdelt) {
    if (!seen.has(a.url)) { seen.add(a.url); merged.push(gdeltToIntel(a)) }
  }

  merged.sort((a, b) => {
    const srcCompare = (SOURCE_PRIORITY[a.intelSource] ?? 9) - (SOURCE_PRIORITY[b.intelSource] ?? 9)
    if (srcCompare !== 0) return srcCompare
    return b.publishedAt.localeCompare(a.publishedAt)
  })
  return merged
}

// ─── Lookup maps for modal routing ──────────────────────────────────

let gdeltLookup = new Map<string, GdeltArticle>()
let gnewsLookup = new Map<string, GnewsArticle>()
let twitterLookup = new Map<string, TwitterArticle>()
let redditLookup = new Map<string, RedditArticle>()

function buildLookups (
  gdelt: GdeltArticle[],
  gnews: GnewsArticle[],
  twitter: TwitterArticle[],
  reddit: RedditArticle[]
): void {
  gdeltLookup = new Map(gdelt.map(a => [a.id, a]))
  gnewsLookup = new Map(gnews.map(a => [a.id, a]))
  twitterLookup = new Map(twitter.map(a => [a.id, a]))
  redditLookup = new Map(reddit.map(a => [a.id, a]))
}

// ─── Component ──────────────────────────────────────────────────────

export class NewsFeed extends Component {
  private columns!: DataGridColumn<IntelArticle>[]
  private grid: DataGrid<IntelArticle> | null = null
  private gdelt = useGdelt()
  private gnews = useGnews()
  private twitter = useTwitter()
  private reddit = useReddit()
  private store = useAppStore()
  private allArticles: IntelArticle[] = []
  private baseArticles: IntelArticle[] = []
  private searchQuery = ''
  private searchInput!: TextInput
  private sourceChips!: ChipGroup
  private contentEl!: HTMLElement
  private countTag!: HTMLElement

  protected create (): HTMLElement {
    this.columns = intelFeedColumns()
    this.grid = null

    this.searchInput = new TextInput({
      id: 'intel-search',
      name: 'intel-search',
      placeholder: INTEL_FEED.SEARCH_PLACEHOLDER,
      ariaLabel: ARIA.SEARCH_INTEL,
      size: ComponentSize.MD,
      clearable: true,
      onInput: (val) => {
        this.searchQuery = val
        if (!val) {
          this.debouncedSearch.flush()
          this.applyInlineSearch()
        } else {
          this.debouncedSearch()
        }
      },
      onClear: () => {
        this.searchQuery = ''
        this.debouncedSearch.flush()
        this.applyInlineSearch()
      }
    })

    this.sourceChips = new ChipGroup({
      size: ComponentSize.MD,
      items: [
        { key: 'twitter', label: INTEL_FEED.SOURCE_TWITTER, color: 'var(--color-cyan)' },
        { key: 'reddit', label: INTEL_FEED.SOURCE_REDDIT, color: 'var(--color-reddit)' },
        { key: 'gnews', label: INTEL_FEED.SOURCE_GNEWS, color: 'var(--color-amber)' },
        { key: 'gdelt', label: INTEL_FEED.SOURCE_GDELT, color: 'var(--color-green)' }
      ],
      onChange: () => this.applyInlineSearch()
    })

    this.contentEl = h('div', { className: cx.content })

    this.updateCountTag(this.baseArticles)

    return h('div', { className: 'intel-feed-container' },
      h('div', { className: cx.searchBar },
        this.searchInput.el,
        h('div', { className: cx.chipBar }, this.sourceChips.el, this.countTag)
      ),
      this.contentEl
    )
  }

  private debouncedSearch = useDebounce(() => this.applyInlineSearch(), 200)

  private applyInlineSearch (): void {
    const activeSources = this.sourceChips.activeKeys
    const sourceFiltered = this.baseArticles.filter(a => activeSources.has(a.intelSource))

    if (!this.searchQuery) {
      this.updateCountTag(sourceFiltered)
      this.renderGrid(sourceFiltered)
      return
    }

    const filtered = sourceFiltered.filter(a =>
      tokenMatch(
        this.searchQuery,
        a.title, a.description, a.sourceName,
        a.domain, a.country, a.intelSource,
        a.publishedAt?.slice(0, 10)
      )
    )

    this.updateCountTag(filtered)

    this.renderGrid(filtered)
  }

  private updateCountTag (articles: IntelArticle[]) {
    const countTagText = articles?.length ?? '-'

    if (!this.countTag) {
      this.countTag = createCountTag(countTagText.toString())
      return
    }

    setText(this.countTag, countTagText.toString())
  }

  // ─── Public API ─────────────────────────────────────────────────

  async load (): Promise<IntelArticle[]> {
    this.showLoader()

    const [gdeltArticles, gnewsArticles, twitterArticles, redditArticles] = await Promise.all([
      this.gdelt.load(),
      this.gnews.load(),
      this.twitter.load(),
      this.reddit.load()
    ])

    this.store.gdeltArticles.set(gdeltArticles)
    this.store.gnewsArticles.set(gnewsArticles)
    this.store.twitterArticles.set(twitterArticles)
    this.store.redditArticles.set(redditArticles)

    buildLookups(gdeltArticles, gnewsArticles, twitterArticles, redditArticles)
    this.allArticles = mergeAndDedupe(twitterArticles, redditArticles, gnewsArticles, gdeltArticles)
    this.baseArticles = this.allArticles

    this.updateCountTag(this.baseArticles)

    this.renderGrid(this.allArticles)
    return this.allArticles
  }

  applyFilter (filter: SightingFilter): void {
    // Global filter narrows from allArticles → baseArticles
    if (!filter.search) {
      this.baseArticles = this.allArticles
    } else {
      const lower = filter.search.toLowerCase()
      this.baseArticles = this.allArticles.filter(a =>
        a.title.toLowerCase().includes(lower) ||
        (a.sourceName && a.sourceName.toLowerCase().includes(lower)) ||
        (a.description && a.description.toLowerCase().includes(lower)) ||
        (a.country && a.country.toLowerCase().includes(lower))
      )
    }

    // Then apply inline search on top
    this.applyInlineSearch()
  }

  getCount (): number {
    return this.allArticles.length
  }

  private renderGrid (articles: IntelArticle[]): void {
    // Destroy previous grid (cleans up IntersectionObserver)
    this.grid?.destroy()
    this.grid = null

    clearChildren(this.contentEl)

    if (articles.length === 0) {
      this.contentEl.appendChild(
        h('div', { className: cx.emptyState },
          h('span', { className: cx.emptyText },
            this.allArticles.length === 0 ? INTEL_FEED.EMPTY : INTEL_FEED.EMPTY_FILTERED
          )
        )
      )
      return
    }

    this.grid = new DataGrid<IntelArticle>({
      columns: this.columns,
      data: articles,
      onRowClick: (article, trigger) => this.openModal(article, trigger),
      emptyText: INTEL_FEED.EMPTY_FILTERED
    })

    this.contentEl.appendChild(this.grid.el)
  }

  private openModal (article: IntelArticle, trigger: HTMLElement): void {
    if (article.intelSource === 'gdelt') {
      const original = gdeltLookup.get(article.id)
      if (original) GdeltModal.open(original, trigger)
    } else if (article.intelSource === 'gnews') {
      const original = gnewsLookup.get(article.id)
      if (original) GnewsModal.open(original, trigger)
    } else if (article.intelSource === 'twitter') {
      const original = twitterLookup.get(article.id)
      if (original) TwitterModal.open(original, trigger)
    } else if (article.intelSource === 'reddit') {
      const full = redditLookup.get(article.id)
      if (full) RedditModal.open(full, trigger)
      return
    }
  }

  showLoader (loader?: HTMLElement): void {
    clearChildren(this.contentEl)
    this.contentEl.appendChild(
      loader ?? h('div', { className: 'app-loader' }, new Loader({}).el)
    )
  }

  destroy (): void {
    this.grid?.destroy()
    super.destroy()
  }
}
