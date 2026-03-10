import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  BookmarksModal — shows saved sightings, opens detail on click      *
 *                                                                     *
 *  Click row → close bookmarks → open SightingModal.                  *
 *  Remove button removes from bookmarks without closing.              *
 * ------------------------------------------------------------------ */

import { h, clearChildren } from '@/utils/dom'
import { formatLocation } from '@/utils/format'
import { Modal } from '@/components/modal'
import { SightingModal } from '@/components/sighting-modal'
import { Button } from '@/components/button'
import { useBookmarks, useAppStore } from '@/composables'
import { useToast } from '@/components/toast'
import { ButtonSize } from '@/enums'
import { BOOKMARKS } from '@/data/strings'
import type { Sighting } from '@/types'

const TRANSITION_MS = 250

export class BookmarksModal {
  static open(trigger?: HTMLElement): void {
    const bookmarks = useBookmarks()
    const store = useAppStore()
    const toast = useToast()

    const buildHeader = (): HTMLElement => {
      const ids = bookmarks.ids.get()
      return h('div', { className: cx.title },
        BOOKMARKS.TITLE,
        h('span', { className: cx.count }, `(${ids.size})`)
      )
    }

    const buildContent = (): HTMLElement => {
      const container = h('div', { className: cx.content })

      const renderList = (): void => {
        clearChildren(container)

        const ids = bookmarks.ids.get()
        if (ids.size === 0) {
          container.appendChild(
            h('div', { className: cx.empty },
              h('span', { className: cx.emptyText }, BOOKMARKS.EMPTY)
            )
          )
          return
        }

        const allSightings = store.sightings.get()
        const sightingMap = new Map(allSightings.map(s => [s.id, s]))

        const list = h('div', { className: cx.list })

        for (const id of ids) {
          const s = sightingMap.get(id)
          if (!s) continue

          const date = s.occurredAt ? s.occurredAt.slice(0, 10) : '—'
          const location = formatLocation(s.region, s.country)
          const src = s.subSource || s.source

          const item = h('div', { className: cx.item },
            h('span', { className: cx.itemDate }, date),
            h('span', { className: cx.itemLocation }, location),
            h('span', { className: cx.itemSummary },
              (s.summary || '').slice(0, 120) + (s.summary?.length > 120 ? '…' : '')
            ),
            h('span', { className: cx.itemMeta }, `${src} · ${s.shape}`)
          )

          item.addEventListener('click', () => {
            BookmarksModal.openSighting(s)
          })

          list.appendChild(item)
        }

        container.appendChild(list)
      }

      renderList()

      // Re-render if bookmarks change while modal is open
      const unsub = bookmarks.ids.subscribe(() => {
        if (Modal.isOpen) renderList()
      })

      // Clean up subscription when modal DOM is removed
      const observer = new MutationObserver(() => {
        if (!container.isConnected) {
          unsub()
          observer.disconnect()
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })

      return container
    }

    const buildFooter = (): HTMLElement => {
      const footer = h('div', { className: cx.footer })

      const clearBtn = new Button({
        label: BOOKMARKS.CLEAR,
        variant: 'ghost',
        color: 'error',
        size: ButtonSize.SM,
        onClick: () => {
          if (bookmarks.count.get() === 0) return
          bookmarks.clear()
          toast.info(BOOKMARKS.CLEARED)
        }
      })

      footer.appendChild(clearBtn.el)
      return footer
    }

    Modal.open({
      header: buildHeader,
      content: buildContent,
      footer: buildFooter
    }, trigger)
  }

  private static openSighting(sighting: Sighting): void {
    Modal.close()
    // Wait for close transition before opening detail modal
    setTimeout(() => {
      SightingModal.open(sighting, document.body)
    }, TRANSITION_MS)
  }
}
