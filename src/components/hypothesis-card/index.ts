import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  HypothesisCard — clickable card for a single hypothesis result     *
 *                                                                     *
 *  Wraps Card (interactive), adds supported/refuted modifier,         *
 *  and delegates modal opening to the caller via onOpen prop.         *
 *  Pattern mirrors HighlightCard → Card.                              *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, addClass } from '@/core/dom'
import { Card } from '@/components/card'
import { Tag } from '@/components/tags'
import { TagVariant, TagSize } from '@/enums'
import { RESEARCH } from '@/data/strings'
import type { HypothesisEntry } from '@/components/hypothesis-modal'

// ─── Props ──────────────────────────────────────────────────────────

export interface HypothesisCardProps {
  entry: HypothesisEntry
  onOpen: (entry: HypothesisEntry, trigger: HTMLElement) => void
}

// ─── Component ──────────────────────────────────────────────────────

export class HypothesisCard extends Component<HypothesisCardProps> {
  protected create (): HTMLElement {
    const { entry, onOpen } = this.props

    const statusTag = new Tag({
      variant: entry.supported ? TagVariant.STATUS_VERIFIED : TagVariant.DISABLED,
      label: entry.supported ? RESEARCH.CARD_SUPPORTED : RESEARCH.CARD_NOT_SUPPORTED,
      size: TagSize.XS
    })

    const metaItems: HTMLElement[] = [statusTag.el]

    if (entry.effectSize != null) {
      metaItems.push(
        h('span', { className: cx.metaItem },
          RESEARCH.CARD_EFFECT,
          h('span', { className: cx.metaValue }, entry.effectSize.toFixed(3))
        )
      )
    }

    if (entry.chiSquared != null) {
      const df = entry.degreesOfFreedom != null ? `(${entry.degreesOfFreedom})` : ''
      metaItems.push(
        h('span', { className: cx.metaItem },
          `${RESEARCH.CARD_CHI}${df}`,
          h('span', { className: cx.metaValue }, entry.chiSquared.toFixed(1))
        )
      )
    }

    const card = new Card({
      children: [
        h('div', { className: cx.body },
          h('span', { className: cx.name }, entry.name),
          h('p', { className: cx.summary }, entry.summary),
          h('div', { className: cx.meta }, ...metaItems)
        )
      ],
      onClick: (_e) => onOpen(entry, card.el)
    })

    addClass(card.el, cx.root)
    addClass(card.el, entry.supported ? cx.supported : cx.refuted)

    return card.el
  }
}
