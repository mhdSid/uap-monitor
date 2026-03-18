import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, hide, show } from '@/utils/dom'
import { iconClose } from '@/components/icons'
import { ARIA } from '@/data/strings'
import { ComponentSize } from '@/enums'

export type TextInputType = 'text' | 'date' | 'email' | 'number'

export interface TextInputProps {
  id?: string
  name?: string
  placeholder?: string
  autofocus?: boolean
  ariaLabel: string
  inputType?: TextInputType
  size?: ComponentSize
  clearable?: boolean
  min?: string
  max?: string
  onInput?: (value: string) => void
  onClear?: () => void
}

export class TextInput extends Component<TextInputProps> {
  private input!: HTMLInputElement
  private clearBtn!: HTMLButtonElement | null

  protected create (): HTMLElement {
    const { id, name, placeholder, ariaLabel, autofocus, inputType = 'text', size = ComponentSize.MD, clearable = false, min, max, onInput, onClear } = this.props

    const SIZE_CX: Record<ComponentSize, string> = {
      [ComponentSize.SM]: cx.sm,
      [ComponentSize.MD]: cx.md,
      [ComponentSize.LG]: cx.lg
    }

    this.input = h('input', {
      className: `${cx.input} ${SIZE_CX[size]}`,
      type: inputType,
      autocomplete: 'off',
      ...autofocus && { autofocus },
      ...(id && { id }),
      ...(name && { name }),
      ...(placeholder && { placeholder }),
      ...(min && { min }),
      ...(max && { max }),
      'aria-label': ariaLabel
    }) as HTMLInputElement

    if (!clearable) {
      if (onInput) {
        this.input.addEventListener('input', () => {
          onInput(this.input.value.trim())
        })
      }
      return this.input
    }

    // Clearable: wrap in container with clear button
    this.clearBtn = h('button', {
      className: cx.clearBtn,
      type: 'button',
      'aria-label': ARIA.CLEAR_SEARCH,
      tabIndex: -1
    }, iconClose(12)) as HTMLButtonElement

    hide(this.clearBtn)

    const updateClearVisibility = (): void => {
      if (this.clearBtn) {
        if (this.input.value.length > 0) show(this.clearBtn); else hide(this.clearBtn)
      }
    }

    this.input.addEventListener('input', () => {
      updateClearVisibility()
      onInput?.(this.input.value.trim())
    })

    this.clearBtn.addEventListener('click', () => {
      this.input.value = ''
      updateClearVisibility()
      this.input.focus()
      onInput?.('')
      onClear?.()
    })

    return h('div', { className: cx.wrapper },
      this.input,
      this.clearBtn
    )
  }

  get value (): string {
    return this.input.value
  }

  set value (v: string) {
    this.input.value = v
    if (this.clearBtn) {
      if (v.length > 0) show(this.clearBtn); else hide(this.clearBtn)
    }
  }

  focus (): void {
    this.input.focus()
  }
}
