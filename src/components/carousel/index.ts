import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'

export interface CarouselProps {
  label: string
  children: HTMLElement[]
}

export class Carousel extends Component<CarouselProps> {
  protected create(): HTMLElement {
    const track = h('div', { className: cx.track }, ...this.props.children)

    return h('div', { className: cx.root, 'aria-label': this.props.label },
      track
    )
  }
}
