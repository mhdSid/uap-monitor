import type { DataSourcesProps } from '@/types'
import { DataSourceStatus } from '@/enums'
import { h } from '@/utils/dom'

export function renderDataSources(props: DataSourcesProps): HTMLElement {
  const wrapper = h('div', { className: 'data-sources' })

  for (const source of props.sources) {
    let dotColor = 'var(--color-muted)'
    if (source.status === DataSourceStatus.ONLINE) dotColor = 'var(--color-green)'
    else if (source.status === DataSourceStatus.SYNCING) dotColor = 'var(--color-amber)'

    const isDisabled = source.status === DataSourceStatus.DISABLED

    const dot = h('span', {
      className: 'data-sources__dot',
      style: { backgroundColor: dotColor },
    })

    const label = h('span', { className: 'data-sources__label' }, source.label)

    const itemClass = isDisabled
      ? 'data-sources__item data-sources__item--disabled'
      : 'data-sources__item'

    if (source.url) {
      const link = h('a', {
        className: itemClass,
        href: source.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: source.description || source.label,
        'aria-label': `${source.label} — ${source.description || ''}`,
      }, dot, label)

      wrapper.appendChild(link)
    } else {
      const item = h('div', {
        className: itemClass,
        title: source.description || source.label,
      }, dot, label)

      wrapper.appendChild(item)
    }
  }

  return wrapper
}
