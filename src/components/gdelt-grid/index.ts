import './styles.css'
import { cx } from './cx'

import { Component } from '@/core'
import { h, clearChildren } from '@/utils/dom'
import { DataGrid } from '@/components/data-grid'
import { Loader } from '@/components/loader'
import { GdeltModal } from '@/components/gdelt-modal'
import { GDELT_GRID } from '@/data/strings'
import { gdeltColumns } from './columns'
import { useGdelt, useAppStore } from '@/composables'
import type { GdeltArticle, DataGridColumn, SightingFilter } from '@/types'

export class GdeltGrid extends Component {
  private columns!: DataGridColumn<GdeltArticle>[]
  private grid: DataGrid<GdeltArticle> | null = null
  private gdelt = useGdelt()
  private store = useAppStore()

  protected create(): HTMLElement {
    this.columns = gdeltColumns()
    this.grid = null
    return h('div', { className: 'gdelt-grid-container' })
  }

  async load(): Promise<GdeltArticle[]> {
    this.showLoader()
    const articles = await this.gdelt.load()
    this.store.gdeltArticles.set(articles)
    this.render(articles)
    return articles
  }

  applyFilter(filter: SightingFilter): void {
    const filtered = this.gdelt.filterArticles(
      this.store.gdeltArticles.get(),
      filter
    )
    this.render(filtered)
  }

  getCount(): number {
    return this.store.gdeltArticles.get().length
  }

  render(articles: GdeltArticle[]): void {
    clearChildren(this.el)

    if (articles.length === 0) {
      this.el.appendChild(
        h('div', { className: cx.emptyState },
          h('span', { className: cx.emptyText }, GDELT_GRID.EMPTY)
        )
      )
      return
    }

    this.grid = new DataGrid<GdeltArticle>({
      columns: this.columns,
      data: articles,
      onRowClick: (article, trigger) => GdeltModal.open(article, trigger),
      emptyText: GDELT_GRID.EMPTY_FILTERED
    })

    this.el.appendChild(this.grid.el)
  }

  showLoader(loader?: HTMLElement): void {
    clearChildren(this.el)
    this.el.appendChild(
      loader ?? h('div', { className: 'app-loader' }, new Loader({}).el)
    )
  }
}
