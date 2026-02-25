import type { SectionProps } from '@/types'
import { h } from '@/utils/dom'
import { renderLiveTag } from '@/components/tags'

export function renderSection(props: SectionProps, content: HTMLElement): HTMLElement {
  const header = h('div', { className: 'section__header' },
    h('span', { className: 'section__title' }, props.title),
  )

  if (props.live) {
    header.appendChild(renderLiveTag())
  }
  if (props.tag) {
    header.appendChild(props.tag)
  }
  if (props.count !== undefined) {
    header.appendChild(
      h('span', { className: 'section__count' }, String(props.count)),
    )
  }

  return h('div', { className: 'section' },
    header,
    h('div', { className: 'section__body' }, content),
  )
}
