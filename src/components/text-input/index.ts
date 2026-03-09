import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'

export type TextInputSize = 'sm' | 'md'

export interface TextInputProps {
  id?: string
  name?: string
  placeholder?: string
  ariaLabel: string
  size?: TextInputSize
  onInput?: (value: string) => void
}

export class TextInput extends Component<TextInputProps> {
  private input!: HTMLInputElement

  protected create(): HTMLElement {
    const { id, name, placeholder, ariaLabel, size = 'md', onInput } = this.props

    this.input = h('input', {
      className: `${cx.root} ${cx[size]}`,
      type: 'text',
      autocomplete: 'off',
      autofocus: 1,
      ...(id && { id }),
      ...(name && { name }),
      ...(placeholder && { placeholder }),
      'aria-label': ariaLabel
    }) as HTMLInputElement

    if (onInput) {
      this.input.addEventListener('input', () => {
        onInput(this.input.value.trim())
      })
    }

    return this.input
  }

  get value(): string {
    return this.input.value
  }

  set value(v: string) {
    this.input.value = v
  }

  focus(): void {
    this.input.focus()
  }
}
