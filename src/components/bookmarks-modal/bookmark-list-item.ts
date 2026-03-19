import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/core/dom'
import { formatLocation } from '@/utils/format'
import { ActionMenu } from '@/components/action-menu'
import { iconRadarSignalFilled, iconShare } from '@/components/icons'
import type { Sighting } from '@/types'
import { ACTION_MENU_LABELS, ARIA } from '@/data/strings'
import { cx as actionMenuCx } from '../action-menu/cx'
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
      ariaLabel: ARIA.SIGHTING_ACTIONS,
      items: [
        {
          label: ACTION_MENU_LABELS.REMOVE_BOOKMARK,
          icon: () => iconRadarSignalFilled(16),
          onClick: () => onRemove(s)
        },
        {
          label: ACTION_MENU_LABELS.SHARE,
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
      if ((e.target as HTMLElement).closest(actionMenuCx.trigger)) return
      onClick(s)
    })

    return item
  }
}
