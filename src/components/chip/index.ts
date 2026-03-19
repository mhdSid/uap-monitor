/* ------------------------------------------------------------------ *
 *  Chip / ChipGroup — toggleable pill-shaped filter controls          *
 *                                                                     *
 *  Each chip has an active/inactive boolean state.                    *
 *  Pass a `color` to tint the active state via --chip-color.          *
 *  ChipGroup wraps multiple chips and emits the active key set.       *
 *                                                                     *
 *  Sizes follow ComponentSize (sm / md / lg).                        *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, addClass, removeClass } from '@/core/dom'
import { ComponentSize } from '@/enums'

// ─── Types ──────────────────────────────────────────────────────────

export interface ChipProps {
  label: string
  key: string
  color?: string
  active?: boolean
  size?: ComponentSize
  onChange?: (active: boolean) => void
}

export interface ChipGroupProps {
  items: ChipItem[]
  size?: ComponentSize
  onChange?: (activeKeys: Set<string>) => void
}

export interface ChipItem {
  label: string
  key: string
  color?: string
  active?: boolean
}

// ─── Chip ───────────────────────────────────────────────────────────

export class Chip extends Component<ChipProps> {
  private active!: boolean
  private btnEl!: HTMLButtonElement

  protected create (): HTMLElement {
    this.active = this.props.active ?? true
    const size = this.props.size ?? ComponentSize.SM

    this.btnEl = h('button', {
      className: cx.chip,
      type: 'button',
      'aria-pressed': String(this.active)
    }, h('span', { className: cx.chipLabel }, this.props.label)) as HTMLButtonElement

    addClass(this.btnEl, `chip--${size}`)

    if (this.props.color) {
      this.btnEl.style.setProperty('--chip-color', this.props.color)
    }

    if (this.active) addClass(this.btnEl, cx.chipActive)

    this.btnEl.addEventListener('click', () => {
      this.toggle()
      this.props.onChange?.(this.active)
    })

    return this.btnEl
  }

  toggle (force?: boolean): void {
    this.active = force ?? !this.active
    this.btnEl.setAttribute('aria-pressed', String(this.active))
    if (this.active) addClass(this.btnEl, cx.chipActive)
    else removeClass(this.btnEl, cx.chipActive)
  }

  get isActive (): boolean {
    return this.active
  }

  get key (): string {
    return this.props.key
  }
}

// ─── ChipGroup ──────────────────────────────────────────────────────

export class ChipGroup extends Component<ChipGroupProps> {
  private chips!: Chip[]

  protected create (): HTMLElement {
    const size = this.props.size ?? ComponentSize.SM

    this.chips = this.props.items.map(item =>
      new Chip({
        ...item,
        size,
        onChange: () => this.emitChange()
      })
    )

    return h('div', { className: cx.group },
      ...this.chips.map(c => c.el)
    )
  }

  private emitChange (): void {
    this.props.onChange?.(this.activeKeys)
  }

  get activeKeys (): Set<string> {
    const keys = new Set<string>()
    for (const chip of this.chips) {
      if (chip.isActive) keys.add(chip.key)
    }
    return keys
  }

  /** Programmatically set all chips active or inactive. */
  setAll (active: boolean): void {
    for (const chip of this.chips) chip.toggle(active)
  }

  /** Get a chip by key. */
  getChip (key: string): Chip | undefined {
    return this.chips.find(c => c.key === key)
  }
}
