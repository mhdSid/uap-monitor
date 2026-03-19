import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, addClass, removeClass, hide, show, setAttrs } from '@/core/dom'
import { iconRadarSignalOutline, iconRadarSignalFilled } from '@/components/icons'
import { useBookmarks } from '@/composables'
import { useToast } from '@/components/toast'

export interface BookmarkButtonProps {
  sightingId: string
  size?: number
}

const ARIA_SAVE = 'Save sighting'
const ARIA_UNSAVE = 'Remove saved sighting'
const TOAST_SAVED = 'SIGHTING SAVED'
const TOAST_REMOVED = 'BOOKMARK REMOVED'

export class BookmarkButton extends Component<BookmarkButtonProps> {
  private btn!: HTMLButtonElement
  private outlineIcon!: SVGSVGElement
  private filledIcon!: SVGSVGElement
  private isActive = false

  protected create (): HTMLElement {
    const { sightingId, size = 14 } = this.props
    const bookmarks = useBookmarks()
    const toast = useToast()

    this.isActive = bookmarks.has(sightingId)
    this.outlineIcon = iconRadarSignalOutline(size)
    this.filledIcon = iconRadarSignalFilled(size)

    this.syncIcons()

    this.btn = h('button', {
      className: this.isActive ? `${cx.root} ${cx.active}` : cx.root,
      type: 'button',
      'aria-label': this.isActive ? ARIA_UNSAVE : ARIA_SAVE,
      'aria-pressed': String(this.isActive)
    }, this.outlineIcon, this.filledIcon) as HTMLButtonElement

    this.btn.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()
      this.isActive = bookmarks.toggle(sightingId)
      this.syncState()

      toast.success(this.isActive ? TOAST_SAVED : TOAST_REMOVED)

      // Pulse animation
      addClass(this.btn, cx.pulse)
      this.btn.addEventListener('animationend', () => {
        removeClass(this.btn, cx.pulse)
      }, { once: true })
    })

    return this.btn
  }

  private syncIcons (): void {
    if (this.isActive) hide(this.outlineIcon); else show(this.outlineIcon)
    if (this.isActive) show(this.filledIcon); else hide(this.filledIcon)
  }

  private syncState (): void {
    this.syncIcons()
    if (this.isActive) {
      addClass(this.btn, cx.active)
    } else {
      removeClass(this.btn, cx.active)
    }
    setAttrs(this.btn, { 'aria-label': this.isActive ? ARIA_UNSAVE : ARIA_SAVE, 'aria-pressed': String(this.isActive) })
  }
}
