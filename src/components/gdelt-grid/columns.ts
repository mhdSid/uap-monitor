import { h } from '@/utils/dom'
import { formatDate, formatDateCompact } from '@/utils/format'
import { cx } from './cx'
import type { GdeltArticle, DataGridColumn } from '@/types'

export function gdeltColumns(): DataGridColumn<GdeltArticle>[] {
  return [
    {
      key: 'title',
      label: 'HEADLINE',
      width: '55%',
      sortable: false,
      render: (row) => {
        const country = row.country ? row.country.toUpperCase() : ''
        const metaParts = [row.sourceName || row.domain, country].filter(Boolean)

        return h('div', { className: cx.root },
          h('span', { className: cx.title }, row.title || '—'),
          h('span', { className: cx.meta }, metaParts.join(' · ')),
          h('span', { className: cx.bottom },
            h('span', { className: cx.domain }, row.domain),
            h('span', { className: cx.date }, formatDate(row.publishedAt))
          )
        )
      }
    },
    // {
    //   key: 'tone',
    //   label: 'TONE',
    //   width: '70px',
    //   align: 'right',
    //   render: (row) => {
    //     const cls = row.tone > 0 ? cx.tonePositive
    //       : row.tone < -3 ? cx.toneNegative
    //       : cx.tone
    //     const prefix = row.tone > 0 ? '+' : ''
    //     return h('span', { className: cls }, `${prefix}${row.tone}`)
    //   }
    // },
    // {
    //   key: 'language',
    //   label: 'LANG',
    //   width: '50px',
    //   align: 'center',
    //   render: (row) => h('span', { className: cx.lang }, (row.language || 'en').toUpperCase())
    // },
    {
      key: 'publishedAt',
      label: 'DATE',
      width: '90px',
      align: 'right',
      render: (row) => {
        const full = formatDate(row.publishedAt)
        const compact = formatDateCompact(row.publishedAt)
        return h('span', { className: cx.date, title: full }, compact)
      }
    }
  ]
}
