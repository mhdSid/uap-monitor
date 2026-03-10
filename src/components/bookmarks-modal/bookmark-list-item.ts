import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { formatLocation } from '@/utils/format'
import { ActionMenu } from '@/components/action-menu'
import { iconRadarSignalFilled, iconShare } from '@/components/icons'
import type { Sighting } from '@/types'

export interface BookmarkListItemProps {
  sighting: Sighting
  onClick: (sighting: Sighting) => void
  onRemove: (sighting: Sighting) => void
  onShare: (sighting: Sighting) => void
}

export class BookmarkListItem extends Component<BookmarkListItemProps> {
  protected create (): HTMLElement {
    const { sighting: s, onClick, onRemove, onShare } = this.props

    const date = s.occurredAt ? s.occurredAt.slice(0, 10) : '—'
    const location = formatLocation(s.region, s.country)
    const src = s.subSource || s.source
    const metaParts = [date, src, s.shape].filter(Boolean).join(' · ')

    const menu = new ActionMenu({
      ariaLabel: 'Sighting actions',
      items: [
        {
          label: 'Remove bookmark',
          icon: () => iconRadarSignalFilled(16),
          onClick: () => onRemove(s)
        },
        {
          label: 'Share',
          icon: () => iconShare(16),
          onClick: () => onShare(s)
        }
      ]
    })

    const item = h('div', { className: cx.item },
      h('span', { className: cx.itemSummary },
        (s.summary || '—').slice(0, 120) + ((s.summary?.length ?? 0) > 120 ? '…' : '')
      ),
      h('span', { className: cx.itemLocation }, location),
      h('span', { className: cx.itemMeta }, metaParts),
      h('div', { className: cx.itemTrigger }, menu.el)
    )

    item.addEventListener('click', (e) => {
      // Don't navigate if clicking the menu trigger area
      if ((e.target as HTMLElement).closest('.action-menu__trigger')) return
      onClick(s)
    })

    return item
  }
}
