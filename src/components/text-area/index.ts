import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { ComponentSize } from '@/enums'

export interface TextAreaProps {
  id?: string
  name?: string
  placeholder?: string
  ariaLabel: string
  rows?: number
  size?: ComponentSize
  onInput?: (value: string) => void
}

export class TextArea extends Component<TextAreaProps> {
  private textarea!: HTMLTextAreaElement

  protected create (): HTMLElement {
    const {
      id, name, placeholder, ariaLabel,
      rows = 5, size = ComponentSize.MD, onInput
    } = this.props

    const SIZE_CX: Record<ComponentSize, string> = {
      [ComponentSize.SM]: cx.sm,
      [ComponentSize.MD]: cx.md,
      [ComponentSize.LG]: cx.lg
    }

    this.textarea = h('textarea', {
      className: `${cx.textarea} ${SIZE_CX[size]}`,
      autocomplete: 'off',
      rows: String(rows),
      ...(id && { id }),
      ...(name && { name }),
      ...(placeholder && { placeholder }),
      'aria-label': ariaLabel
    }) as HTMLTextAreaElement

    if (onInput) {
      this.textarea.addEventListener('input', () => {
        onInput(this.textarea.value.trim())
      })
    }

    return h('div', { className: cx.wrapper }, this.textarea)
  }

  get value (): string {
    return this.textarea.value
  }

  set value (v: string) {
    this.textarea.value = v
  }

  focus (): void {
    this.textarea.focus()
  }
}
