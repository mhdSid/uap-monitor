/* ------------------------------------------------------------------ *
 *  StatCard — compact metric display (label / value / subtitle)       *
 *                                                                     *
 *  Used by GeomagneticView and SeismicView for their stats bars.      *
 *  Also exports StatCardGrid for the wrapping grid container and      *
 *  a createStatCard factory for the common "value updated later"      *
 *  pattern where the value element is stored for setText/setStyles.   *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/core/dom'

// ─── Types ──────────────────────────────────────────────────────────

export interface StatCardProps {
  label: string
  valueEl: HTMLElement
  sub: string | HTMLElement
}

// ─── Component ──────────────────────────────────────────────────────

export class StatCard extends Component<StatCardProps> {
  protected create (): HTMLElement {
    const subEl = typeof this.props.sub === 'string'
      ? h('div', { className: cx.sub }, this.props.sub)
      : this.props.sub

    return h('div', { className: cx.root },
      h('div', { className: cx.label }, this.props.label),
      this.props.valueEl,
      subEl
    )
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Create a value element styled for stat-card display. */
export function createStatValue (): HTMLElement {
  return h('div', { className: cx.value })
}

/** Create a sub element styled for stat-card display. */
export function createStatSub (): HTMLElement {
  return h('div', { className: cx.sub })
}

/** Wrap stat cards in a responsive grid. */
export function StatCardGrid (...cards: HTMLElement[]): HTMLElement {
  return h('div', { className: cx.grid }, ...cards)
}
