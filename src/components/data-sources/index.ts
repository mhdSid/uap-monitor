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
    wrapper.appendChild(
      h('div', {
        className: isDisabled
          ? 'data-sources__item data-sources__item--disabled'
          : 'data-sources__item',
      },
        h('span', {
          className: 'data-sources__dot',
          style: { backgroundColor: dotColor },
        }),
        h('span', { className: 'data-sources__label' }, source.label),
      ),
    )
  }

  return wrapper
}
