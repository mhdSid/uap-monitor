import { h } from '@/utils/dom'
import { formatDate, formatDateCompact } from '@/utils/format'
import { cx } from './cx'
import { GDELT_TONE_BANDS, GDELT_TONE_TOOLTIP } from '@/data/strings'
import type { GdeltArticle, DataGridColumn } from '@/types'

// ─── Tone band mapping ──────────────────────────────────────────────

interface ToneBand {
  label: string
  cx: string
}

function getToneBand(tone: number): ToneBand {
  if (tone > 5)  return { label: GDELT_TONE_BANDS.VERY_POSITIVE.label, cx: cx.toneVeryPositive }
  if (tone > 0)  return { label: GDELT_TONE_BANDS.POSITIVE.label,      cx: cx.tonePositive }
  if (tone < -5) return { label: GDELT_TONE_BANDS.VERY_NEGATIVE.label, cx: cx.toneVeryNegative }
  if (tone < 0)  return { label: GDELT_TONE_BANDS.NEGATIVE.label,      cx: cx.toneNegative }
  return                  { label: GDELT_TONE_BANDS.NEUTRAL.label,       cx: cx.toneNeutral }
}

// ─── Columns ────────────────────────────────────────────────────────

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
    {
      key: 'tone',
      label: 'TONE',
      width: '110px',
      align: 'right',
      tooltip: GDELT_TONE_TOOLTIP,
      render: (row) => {
        const band = getToneBand(row.tone)
        return h('span', { className: `${cx.toneTag} ${band.cx}` }, band.label)
      }
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
