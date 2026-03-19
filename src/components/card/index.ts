import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/core/dom'

export interface CardProps {
  children: HTMLElement[]
  onClick?: (e: MouseEvent) => void
}

export class Card extends Component<CardProps> {
  protected create (): HTMLElement {
    const interactive = !!this.props.onClick

    const root = h('article', {
      className: interactive ? `${cx.root} ${cx.clickable}` : cx.root,
      tabIndex: interactive ? 0 : undefined,
      role: interactive ? 'button' : undefined
    }, ...this.props.children)

    if (interactive) {
      root.addEventListener('click', (e: MouseEvent) => {
        this.props.onClick!(e)
      })
      root.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          this.props.onClick!(e as unknown as MouseEvent)
        }
      })
    }

    return root
  }
}
