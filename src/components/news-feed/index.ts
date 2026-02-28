import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import type { NewsFeedProps } from '@/types'
import { h } from '@/utils/dom'
import { Tag } from '@/components/tags'

export class NewsFeed extends Component<NewsFeedProps> {
  protected create(): HTMLElement {
    const wrapper = h('div', { className: 'news-feed' })

    for (const item of this.props.items) {
      const meta = h('div', { className: cx.meta },
        h('span', { className: cx.source }, item.source)
      )
      if (item.tag) {
        meta.appendChild(new Tag({ variant: item.tag }).el)
      }
      meta.appendChild(h('span', { className: cx.time }, item.time))

      wrapper.appendChild(
        h('div', { className: cx.item },
          meta,
          h('div', { className: cx.text }, item.text)
        )
      )
    }

    return wrapper
  }
}
