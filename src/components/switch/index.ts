import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, addClass, removeClass, setAttrs } from '@/utils/dom'

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

  protected create (): HTMLElement {
    this._checked = this.props.checked ?? false

    this.iconOnEl = this.props.iconOn()
    this.iconOffEl = this.props.iconOff()
    addClass(this.iconOnEl, cx.icon)
    addClass(this.iconOffEl, cx.icon)

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

  get checked (): boolean {
    return this._checked
  }

  set checked (val: boolean) {
    this._checked = val
    this.update()
  }

  private update (): void {
    setAttrs(this.rootEl, { 'aria-checked': String(this._checked) })
    if (this._checked) {
      addClass(this.rootEl, cx.checked)
    } else {
      removeClass(this.rootEl, cx.checked)
    }
  }
}
