import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  BookmarksModal — shows saved sightings, opens detail on click      *
 *                                                                     *
 *  Click row → close bookmarks → open SightingModal.                  *
 *  Remove button removes from bookmarks without closing.              *
 * ------------------------------------------------------------------ */

import { h, clearChildren, hide, show } from '@/utils/dom'
import { Modal } from '@/components/modal'
import { SightingModal } from '@/components/sighting-modal'
import { BookmarkListItem } from './bookmark-list-item'
import { Button } from '@/components/button'
import { useBookmarks, useAppStore, useShare } from '@/composables'
import { useToast } from '@/components/toast'
import { ButtonSize } from '@/enums'
import { BOOKMARKS } from '@/data/strings'
import type { Sighting } from '@/types'

const TRANSITION_MS = 250

export class BookmarksModal {
  static open (trigger?: HTMLElement): void {
    const bookmarks = useBookmarks()
    const store = useAppStore()
    const share = useShare()
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

          list.appendChild(
            new BookmarkListItem({
              sighting: s,
              onClick: (sighting) => BookmarksModal.openSighting(sighting),
              onRemove: (sighting) => {
                bookmarks.remove(sighting.id)
                toast.success('BOOKMARK REMOVED')
              },
              onShare: async (sighting) => {
                const sYear = sighting.occurredAt ? parseInt(sighting.occurredAt, 10) : undefined
                const result = await share.shareSighting(sighting.id, sYear, sighting.summary?.slice(0, 60))
                if (result.success) {
                  toast.success(result.method === 'native' ? 'SHARED' : 'LINK COPIED')
                } else {
                  toast.error('COULD NOT SHARE')
                }
              }
            }).el
          )
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
        color: 'neutral',
        size: ButtonSize.SM,
        onClick: () => {
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

    // After modal renders, set up footer visibility watcher
    const updateFooter = (): void => {
      const hasItems = bookmarks.count.get() > 0
      const wrapper = document.querySelector('.modal__footer') as HTMLElement | null
      if (wrapper) { if (hasItems) show(wrapper); else hide(wrapper) }
    }
    updateFooter()
    bookmarks.count.subscribe(() => {
      if (Modal.isOpen) updateFooter()
    })
  }

  private static openSighting (sighting: Sighting): void {
    Modal.close()
    // Wait for close transition before opening detail modal
    setTimeout(() => {
      SightingModal.open(sighting, document.body)
    }, TRANSITION_MS)
  }
}
