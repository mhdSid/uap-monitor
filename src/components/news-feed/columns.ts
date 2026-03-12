import { h, addClass } from '@/utils/dom'
import { formatDate, formatDateCompact } from '@/utils/format'
import { cx } from './cx'
import { createToneTag, createNewsSourceTag, createIntelSourceTag, Tag } from '@/components/tags'
import { INTEL_FEED } from '@/data/strings'
import type { IntelArticle, DataGridColumn } from '@/types'
import { TagSize, TagVariant } from '@/enums'

const BADGE_LABEL: Record<string, string> = {
  gdelt: INTEL_FEED.SOURCE_GDELT,
  gnews: INTEL_FEED.SOURCE_GNEWS,
  twitter: INTEL_FEED.SOURCE_TWITTER,
  reddit: INTEL_FEED.SOURCE_REDDIT
}

export function intelFeedColumns (): DataGridColumn<IntelArticle>[] {
  return [
    {
      key: 'title',
      label: 'HEADLINE',
      width: '55%',
      sortable: false,
      render: (row) => {
        const metaParts = [row.sourceName, row.country?.toUpperCase()].filter(Boolean)

        const root = h('div', { className: cx.root },
          h('span', { className: cx.title }, row.title || '—')
        )

        if (row.description) {
          root.appendChild(h('span', { className: cx.desc }, row.description))
        }

        root.appendChild(h('span', { className: cx.meta }, metaParts.join(' · ')))

        const bottom = h('span', { className: cx.bottom },
          createIntelSourceTag(row.intelSource, BADGE_LABEL[row.intelSource] || row.intelSource),
          createNewsSourceTag(row.domain || row.sourceName)
        )

        // Inline tone for mobile (column hidden on SP)
        if (row.tone != null) {
          const inlineTone = createToneTag(row.tone)
          addClass(inlineTone, cx.inlineTone)
          bottom.appendChild(inlineTone)
        }

        root.appendChild(bottom)

        return root
      }
    },
    {
      key: 'tone',
      label: 'TONE',
      width: '110px',
      align: 'right',
      render: (row) => row.tone != null ? createToneTag(row.tone) : new Tag({ variant: TagVariant.DISABLED, label: 'N/A', size: TagSize.RESPONSIVE }).el
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
