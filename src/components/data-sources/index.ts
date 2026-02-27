import type { DataSourcesProps } from '@/types'
import { DataSourceStatus } from '@/enums'
import { h } from '@/utils/dom'

const STATUS_DOT_COLORS: Record<DataSourceStatus, string> = {
  [DataSourceStatus.ONLINE]: 'var(--color-green)',
  [DataSourceStatus.SYNCING]: 'var(--color-amber)',
  [DataSourceStatus.OFFLINE]: 'var(--color-muted)',
  [DataSourceStatus.DISABLED]: 'var(--color-muted)',
}

export function renderDataSources(props: DataSourcesProps): HTMLElement {
  const wrapper = h('div', { className: 'data-sources' })

  for (const source of props.sources) {
    const dotColor = STATUS_DOT_COLORS[source.status]
    const isDisabled = source.status === DataSourceStatus.DISABLED

    const dot = h('span', {
      className: 'data-sources__dot',
      style: { backgroundColor: dotColor },
    })

    const label = h('span', { className: 'data-sources__label' }, source.label)

    const itemClass = isDisabled
      ? 'data-sources__item data-sources__item--disabled'
      : 'data-sources__item'

    const itemContent: HTMLElement[] = [dot, label]

    // Add raw data link badge for sources that expose their JSON
    if (source.dataUrl && !isDisabled) {
      const dataLink = h('a', {
        className: 'data-sources__data-link',
        href: source.dataUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'View raw JSON data',
        'aria-label': `Raw JSON data for ${source.label}`,
        onClick: (e: Event) => e.stopPropagation(),
      }, 'JSON')
      itemContent.push(dataLink)
    }

    if (source.url) {
      const link = h('a', {
        className: itemClass,
        href: source.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: source.description || source.label,
        'aria-label': `${source.label} — ${source.description || ''}`,
      }, ...itemContent)

      wrapper.appendChild(link)
    } else {
      const item = h('div', {
        className: itemClass,
        title: source.description || source.label,
      }, ...itemContent)

      wrapper.appendChild(item)
    }
  }

  return wrapper
}
