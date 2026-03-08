import './styles.css'
import { cx } from './cx'

import { Component } from '@/core'
import { h, clearChildren } from '@/utils/dom'
import { DataGrid } from '@/components/data-grid'
import { Loader } from '@/components/loader'
import { GdeltModal } from '@/components/gdelt-modal'
import { GnewsModal } from '@/components/gnews-modal'
import { INTEL_FEED } from '@/data/strings'
import { intelFeedColumns } from './columns'
import { useGdelt, useGnews, useAppStore } from '@/composables'
import type { IntelArticle, GdeltArticle, GnewsArticle, DataGridColumn, SightingFilter } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────

function gdeltToIntel(a: GdeltArticle): IntelArticle {
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

function gnewsToIntel(a: GnewsArticle): IntelArticle {
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

function mergeAndDedupe(gdelt: GdeltArticle[], gnews: GnewsArticle[]): IntelArticle[] {
  const seen = new Set<string>()
  const merged: IntelArticle[] = []

  for (const a of gdelt) {
    if (!seen.has(a.url)) {
      seen.add(a.url)
      merged.push(gdeltToIntel(a))
    }
  }

  for (const a of gnews) {
    if (!seen.has(a.url)) {
      seen.add(a.url)
      merged.push(gnewsToIntel(a))
    }
  }

  merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return merged
}

function filterArticles(articles: IntelArticle[], search: string): IntelArticle[] {
  if (!search) return articles
  const lower = search.toLowerCase()
  return articles.filter(a =>
    a.title.toLowerCase().includes(lower) ||
    (a.sourceName && a.sourceName.toLowerCase().includes(lower)) ||
    (a.description && a.description.toLowerCase().includes(lower)) ||
    (a.country && a.country.toLowerCase().includes(lower))
  )
}

// ─── Lookup maps for modal routing ──────────────────────────────────

let gdeltLookup = new Map<string, GdeltArticle>()
let gnewsLookup = new Map<string, GnewsArticle>()

function buildLookups(gdelt: GdeltArticle[], gnews: GnewsArticle[]): void {
  gdeltLookup = new Map(gdelt.map(a => [a.id, a]))
  gnewsLookup = new Map(gnews.map(a => [a.id, a]))
}

// ─── Component ──────────────────────────────────────────────────────

export class NewsFeed extends Component {
  private columns!: DataGridColumn<IntelArticle>[]
  private grid: DataGrid<IntelArticle> | null = null
  private gdelt = useGdelt()
  private gnews = useGnews()
  private store = useAppStore()
  private allArticles: IntelArticle[] = []

  protected create(): HTMLElement {
    this.columns = intelFeedColumns()
    this.grid = null
    return h('div', { className: 'intel-feed-container' })
  }

  async load(): Promise<IntelArticle[]> {
    this.showLoader()

    const [gdeltArticles, gnewsArticles] = await Promise.all([
      this.gdelt.load(),
      this.gnews.load()
    ])

    this.store.gdeltArticles.set(gdeltArticles)
    this.store.gnewsArticles.set(gnewsArticles)

    buildLookups(gdeltArticles, gnewsArticles)
    this.allArticles = mergeAndDedupe(gdeltArticles, gnewsArticles)
    this.render(this.allArticles)
    return this.allArticles
  }

  applyFilter(filter: SightingFilter): void {
    const filtered = filterArticles(this.allArticles, filter.search ?? '')
    this.render(filtered)
  }

  getCount(): number {
    return this.allArticles.length
  }

  render(articles: IntelArticle[]): void {
    clearChildren(this.el)

    if (articles.length === 0) {
      this.el.appendChild(
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

    this.el.appendChild(this.grid.el)
  }

  private openModal(article: IntelArticle, trigger: HTMLElement): void {
    if (article.intelSource === 'gdelt') {
      const original = gdeltLookup.get(article.id)
      if (original) GdeltModal.open(original, trigger)
    } else {
      const original = gnewsLookup.get(article.id)
      if (original) GnewsModal.open(original, trigger)
    }
  }

  showLoader(loader?: HTMLElement): void {
    clearChildren(this.el)
    this.el.appendChild(
      loader ?? h('div', { className: 'app-loader' }, new Loader({}).el)
    )
  }
}
