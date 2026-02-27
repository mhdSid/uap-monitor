import { Component } from '@/core'
import type { NewsFeedProps } from '@/types'
import { h } from '@/utils/dom'
import { Tag } from '@/components/tags'

export class NewsFeed extends Component<NewsFeedProps> {
  protected create(): HTMLElement {
    const wrapper = h('div', { className: 'news-feed' })

    for (const item of this.props.items) {
      const meta = h('div', { className: 'news-feed__meta' },
        h('span', { className: 'news-feed__source' }, item.source),
      )
      if (item.tag) {
        meta.appendChild(new Tag({ variant: item.tag }).el)
      }
      meta.appendChild(h('span', { className: 'news-feed__time' }, item.time))

      wrapper.appendChild(
        h('div', { className: 'news-feed__item' },
          meta,
          h('div', { className: 'news-feed__text' }, item.text),
        ),
      )
    }

    return wrapper
  }
}
