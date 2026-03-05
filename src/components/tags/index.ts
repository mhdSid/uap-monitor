import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { TagVariant, SightingStatus, DataSourceId, TagSize } from '@/enums'
import type { TagProps, StatusTagProps } from '@/types'
import { h, text } from '@/utils/dom'
import { GDELT_TONE_BANDS, TAGS } from '@/data/strings'
import { useMediaQuery } from '@/composables/use-media-query'
import { effect } from '@/composables'

interface TagStyle {
  color: string
  bg: string
  border?: string
}

const TAG_STYLES: Record<TagVariant, TagStyle> = {
  [TagVariant.ALERT]: { color: 'var(--c-black)', bg: 'var(--color-red)' },
  [TagVariant.USO]: { color: 'var(--c-black)', bg: 'var(--color-purple)' },
  [TagVariant.LIVE]: { color: 'var(--color-green)', bg: 'transparent' },
  [TagVariant.NEW]: { color: 'var(--c-black)', bg: 'var(--color-amber)' },
  [TagVariant.DISABLED]: { color: 'var(--color-muted)', bg: 'transparent' },
  [TagVariant.TONE_VERY_POSITIVE]: { color: 'var(--color-green)', bg: 'var(--c-green-400-08)' },
  [TagVariant.TONE_POSITIVE]: { color: 'var(--color-green)', bg: 'var(--c-green-400-08)' },
  [TagVariant.TONE_NEUTRAL]: { color: 'var(--color-muted)', bg: 'transparent' },
  [TagVariant.TONE_NEGATIVE]: { color: 'var(--color-amber)', bg: 'rgba(245, 158, 11, 0.06)' },
  [TagVariant.TONE_VERY_NEGATIVE]: { color: 'var(--color-amber)', bg: 'rgba(245, 158, 11, 0.08)' },
  [TagVariant.SOURCE_NUFORC]: { color: 'var(--color-green)', bg: 'var(--c-green-500-12)', border: 'var(--c-green-500-20)' },
  [TagVariant.SOURCE_HATCH]: { color: 'var(--color-cyan)', bg: 'var(--c-cyan-400-12)', border: 'var(--c-cyan-400-20)' },
  [TagVariant.SOURCE_CHRONOLOGY]: { color: 'var(--color-amber)', bg: 'var(--c-amber-400-12)', border: 'var(--c-amber-400-20)' },
  [TagVariant.SOURCE_EXPERIENCER]: { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.2)' },
  [TagVariant.SOURCE_NEWS]: { color: 'var(--color-green)', bg: 'var(--c-green-400-08)', border: 'var(--c-green-400-16)' },
  [TagVariant.STATUS_VERIFIED]: { color: 'var(--color-green)', bg: 'transparent' },
  [TagVariant.STATUS_PENDING]: { color: 'var(--color-amber)', bg: 'transparent' },
  [TagVariant.STATUS_ANALYZING]: { color: 'var(--color-cyan)', bg: 'transparent' },
  [TagVariant.STATUS_DEBUNKED]: { color: 'var(--color-red)', bg: 'transparent' }
}

const STATUS_VARIANT: Record<string, TagVariant> = {
  [SightingStatus.VERIFIED]: TagVariant.STATUS_VERIFIED,
  [SightingStatus.PENDING]: TagVariant.STATUS_PENDING,
  [SightingStatus.ANALYZING]: TagVariant.STATUS_ANALYZING,
  [SightingStatus.DEBUNKED]: TagVariant.STATUS_DEBUNKED
}

export class Tag extends Component<TagProps> {
  protected create(): HTMLElement {
    const style = TAG_STYLES[this.props.variant]
    const size = this.props.size ?? TagSize.MD
    const borderColor = style.border
      ?? (style.bg === 'transparent' ? style.color : style.bg)
    return h('span', {
      className: `${cx.root} ${cx[size]}`,
      style: {
        color: style.color,
        borderColor,
        backgroundColor: style.bg
      }
    }, this.props.label ?? this.props.variant)
  }
}

export class LiveTag extends Component {
  protected create(): HTMLElement {
    const tag = new Tag({ variant: TagVariant.LIVE, label: TAGS.LIVE })
    const dot = h('span', { className: `${cx.dot} ${cx.dotBlink}` })
    tag.el.prepend(dot)
    return tag.el
  }
}

export class StatusTag extends Component<StatusTagProps> {
  protected create(): HTMLElement {
    const variant = STATUS_VARIANT[this.props.status] ?? TagVariant.STATUS_PENDING
    return new Tag({ variant, label: this.props.status, size: TagSize.RESPONSIVE }).el
  }
}

// ─── Tone tag helper ────────────────────────────────────────────────

export function resolveToneVariant(tone: number): TagVariant {
  if (tone > GDELT_TONE_BANDS.VERY_POSITIVE.min) return TagVariant.TONE_VERY_POSITIVE
  if (tone > GDELT_TONE_BANDS.POSITIVE.min) return TagVariant.TONE_POSITIVE
  if (tone < GDELT_TONE_BANDS.VERY_NEGATIVE.max) return TagVariant.TONE_VERY_NEGATIVE
  if (tone < GDELT_TONE_BANDS.NEGATIVE.max) return TagVariant.TONE_NEGATIVE
  return TagVariant.TONE_NEUTRAL
}

export function createToneTag(tone: number): HTMLElement {
  const variant = resolveToneVariant(tone)
  return new Tag({ variant, size: TagSize.RESPONSIVE }).el
}

// ─── Source tag helper ──────────────────────────────────────────────

const SOURCE_VARIANT: Record<string, TagVariant> = {
  [DataSourceId.NUFORC]: TagVariant.SOURCE_NUFORC,
  [DataSourceId.HATCH_UDB]: TagVariant.SOURCE_HATCH,
  [DataSourceId.CHRONOLOGY]: TagVariant.SOURCE_CHRONOLOGY,
  [DataSourceId.EXPERIENCER]: TagVariant.SOURCE_EXPERIENCER
}

export function resolveSourceVariant(sourceId: string): TagVariant {
  return SOURCE_VARIANT[sourceId] ?? TagVariant.SOURCE_NUFORC
}

export function createSourceTag(sourceId: string, label: string): HTMLElement {
  const variant = resolveSourceVariant(sourceId)
  return new Tag({ variant, label, size: TagSize.RESPONSIVE }).el
}

export function createNewsSourceTag(label: string): HTMLElement {
  return new Tag({ variant: TagVariant.SOURCE_NEWS, label, size: TagSize.RESPONSIVE }).el
}
