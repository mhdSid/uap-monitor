/* ------------------------------------------------------------------ *
 *  WelcomeModal — introductory overlay shown on first launch          *
 *                                                                     *
 *  Presents the app's mission and guides users into the interface.    *
 *  Shown once per session; dismissed via CTA button or close.         *
 * ------------------------------------------------------------------ */

import { Modal } from '@/components/modal'
import { Button } from '@/components/button'
import { h } from '@/utils/dom'
import { WELCOME } from '@/data/strings'
import { useAnalytics } from '@/composables'

export class WelcomeModal {
  /** Track dismiss within this page load only (no sessionStorage). */
  private static dismissed = false

  /**
   * Show the welcome modal on initial load.
   * Dismissed for the lifetime of this page — refreshing shows it again.
   */
  static show(): boolean {
    if (WelcomeModal.dismissed) return false

    Modal.open({
      header: () => WelcomeModal.buildHeader(),
      content: () => WelcomeModal.buildContent(),
      footer: () => WelcomeModal.buildFooter(),
      onClose: () => {
        WelcomeModal.dismissed = true
        useAnalytics().welcomeModalClosed()
      },
    })

    return true
  }

  // ─── Slots ──────────────────────────────────────────────────────

  private static buildHeader(): HTMLElement {
    return h('div', { className: 'welcome__header' },
      h('span', { className: 'welcome__title' }, WELCOME.TITLE),
      h('span', { className: 'welcome__subtitle' }, WELCOME.SUBTITLE),
    )
  }

  private static buildContent(): HTMLElement {
    const body = h('div', { className: 'welcome__body' })

    for (const paragraph of WELCOME.BODY) {
      body.appendChild(h('p', { className: 'welcome__text' }, paragraph))
    }

    body.appendChild(
      h('div', { className: 'welcome__stats' },
        WelcomeModal.stat('70 AD–present', 'Time span'),
        WelcomeModal.stat('168,000+', 'Records'),
        WelcomeModal.stat('2 active', 'Sources'),
        WelcomeModal.stat('100%', 'Open data'),
      ),
    )

    body.appendChild(
      h('p', { className: 'welcome__text' },
        'All data is open. All code is open. The truth should be too.',
      ),
    )

    return body
  }

  private static buildFooter(): HTMLElement {
    const btn = new Button({
      label: WELCOME.CTA,
      variant: 'solid',
      color: 'primary',
      size: 'md',
      block: true,
      onClick: () => WelcomeModal.dismiss(),
    })

    return h('div', { className: 'welcome__footer' }, btn.el)
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private static stat(value: string, label: string): HTMLElement {
    return h('div', { className: 'welcome__stat' },
      h('span', { className: 'welcome__stat-value' }, value),
      h('span', { className: 'welcome__stat-label' }, label),
    )
  }

  private static dismiss(): void {
    Modal.close()
  }
}
