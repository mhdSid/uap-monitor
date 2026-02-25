import type { NewsFeedProps } from '@/types'
import { h } from '@/utils/dom'
import { renderTag } from '@/components/tags'

export function renderNewsFeed(props: NewsFeedProps): HTMLElement {
  const wrapper = h('div', { className: 'news-feed' })

  for (const item of props.items) {
    const meta = h('div', { className: 'news-feed__meta' },
      h('span', { className: 'news-feed__source' }, item.source),
    )
    if (item.tag) {
      meta.appendChild(renderTag({ variant: item.tag }))
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
