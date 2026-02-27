import { Component } from '@/core'
import type { DataSourcesProps, DataSource } from '@/types'
import { DataSourceStatus } from '@/enums'
import { h } from '@/utils/dom'

const STATUS_DOT_COLORS: Record<DataSourceStatus, string> = {
  [DataSourceStatus.ONLINE]: 'var(--color-green)',
  [DataSourceStatus.SYNCING]: 'var(--color-amber)',
  [DataSourceStatus.OFFLINE]: 'var(--color-muted)',
  [DataSourceStatus.DISABLED]: 'var(--color-muted)',
}

export class DataSources extends Component<DataSourcesProps> {
  protected create(): HTMLElement {
    const wrapper = h('div', { className: 'data-sources' })

    for (const source of this.props.sources) {
      wrapper.appendChild(this.renderItem(source))
    }

    return wrapper
  }

  private renderItem(source: DataSource): HTMLElement {
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

    // Raw data link badge
    if (source.dataUrl && !isDisabled) {
      itemContent.push(
        h('a', {
          className: 'data-sources__data-link',
          href: source.dataUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          title: 'View raw data',
          'aria-label': `Raw data for ${source.label}`,
          onClick: (e: Event) => e.stopPropagation(),
        }, source.dataLabel || 'JSON'),
      )
    }

    if (source.url) {
      return h('a', {
        className: itemClass,
        href: source.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: source.description || source.label,
        'aria-label': `${source.label} — ${source.description || ''}`,
      }, ...itemContent)
    }

    return h('div', {
      className: itemClass,
      title: source.description || source.label,
    }, ...itemContent)
  }
}
