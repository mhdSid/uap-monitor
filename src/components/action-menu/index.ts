import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  ActionMenu — reusable dropdown triggered by a vertical dots icon   *
 *                                                                     *
 *  Singleton popup pattern (like Tooltip). Only one menu open at a    *
 *  time. Fixed positioning, auto-flips to stay in viewport.           *
 *                                                                     *
 *  Usage:                                                             *
 *    new ActionMenu({                                                 *
 *      ariaLabel: 'Sighting actions',                                 *
 *      items: [                                                       *
 *        { label: 'Remove', icon: () => iconClose(12), onClick: fn }, *
 *        { label: 'Share',  icon: () => iconShare(12), onClick: fn }, *
 *      ]                                                              *
 *    })                                                               *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, addClass, removeClass, setStyles, qs } from '@/core/dom'
import { iconMore } from '@/components/icons'

// ─── Types ──────────────────────────────────────────────────────────

export interface ActionMenuItem {
  label: string
  icon?: () => SVGSVGElement
  onClick: () => void
}

export interface ActionMenuProps {
  ariaLabel: string
  items: ActionMenuItem[]
  triggerSize?: number
}

// ─── Singleton popup ────────────────────────────────────────────────

const GAP = 4

let popup: HTMLElement | null = null
let activeTrigger: HTMLElement | null = null
let cleanup: (() => void) | null = null

function getPopup (): HTMLElement {
  if (!popup) {
    popup = h('div', { className: cx.popup, role: 'menu' })
    document.body.appendChild(popup)
  }
  return popup
}

function closeMenu (): void {
  if (!cleanup) return
  cleanup()
  cleanup = null
  activeTrigger = null
}

function positionPopup (el: HTMLElement, trigger: HTMLElement): void {
  const rect = trigger.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const popupW = el.offsetWidth
  const popupH = el.offsetHeight

  // Vertical: prefer below, flip above if no space
  let top: number
  if (rect.bottom + GAP + popupH <= vh) {
    top = rect.bottom + GAP
  } else if (rect.top - GAP - popupH >= 0) {
    top = rect.top - GAP - popupH
  } else {
    top = Math.max(4, vh - popupH - 4)
  }

  // Horizontal: right-align popup to trigger's right edge
  let left = rect.right - popupW
  if (left < 4) left = 4
  if (left + popupW > vw - 4) left = vw - popupW - 4

  setStyles(el, { top: `${top}px`, left: `${left}px` })
}

// ─── Component ──────────────────────────────────────────────────────

export class ActionMenu extends Component<ActionMenuProps> {
  private triggerEl!: HTMLButtonElement

  protected create (): HTMLElement {
    const { ariaLabel, triggerSize = 16 } = this.props

    this.triggerEl = h('button', {
      className: cx.trigger,
      type: 'button',
      'aria-label': ariaLabel,
      'aria-haspopup': 'menu'
    }, iconMore(triggerSize)) as HTMLButtonElement

    return this.triggerEl
  }

  protected didMount (): void {
    this.triggerEl.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()

      if (activeTrigger === this.triggerEl) {
        closeMenu()
      } else {
        this.open()
      }
    })

    // If this trigger owns the open singleton popup at destroy time, close it.
    // Otherwise the four global listeners (document.click/keydown +
    // window.resize/scroll) keep firing against a removed trigger element.
    this.own(() => {
      if (activeTrigger === this.triggerEl) closeMenu()
    })
  }

  private open (): void {
    closeMenu()

    const el = getPopup()
    el.innerHTML = ''
    activeTrigger = this.triggerEl

    for (const item of this.props.items) {
      const btn = h('button', {
        className: cx.item,
        type: 'button',
        role: 'menuitem'
      })

      if (item.icon) {
        const iconWrap = h('span', { className: cx.itemIcon })
        iconWrap.appendChild(item.icon())
        btn.appendChild(iconWrap)
      }

      btn.appendChild(h('span', { className: cx.itemLabel }, item.label))

      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        closeMenu()
        item.onClick()
      })

      el.appendChild(btn)
    }

    const reposition = (): void => positionPopup(el, this.triggerEl)

    const handleOutsideClick = (e: Event): void => {
      if (!this.triggerEl.contains(e.target as Node) && !el.contains(e.target as Node)) {
        closeMenu()
      }
    }

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closeMenu()
        this.triggerEl.focus()
      }
    }

    cleanup = () => {
      setStyles(el, { opacity: '0' })
      removeClass(el, cx.popupVisible)
      document.removeEventListener('click', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }

    // Make visible (display:block) but transparent, then position, then fade in
    setStyles(el, { opacity: '0' })
    addClass(el, cx.popupVisible)
    requestAnimationFrame(() => {
      reposition()
      setStyles(el, { opacity: '1' })
      const firstItem = qs('[role="menuitem"]', el)
      if (firstItem) firstItem.focus()
    })

    document.addEventListener('click', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
  }
}
