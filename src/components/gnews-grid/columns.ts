import { h } from '@/utils/dom'
import { formatDate, formatDateCompact } from '@/utils/format'
import { cx } from './cx'
import type { GnewsArticle, DataGridColumn } from '@/types'

export function gnewsColumns(): DataGridColumn<GnewsArticle>[] {
  return [
    {
      key: 'title',
      label: 'HEADLINE',
      width: '60%',
      sortable: false,
      render: (row) => {
        return h('div', { className: cx.root },
          h('span', { className: cx.title }, row.title || '\u2014'),
          row.description
            ? h('span', { className: cx.desc }, row.description)
            : h('span', {}),
          h('span', { className: cx.bottom },
            h('span', { className: cx.source }, row.sourceName || row.url),
            h('span', { className: cx.date }, formatDate(row.publishedAt))
          )
        )
      }
    },
    // {
    //   key: 'sourceName',
    //   label: 'SOURCE',
    //   width: '120px',
    //   align: 'left',
    //   render: (row) => h('span', { className: cx.source }, row.sourceName || '\u2014')
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
