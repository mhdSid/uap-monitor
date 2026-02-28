import { Component } from '@/core'
import type { SectionProps } from '@/types'
import { h } from '@/utils/dom'
import { LiveTag } from '@/components/tags'
import { Tooltip } from '@/components/tooltip'
import { cx } from './cx'

export interface SectionCreateProps extends SectionProps {
  content: HTMLElement
}

export class Section extends Component<SectionCreateProps> {
  protected create(): HTMLElement {
    const { title, live, tooltip, tag, count, content } = this.props

    const header = h('div', { className: cx.header },
      h('span', { className: cx.title }, title)
    )

    if (live) header.appendChild(new LiveTag({}).el)
    if (tooltip) header.appendChild(new Tooltip({ content: tooltip, ariaLabel: `About ${title}` }).el)
    if (tag) header.appendChild(tag)
    if (count !== undefined) {
      header.appendChild(
        h('span', { className: cx.count }, String(count))
      )
    }

    return h('div', { className: cx.root },
      header,
      h('div', { className: cx.body }, content)
    )
  }
}
