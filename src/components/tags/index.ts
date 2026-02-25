import { TagVariant } from '@/enums'
import type { TagProps, StatusTagProps } from '@/types'
import { h, text } from '@/utils/dom'

const TAG_STYLES: Record<TagVariant, { color: string, bg: string }> = {
  [TagVariant.ALERT]: { color: '#000', bg: '#ef4444' },
  [TagVariant.USO]: { color: '#000', bg: '#8b5cf6' },
  [TagVariant.LIVE]: { color: '#00ff41', bg: 'transparent' },
  [TagVariant.NEW]: { color: '#000', bg: '#f59e0b' },
  [TagVariant.DISABLED]: { color: '#555', bg: 'transparent' },
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
    VERIFIED: '#00ff41',
    PENDING: '#f59e0b',
    ANALYZING: '#06b6d4',
    DEBUNKED: '#ef4444',
  }
  const color = colorMap[props.status] ?? '#555'
  return h('span', {
    className: 'tag',
    style: { color, borderColor: color },
  }, props.status)
}
