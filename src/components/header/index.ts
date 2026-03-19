import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, setStyles, hide, show, setText } from '@/core/dom'
import { iconRadar, iconSun, iconMoon, iconRadarSignalOutline } from '@/components/icons'
import { Button } from '@/components/button'
import { Switch } from '@/components/switch'
import { BookmarksModal } from '@/components/bookmarks-modal'
import { SubmitModal } from '@/components/submit-modal'
import { ARIA, HEADER } from '@/data/strings'
import { ButtonSize } from '@/enums'
import { useTheme, useBookmarks } from '@/composables'

export class Header extends Component {
  protected create (): HTMLElement {
    const radar = iconRadar(24)
    setStyles(radar, { color: 'var(--color-green)' })

    const left = h('a', { className: cx.left, href: '/' }, radar)

    // ── Report sighting CTA ──────────────────────────────────────
    const reportBtn = new Button({
      label: HEADER.SUBMIT_CTA,
      variant: 'outline',
      color: 'primary',
      pill: true,
      size: ButtonSize.SM,
      ariaLabel: ARIA.SUBMIT_SIGHTING,
      onClick: () => SubmitModal.open(reportBtn.el)
    })

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

    const bookmarkBtn = new Button({
      label: ARIA.OPEN_BOOKMARKS,
      round: true,
      variant: 'ghost',
      color: 'primary',
      size: ButtonSize.SM,
      icon: () => iconRadarSignalOutline(18),
      ariaLabel: ARIA.OPEN_BOOKMARKS,
      onClick: () => BookmarksModal.open(bookmarkBtn.el)
    })

    // Attach badge to bookmark button
    setStyles(bookmarkBtn.el, { position: 'relative' })
    bookmarkBtn.el.appendChild(badge)

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
      reportBtn.el,
      bookmarkBtn.el,
      themeSwitch.el
    )

    return h('header', { className: cx.root, role: 'banner' }, left, right)
  }
}
