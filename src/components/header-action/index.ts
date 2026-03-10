import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'

export interface HeaderActionProps {
  /** SVG icon factory for default state */
  iconDefault: () => SVGSVGElement
  /** SVG icon factory for active state */
  iconActive: () => SVGSVGElement
  /** Accessible label */
  ariaLabel: string
  /** Data attribute toggled on <html> (e.g. 'data-filters-open') */
  dataAttr: string
  /** Called when state changes */
  onChange?: (active: boolean) => void
}

export class HeaderAction extends Component<HeaderActionProps> {
  private active = false
  private defaultIcon!: SVGSVGElement
  private activeIcon!: SVGSVGElement

  protected create (): HTMLElement {
    this.defaultIcon = this.props.iconDefault()
    this.activeIcon = this.props.iconActive()
    this.activeIcon.style.display = 'none'

    const btn = h('button', {
      className: cx.root,
      type: 'button',
      'aria-label': this.props.ariaLabel,
      'aria-expanded': 'false'
    }, this.defaultIcon, this.activeIcon)

    btn.addEventListener('click', () => {
      this.active = !this.active
      document.documentElement.toggleAttribute(this.props.dataAttr, this.active)
      btn.setAttribute('aria-expanded', String(this.active))

      this.defaultIcon.style.display = this.active ? 'none' : ''
      this.activeIcon.style.display = this.active ? '' : 'none'

      if (this.active) btn.classList.add(cx.active)
      else btn.classList.remove(cx.active)

      this.props.onChange?.(this.active)
    })

    return btn
  }

  /** Programmatically close */
  close (): void {
    if (!this.active) return
    this.active = false
    document.documentElement.removeAttribute(this.props.dataAttr)
    this.el.setAttribute('aria-expanded', 'false')
    this.defaultIcon.style.display = ''
    this.activeIcon.style.display = 'none'
    this.el.classList.remove(cx.active)
  }
}
