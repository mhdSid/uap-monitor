import type { ModalSlots } from '@/types'
import { h, addClass, removeClass, setAttrs } from '@/utils/dom'
import { iconClose } from '@/components/icons'

let activeModal: HTMLElement | null = null
let triggerElement: HTMLElement | null = null

export function openModal(slots: ModalSlots): void {
  closeModal()

  // Remember what element opened the modal so we can return focus
  triggerElement = document.activeElement as HTMLElement | null

  const closeIcon = iconClose(14)

  const closeBtn = h('button', {
    className: 'modal__close',
    'aria-label': 'Close modal',
    onClick: closeModal,
  }, closeIcon)

  const headerBar = h('div', { className: 'modal__header' })
  if (slots.header) headerBar.appendChild(slots.header())
  headerBar.appendChild(closeBtn)

  const dialog = h('div', {
    className: 'modal',
    role: 'dialog',
    'aria-modal': 'true',
  }, headerBar)

  if (slots.content) {
    dialog.appendChild(h('div', { className: 'modal__content' }, slots.content()))
  }
  if (slots.footer) {
    dialog.appendChild(h('div', { className: 'modal__footer' }, slots.footer()))
  }

  const overlay = h('div', { className: 'modal-overlay' }, dialog)
  overlay.addEventListener('click', (e: Event) => {
    if (e.target === overlay) closeModal()
  })

  document.body.appendChild(overlay)
  activeModal = overlay
  addClass(document.body, 'modal-open')
  setAttrs(document.body, { 'aria-hidden': 'true' })

  document.addEventListener('keydown', handleEscape)

  // Focus the close button
  closeBtn.focus()

  requestAnimationFrame(() => addClass(overlay, 'modal-overlay--visible'))
}

export function closeModal(): void {
  if (!activeModal) return
  removeClass(activeModal, 'modal-overlay--visible')
  removeClass(document.body, 'modal-open')
  setAttrs(document.body, { 'aria-hidden': null })

  document.removeEventListener('keydown', handleEscape)

  const ref = activeModal
  const returnTarget = triggerElement

  activeModal = null
  triggerElement = null

  setTimeout(() => {
    ref.remove()

    // Restore focus to the element that triggered the modal
    if (returnTarget && returnTarget.isConnected) {
      returnTarget.focus()
    }
  }, 200)
}

function handleEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeModal()
}
