import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { Card } from '@/components/card'

export interface HighlightCardProps {
  year: string
  location: string
  headline: string
  onClick?: (e: MouseEvent) => void
}

export class HighlightCard extends Component<HighlightCardProps> {
  protected create (): HTMLElement {
    const content = [
      h('span', { className: cx.year }, this.props.year),
      h('span', { className: cx.location }, this.props.location),
      h('p', { className: cx.headline }, this.props.headline)
    ]

    const card = new Card({
      children: content,
      onClick: this.props.onClick
    })

    card.el.classList.add(cx.root)
    return card.el
  }
}
