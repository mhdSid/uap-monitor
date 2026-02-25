import { TagVariant } from '@/enums'
import type { TagProps, StatusTagProps } from '@/types'
import { h, text } from '@/utils/dom'

const TAG_STYLES: Record<TagVariant, { color: string, bg: string }> = {
  [TagVariant.ALERT]: { color: '#000', bg: 'var(--color-red)' },
  [TagVariant.USO]: { color: '#000', bg: 'var(--color-purple)' },
  [TagVariant.LIVE]: { color: 'var(--color-green)', bg: 'transparent' },
  [TagVariant.NEW]: { color: '#000', bg: 'var(--color-amber)' },
  [TagVariant.DISABLED]: { color: 'var(--color-muted)', bg: 'transparent' },
}

export function renderTag(props: TagProps): HTMLElement {
  const style = TAG_STYLES[props.variant]
  return h('span', {
    className: 'tag',
    style: {
      color: style.color,
      borderColor: style.bg === 'transparent' ? style.color : style.bg,
      backgroundColor: style.bg,
    },
  }, props.label ?? props.variant)
}

export function renderLiveTag(): HTMLElement {
  return h('span', { className: 'tag tag--live' },
    h('span', { className: 'tag__dot tag__dot--blink' }),
    text('LIVE'),
  )
}

export function renderStatusTag(props: StatusTagProps): HTMLElement {
  const colorMap: Record<string, string> = {
    VERIFIED: 'var(--color-green)',
    PENDING: 'var(--color-amber)',
    ANALYZING: 'var(--color-cyan)',
    DEBUNKED: 'var(--color-red)',
  }
  const color = colorMap[props.status] ?? 'var(--color-muted)'
  return h('span', {
    className: 'tag',
    style: { color, borderColor: color },
  }, props.status)
}
