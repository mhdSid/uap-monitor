import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, el } from '@/utils/dom'

// ─── Types ──────────────────────────────────────────────────────────

export interface CheckboxProps {
  label: string
  /** CSS color value for indicator + dot. Uses --checkbox-color custom property. */
  color?: string
  checked?: boolean
  onChange?: (checked: boolean) => void
}

export interface CheckboxGroupProps {
  items: CheckboxProps[]
}

// ─── Checkbox ───────────────────────────────────────────────────────

export class Checkbox extends Component<CheckboxProps> {
  private inputEl!: HTMLInputElement

  protected create (): HTMLElement {
    this.inputEl = el('input', {
      type: 'checkbox',
      className: cx.input
    })
    this.inputEl.checked = this.props.checked ?? true

    this.inputEl.addEventListener('change', () => {
      this.props.onChange?.(this.inputEl.checked)
    })

    const indicator = h('span', { className: cx.indicator })
    indicator.appendChild(Checkbox.checkSvg())

    const dot = h('span', { className: cx.dot })
    const label = h('span', { className: cx.label }, this.props.label)

    const root = h('label', { className: cx.root },
      this.inputEl,
      indicator,
      dot,
      label
    )

    if (this.props.color) {
      root.style.setProperty('--checkbox-color', this.props.color)
    }

    return root
  }

  get checked (): boolean {
    return this.inputEl.checked
  }

  set checked (value: boolean) {
    this.inputEl.checked = value
  }

  private static checkSvg (): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('class', cx.check)
    svg.setAttribute('viewBox', '0 0 10 10')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '1.5')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')

    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', 'M2 5.5L4 7.5L8 3')
    svg.appendChild(path)

    return svg
  }
}

// ─── CheckboxGroup ──────────────────────────────────────────────────

export class CheckboxGroup extends Component<CheckboxGroupProps> {
  private checkboxes!: Checkbox[]

  protected create (): HTMLElement {
    this.checkboxes = this.props.items.map(item => new Checkbox(item))
    return h('div', { className: cx.group },
      ...this.checkboxes.map(cb => cb.el)
    )
  }

  getCheckbox (index: number): Checkbox | undefined {
    return this.checkboxes[index]
  }
}
