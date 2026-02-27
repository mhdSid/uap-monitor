import { Component } from '@/core'
import type { SectionProps } from '@/types'
import { h } from '@/utils/dom'
import { LiveTag } from '@/components/tags'
import { Tooltip } from '@/components/tooltip'

export interface SectionCreateProps extends SectionProps {
  content: HTMLElement
}

export class Section extends Component<SectionCreateProps> {
  protected create(): HTMLElement {
    const { title, live, tooltip, tag, count, content } = this.props

    const header = h('div', { className: 'section__header' },
      h('span', { className: 'section__title' }, title),
    )

    if (live) header.appendChild(new LiveTag({}).el)
    if (tooltip) header.appendChild(new Tooltip({ content: tooltip, ariaLabel: `About ${title}` }).el)
    if (tag) header.appendChild(tag)
    if (count !== undefined) {
      header.appendChild(
        h('span', { className: 'section__count' }, String(count)),
      )
    }

    return h('div', { className: 'section' },
      header,
      h('div', { className: 'section__body' }, content),
    )
  }
}
