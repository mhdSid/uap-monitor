import { h } from '@/utils/dom'
import { formatDate, formatDateCompact } from '@/utils/format'
import { cx } from './cx'
import { createToneTag, createNewsSourceTag } from '@/components/tags'
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
            createNewsSourceTag(row.domain)
          )
        )
      }
    },
    {
      key: 'tone',
      label: 'TONE',
      width: '110px',
      align: 'right',
      render: (row) => createToneTag(row.tone)
    },
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
