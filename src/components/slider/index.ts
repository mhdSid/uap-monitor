/* ------------------------------------------------------------------ *
 *  Slider — range input with label + value display                    *
 *                                                                     *
 *  Wraps a native <input type="range"> with consistent styling,      *
 *  a label, and a formatted value readout. Supports custom colors    *
 *  via --slider-color CSS property.                                   *
 *                                                                     *
 *  Sizes follow ComponentSize (sm / md / lg).                        *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, setText } from '@/core/dom'
import { ComponentSize } from '@/enums'

// ─── Types ──────────────────────────────────────────────────────────

export interface SliderProps {
  label: string
  min?: number
  max?: number
  step?: number
  value?: number
  size?: ComponentSize
  color?: string
  formatValue?: (v: number) => string
  onChange?: (v: number) => void
}

// ─── Component ──────────────────────────────────────────────────────

export class Slider extends Component<SliderProps> {
  private input!: HTMLInputElement
  private valueEl!: HTMLElement

  protected create (): HTMLElement {
    const {
      label,
      min = 0,
      max = 100,
      step = 1,
      value = 50,
      size = ComponentSize.SM,
      color,
      formatValue,
      onChange
    } = this.props

    const SIZE_CX: Record<ComponentSize, string> = {
      [ComponentSize.SM]: cx.sm,
      [ComponentSize.MD]: cx.md,
      [ComponentSize.LG]: cx.lg
    }

    this.valueEl = h('span', { className: cx.value })
    setText(this.valueEl, formatValue ? formatValue(value) : String(value))

    this.input = h('input', {
      className: cx.track,
      type: 'range',
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(value)
    }) as HTMLInputElement

    if (color) {
      this.input.style.setProperty('--slider-color', color)
    }

    this.input.addEventListener('input', () => {
      const v = parseFloat(this.input.value)
      setText(this.valueEl, formatValue ? formatValue(v) : String(v))
      onChange?.(v)
    })

    const root = h('div', { className: `${cx.root} ${SIZE_CX[size]}` },
      h('div', { className: cx.header },
        h('span', { className: cx.label }, label),
        this.valueEl
      ),
      this.input
    )

    return root
  }

  get value (): number {
    return parseFloat(this.input.value)
  }

  set value (v: number) {
    this.input.value = String(v)
    const { formatValue } = this.props
    setText(this.valueEl, formatValue ? formatValue(v) : String(v))
  }
}
