import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import type { DataSourcesProps, DataSource } from '@/types'
import { DataSourceStatus } from '@/enums'
import { h } from '@/utils/dom'
import { createDataSourceTag } from '@/components/tags'

export class DataSources extends Component<DataSourcesProps> {
  protected create(): HTMLElement {
    const wrapper = h('div', { className: cx.root })

    for (const source of this.props.sources) {
      wrapper.appendChild(this.renderItem(source))
    }

    return wrapper
  }

  private renderItem(source: DataSource): HTMLElement {
    const isDisabled = source.status === DataSourceStatus.DISABLED
    const tag = createDataSourceTag(source.label, source.status, isDisabled)

    if (source.url) {
      const link = h('a', {
        className: cx.item,
        href: source.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: source.description || source.label,
        'aria-label': `${source.label} — ${source.description || ''}`
      })
      link.appendChild(tag)
      return link
    }

    const item = h('div', {
      className: cx.item,
      title: source.description || source.label
    })
    item.appendChild(tag)
    return item
  }
}
