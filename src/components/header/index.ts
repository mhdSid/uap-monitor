import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, setAttrs } from '@/utils/dom'
import { iconRadar, iconSun, iconMoon, iconRadarSignalOutline } from '@/components/icons'
import { Switch } from '@/components/switch'
import { BookmarksModal } from '@/components/bookmarks-modal'
import { APP_NAME, ARIA } from '@/data/strings'
import { useTheme, useBookmarks } from '@/composables'

export class Header extends Component {
  private clockTimer!: number

  protected create (): HTMLElement {
    this.clockTimer = 0
    const radar = iconRadar(16)
    radar.style.color = 'var(--color-green)'

    const left = h('div', { className: cx.left },
      radar,
      h('span', { className: cx.title }, APP_NAME)
    )

    const clock = h('time', {
      className: cx.clock,
      'aria-label': ARIA.CLOCK
    })

    const updateClock = (): void => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      setAttrs(clock, { datetime: now.toISOString() })
      clock.textContent =
        `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ` +
        `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`
    }
    updateClock()
    this.clockTimer = window.setInterval(updateClock, 1000)

    // ── Bookmarks trigger ────────────────────────────────────────
    const bookmarks = useBookmarks()
    const badge = h('span', { className: cx.bookmarkBadge })

    const updateBadge = (): void => {
      const count = bookmarks.count.get()
      badge.textContent = count > 99 ? '99+' : count > 0 ? String(count) : ''
      badge.style.display = count > 0 ? '' : 'none'
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
      clock,
      bookmarkBtn,
      themeSwitch.el
    )

    return h('header', { className: cx.root, role: 'banner' }, left, right)
  }

  destroy (): void {
    clearInterval(this.clockTimer)
    super.destroy()
  }
}
