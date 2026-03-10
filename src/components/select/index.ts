import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { ComponentSize } from '@/enums'

export type SelectColor = 'default' | 'primary'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  id?: string
  name?: string
  ariaLabel: string
  options: SelectOption[]
  selected?: string
  size?: ComponentSize
  color?: SelectColor
  onChange?: (value: string) => void
}

export class Select extends Component<SelectProps> {
  private select!: HTMLSelectElement

  protected create (): HTMLElement {
    const {
      id, name, ariaLabel, options, selected,
      size = ComponentSize.MD, color = 'default', onChange
    } = this.props

    const SIZE_CX: Record<ComponentSize, string> = {
      [ComponentSize.SM]: cx.sm,
      [ComponentSize.MD]: cx.md,
      [ComponentSize.LG]: cx.lg
    }
    const classes: string[] = [cx.root, SIZE_CX[size]]
    if (color === 'primary') classes.push(cx.primary)

    this.select = h('select', {
      className: classes.join(' '),
      autocomplete: 'off',
      'aria-label': ariaLabel,
      ...(id && { id }),
      ...(name && { name })
    }) as HTMLSelectElement

    for (const opt of options) {
      const el = h('option', { value: opt.value }, opt.label) as HTMLOptionElement
      if (opt.value === selected) el.selected = true
      this.select.appendChild(el)
    }

    if (onChange) {
      this.select.addEventListener('change', () => {
        onChange(this.select.value)
      })
    }

    return this.select
  }

  get value (): string {
    return this.select.value
  }

  set value (v: string) {
    this.select.value = v
  }

  /** Replace all options (preserves current selection if possible) */
  setOptions (options: SelectOption[]): void {
    const currentVal = this.select.value

    while (this.select.options.length > 0) {
      this.select.remove(0)
    }

    for (const opt of options) {
      const el = h('option', { value: opt.value }, opt.label) as HTMLOptionElement
      this.select.appendChild(el)
    }

    if (currentVal) this.select.value = currentVal
  }

  /** Append a single option */
  addOption (opt: SelectOption): void {
    this.select.appendChild(
      h('option', { value: opt.value }, opt.label)
    )
  }

  /** Remove all options after the first N (useful for resetting dynamic lists) */
  truncateOptions (keepFirst: number): void {
    while (this.select.options.length > keepFirst) {
      this.select.remove(keepFirst)
    }
  }
}
