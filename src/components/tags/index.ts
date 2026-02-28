import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { TagVariant, SightingStatus } from '@/enums'
import type { TagProps, StatusTagProps } from '@/types'
import { h, text } from '@/utils/dom'

const TAG_STYLES: Record<TagVariant, { color: string; bg: string }> = {
  [TagVariant.ALERT]: { color: 'var(--c-black)', bg: 'var(--color-red)' },
  [TagVariant.USO]: { color: 'var(--c-black)', bg: 'var(--color-purple)' },
  [TagVariant.LIVE]: { color: 'var(--color-green)', bg: 'transparent' },
  [TagVariant.NEW]: { color: 'var(--c-black)', bg: 'var(--color-amber)' },
  [TagVariant.DISABLED]: { color: 'var(--color-muted)', bg: 'transparent' }
}

const STATUS_COLORS: Record<SightingStatus, string> = {
  [SightingStatus.VERIFIED]: 'var(--color-green)',
  [SightingStatus.PENDING]: 'var(--color-amber)',
  [SightingStatus.ANALYZING]: 'var(--color-cyan)',
  [SightingStatus.DEBUNKED]: 'var(--color-red)'
}

const STATUS_FALLBACK_COLOR = 'var(--color-muted)'

export class Tag extends Component<TagProps> {
  protected create(): HTMLElement {
    const style = TAG_STYLES[this.props.variant]
    return h('span', {
      className: cx.root,
      style: {
        color: style.color,
        borderColor: style.bg === 'transparent' ? style.color : style.bg,
        backgroundColor: style.bg
      }
    }, this.props.label ?? this.props.variant)
  }
}

export class LiveTag extends Component {
  protected create(): HTMLElement {
    return h('span', { className: `${cx.root} ${cx.live}` },
      h('span', { className: `${cx.dot} ${cx.dotBlink}` }),
      text('LIVE')
    )
  }
}

export class StatusTag extends Component<StatusTagProps> {
  protected create(): HTMLElement {
    const color = STATUS_COLORS[this.props.status as SightingStatus] ?? STATUS_FALLBACK_COLOR
    return h('span', {
      className: cx.root,
      style: { color, borderColor: color }
    }, this.props.status)
  }
}
