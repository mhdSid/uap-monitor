import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, addClass, removeClass } from '@/utils/dom'
import { ARIA } from '@/data/strings'

export interface TooltipProps {
  content: string
  ariaLabel?: string
}

const POPUP_WIDTH = 260
const GAP = 6

// ─── Shared singleton popup ────────────────────────────────────────
let sharedPopup: HTMLElement | null = null
let activeWrapper: HTMLElement | null = null
let activeCleanup: (() => void) | null = null

function getSharedPopup(): HTMLElement {
  if (!sharedPopup) {
    sharedPopup = h('div', {
      className: cx.tooltipPopup,
      role: 'tooltip'
    })
    document.body.appendChild(sharedPopup)
  }
  return sharedPopup
}

function closeSharedPopup(): void {
  if (!activeCleanup) return
  activeCleanup()
  activeCleanup = null
  activeWrapper = null
}

function positionPopup(popup: HTMLElement, trigger: HTMLElement): void {
  const rect = trigger.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  popup.style.visibility = 'hidden'
  popup.style.display = 'block'
  const popupH = popup.offsetHeight || 80
  popup.style.visibility = ''
  popup.style.display = ''

  let top: number
  if (rect.bottom + GAP + popupH <= vh) {
    top = rect.bottom + GAP
  } else if (rect.top - GAP - popupH >= 0) {
    top = rect.top - GAP - popupH
  } else {
    top = Math.max(4, vh - popupH - 4)
  }

  let left: number
  if (rect.left + POPUP_WIDTH <= vw - 4) {
    left = rect.left
  } else if (rect.right - POPUP_WIDTH >= 4) {
    left = rect.right - POPUP_WIDTH
  } else {
    left = Math.max(4, vw - POPUP_WIDTH - 4)
  }

  popup.style.position = 'fixed'
  popup.style.top = `${top}px`
  popup.style.left = `${left}px`
}

export class Tooltip extends Component<TooltipProps> {
  private trigger!: HTMLElement

  protected create(): HTMLElement {
    const wrapper = h('div', { className: cx.tooltipWrapper })

    this.trigger = h('button', {
      className: cx.tooltipTrigger,
      'aria-label': this.props.ariaLabel || ARIA.TOOLTIP,
      type: 'button'
    }, '?')

    wrapper.appendChild(this.trigger)
    return wrapper
  }

  protected didMount(): void {
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation()
      if (activeWrapper === this.el) {
        closeSharedPopup()
      } else {
        this.open()
      }
    })
  }

  private open(): void {
    closeSharedPopup()

    const popup = getSharedPopup()
    popup.textContent = this.props.content
    activeWrapper = this.el

    const reposition = (): void => positionPopup(popup, this.trigger)

    const handleOutsideClick = (e: Event): void => {
      if (!this.el.contains(e.target as Node) && !popup.contains(e.target as Node)) {
        closeSharedPopup()
      }
    }

    activeCleanup = () => {
      removeClass(popup, cx.tooltipPopupVisible)
      document.removeEventListener('click', handleOutsideClick)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }

    reposition()
    addClass(popup, cx.tooltipPopupVisible)
    document.addEventListener('click', handleOutsideClick)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
  }
}
