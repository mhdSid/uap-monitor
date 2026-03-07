import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'

export interface SwitchProps {
  checked?: boolean
  iconOn: () => SVGSVGElement
  iconOff: () => SVGSVGElement
  ariaLabel: string
  onChange?: (checked: boolean) => void
}

export class Switch extends Component<SwitchProps> {
  private _checked!: boolean
  private iconOnEl!: SVGSVGElement
  private iconOffEl!: SVGSVGElement
  private rootEl!: HTMLButtonElement

  protected create(): HTMLElement {
    this._checked = this.props.checked ?? false

    this.iconOnEl = this.props.iconOn()
    this.iconOffEl = this.props.iconOff()
    this.iconOnEl.classList.add(cx.icon)
    this.iconOffEl.classList.add(cx.icon)

    const thumb = h('span', { className: cx.thumb })

    this.rootEl = h('button', {
      className: cx.root,
      type: 'button',
      role: 'switch',
      'aria-checked': String(this._checked),
      'aria-label': this.props.ariaLabel,
      onClick: () => {
        this._checked = !this._checked
        this.update()
        this.props.onChange?.(this._checked)
      }
    },
      h('span', { className: cx.icons },
        this.iconOffEl,
        this.iconOnEl
      ),
      thumb
    ) as HTMLButtonElement

    this.update()
    return this.rootEl
  }

  get checked(): boolean {
    return this._checked
  }

  set checked(val: boolean) {
    this._checked = val
    this.update()
  }

  private update(): void {
    this.rootEl.setAttribute('aria-checked', String(this._checked))
    if (this._checked) {
      this.rootEl.classList.add(cx.checked)
    } else {
      this.rootEl.classList.remove(cx.checked)
    }
  }
}
