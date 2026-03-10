import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { formatLocation } from '@/utils/format'
import type { Sighting } from '@/types'

export interface BookmarkListItemProps {
  sighting: Sighting
  onClick: (sighting: Sighting) => void
}

export class BookmarkListItem extends Component<BookmarkListItemProps> {
  protected create (): HTMLElement {
    const { sighting: s, onClick } = this.props

    const date = s.occurredAt ? s.occurredAt.slice(0, 10) : '—'
    const location = formatLocation(s.region, s.country)
    const src = s.subSource || s.source
    const metaParts = [date, src, s.shape].filter(Boolean).join(' · ')

    const item = h('div', { className: cx.item },
      h('span', { className: cx.itemSummary },
        (s.summary || '—').slice(0, 120) + ((s.summary?.length ?? 0) > 120 ? '…' : '')
      ),
      h('span', { className: cx.itemLocation }, location),
      h('span', { className: cx.itemMeta }, metaParts)
    )

    item.addEventListener('click', () => onClick(s))

    return item
  }
}
