import { h, addClass, removeClass } from '@/utils/dom'
import { ARIA } from '@/data/strings'

export interface TooltipProps {
  content: string
  ariaLabel?: string
}

const POPUP_WIDTH = 260
const GAP = 6

/**
 * Position the popup using fixed coordinates so it never overflows the viewport.
 * Strategy: try below-right, then flip vertical/horizontal as needed,
 * and finally clamp to viewport edges as a last resort.
 */
function positionPopup(popup: HTMLElement, trigger: HTMLElement): void {
  const rect = trigger.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Temporarily show to measure height
  popup.style.visibility = 'hidden'
  popup.style.display = 'block'
  const popupH = popup.offsetHeight || 80
  popup.style.visibility = ''
  popup.style.display = ''

  // Vertical: prefer below, flip to above if no room
  let top: number
  if (rect.bottom + GAP + popupH <= vh) {
    top = rect.bottom + GAP
  } else if (rect.top - GAP - popupH >= 0) {
    top = rect.top - GAP - popupH
  } else {
    // Neither fits — clamp to bottom edge
    top = Math.max(4, vh - popupH - 4)
  }

  // Horizontal: prefer aligning left edge with trigger, flip if overflows
  let left: number
  if (rect.left + POPUP_WIDTH <= vw - 4) {
    left = rect.left
  } else if (rect.right - POPUP_WIDTH >= 4) {
    left = rect.right - POPUP_WIDTH
  } else {
    // Neither fits — clamp to right edge with margin
    left = Math.max(4, vw - POPUP_WIDTH - 4)
  }

  popup.style.position = 'fixed'
  popup.style.top = `${top}px`
  popup.style.left = `${left}px`
}

/**
 * Renders a "?" button that toggles a viewport-positioned tooltip popup on click.
 * Repositions on resize/scroll. Clicking anywhere else dismisses it.
 */
export function renderTooltip(props: TooltipProps): HTMLElement {
  const wrapper = h('div', { className: 'tooltip-wrapper' })

  const trigger = h('button', {
    className: 'tooltip__trigger',
    'aria-label': props.ariaLabel || ARIA.TOOLTIP,
    type: 'button',
  }, '?')

  const popup = h('div', {
    className: 'tooltip__popup',
    role: 'tooltip',
  }, props.content)

  let isOpen = false

  function reposition(): void {
    positionPopup(popup, trigger)
  }

  function close(): void {
    if (!isOpen) return
    isOpen = false
    removeClass(popup, 'tooltip__popup--visible')
    document.removeEventListener('click', handleOutsideClick)
    window.removeEventListener('resize', reposition)
    window.removeEventListener('scroll', reposition, true)
  }

  function handleOutsideClick(e: Event): void {
    if (!wrapper.contains(e.target as Node)) {
      close()
    }
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation()
    if (isOpen) {
      close()
    } else {
      isOpen = true
      reposition()
      addClass(popup, 'tooltip__popup--visible')
      document.addEventListener('click', handleOutsideClick)
      window.addEventListener('resize', reposition)
      window.addEventListener('scroll', reposition, true)
    }
  })

  wrapper.appendChild(trigger)
  wrapper.appendChild(popup)

  return wrapper
}
