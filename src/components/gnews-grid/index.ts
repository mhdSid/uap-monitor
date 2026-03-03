import './styles.css'
import { cx } from './cx'

import { Component } from '@/core'
import { h, clearChildren } from '@/utils/dom'
import { DataGrid } from '@/components/data-grid'
import { GnewsModal } from '@/components/gnews-modal'
import { GNEWS_GRID } from '@/data/strings'
import { gnewsColumns } from './columns'
import type { GnewsArticle, DataGridColumn } from '@/types'

export class GnewsGrid extends Component {
  private columns!: DataGridColumn<GnewsArticle>[]
  private grid: DataGrid<GnewsArticle> | null = null

  protected create(): HTMLElement {
    this.columns = gnewsColumns()
    this.grid = null
    return h('div', { className: 'gnews-grid-container' })
  }

  render(articles: GnewsArticle[]): void {
    clearChildren(this.el)

    if (articles.length === 0) {
      this.el.appendChild(
        h('div', { className: cx.emptyState },
          h('span', { className: cx.emptyText }, GNEWS_GRID.EMPTY)
        )
      )
      return
    }

    this.grid = new DataGrid<GnewsArticle>({
      columns: this.columns,
      data: articles,
      onRowClick: (article, trigger) => GnewsModal.open(article, trigger),
      emptyText: GNEWS_GRID.EMPTY_FILTERED
    })

    this.el.appendChild(this.grid.el)
  }

  showLoader(loader: HTMLElement): void {
    clearChildren(this.el)
    this.el.appendChild(loader)
  }
}
