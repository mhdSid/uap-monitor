import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, setStyles, hide, show, setText } from '@/utils/dom'
import { iconRadar, iconSun, iconMoon, iconRadarSignalOutline } from '@/components/icons'
import { Switch } from '@/components/switch'
import { BookmarksModal } from '@/components/bookmarks-modal'
import { APP_NAME, ARIA } from '@/data/strings'
import { useTheme, useBookmarks } from '@/composables'

export class Header extends Component {
  protected create (): HTMLElement {
    const radar = iconRadar(16)
    setStyles(radar, { color: 'var(--color-green)' })

    const left = h('div', { className: cx.left },
      radar,
      h('span', { className: cx.title }, APP_NAME)
    )

    // ── Bookmarks trigger ────────────────────────────────────────
    const bookmarks = useBookmarks()
    const badge = h('span', { className: cx.bookmarkBadge })

    const updateBadge = (): void => {
      const count = bookmarks.count.get()
      setText(badge, count > 99 ? '99+' : count > 0 ? String(count) : '')
      if (count > 0) show(badge); else hide(badge)
    }
    updateBadge()
    bookmarks.count.subscribe(updateBadge)

    const bookmarkBtn = h('button', {
      className: cx.bookmarkBtn,
      type: 'button',
      'aria-label': ARIA.OPEN_BOOKMARKS
    }, iconRadarSignalOutline(14), badge) as HTMLButtonElement

    bookmarkBtn.addEventListener('click', () => {
      BookmarksModal.open(bookmarkBtn)
    })

    // ── Theme switch ─────────────────────────────────────────────
    const { theme, toggle } = useTheme()

    const themeSwitch = new Switch({
      checked: theme.get() === 'light',
      iconOn: () => iconSun(10),
      iconOff: () => iconMoon(10),
      ariaLabel: ARIA.THEME_TOGGLE,
      onChange: () => toggle()
    })

    const right = h('div', { className: cx.right },
      bookmarkBtn,
      themeSwitch.el
    )

    return h('header', { className: cx.root, role: 'banner' }, left, right)
  }

  destroy (): void {
    super.destroy()
  }
}
