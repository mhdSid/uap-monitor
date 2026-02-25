import type { ModalSlots } from '@/types'
import { h, addClass, removeClass, setAttrs } from '@/utils/dom'
import { iconClose } from '@/components/icons'

let activeModal: HTMLElement | null = null

export function openModal(slots: ModalSlots): void {
  closeModal()

  const closeIcon = iconClose(14)
  closeIcon.style.color = 'var(--color-muted)'

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
  setAttrs(document.body, { 'aria-hidden': 'true' })
  requestAnimationFrame(() => addClass(overlay, 'modal-overlay--visible'))
}

export function closeModal(): void {
  if (!activeModal) return
  removeClass(activeModal, 'modal-overlay--visible')
  setAttrs(document.body, { 'aria-hidden': null })
  const ref = activeModal
  setTimeout(() => ref.remove(), 200)
  activeModal = null
}
