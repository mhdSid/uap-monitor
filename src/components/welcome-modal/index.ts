/* ------------------------------------------------------------------ *
 *  WelcomeModal — introductory overlay shown on first launch          *
 *                                                                     *
 *  Presents the app's mission, active source list, and stats.         *
 *  Shown once per session; dismissed via CTA button or close.         *
 * ------------------------------------------------------------------ */

import { Modal } from '@/components/modal'
import { Button } from '@/components/button'
import { h } from '@/utils/dom'
import { WELCOME } from '@/data/strings'
import { useAnalytics } from '@/composables'

// ─── Source definitions for welcome display ─────────────────────────

interface WelcomeSource {
  name: string
  records: string
  period: string
  tier: 'high' | 'mid' | 'base'
}

const ACTIVE_SOURCES: WelcomeSource[] = [
  { name: 'NUFORC',              records: '147K',  period: '1974–2024', tier: 'high' },
  { name: 'Hatch *U* Database',  records: '18K',   period: '1942–2003', tier: 'high' },
  { name: 'Eberhart Timeline',   records: '5.9K',  period: '70 AD–2024', tier: 'high' },
  { name: 'NICAP',               records: '5.2K',  period: '1942–1975', tier: 'high' },
  { name: 'Pre-Roswell (Rife)',  records: '5K',    period: '1880–1947', tier: 'base' },
  { name: 'Johnson UFOCAT',      records: '4.1K',  period: '1900–2004', tier: 'mid' },
  { name: 'Overmeire Catalogue', records: '4K',    period: '500 BC–2005', tier: 'base' },
  { name: 'Vallée (Magonia)',    records: '923',   period: '1868–1968', tier: 'high' },
  { name: 'Blue Book Unknowns',  records: '700+',  period: '1947–1969', tier: 'high' },
  { name: 'Hall (UFO Evidence)', records: '600+',  period: '1947–2003', tier: 'high' },
  { name: 'Wonders in the Sky',  records: '500+',  period: '70 AD–1879', tier: 'base' },
  { name: 'Dolan',               records: '300+',  period: '1941–2003', tier: 'mid' },
]

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
        WelcomeModal.stat('193,000+', 'Records'),
        WelcomeModal.stat('12 active', 'Sources'),
        WelcomeModal.stat('100%', 'Open data'),
      ),
    )

    // ── Active sources list ──
    body.appendChild(h('div', { className: 'welcome__sources-title' }, 'ACTIVE SOURCES'))

    const sourceList = h('div', { className: 'welcome__sources' })
    for (const src of ACTIVE_SOURCES) {
      const tierClass = `welcome__source-tier welcome__source-tier--${src.tier}`
      sourceList.appendChild(
        h('div', { className: 'welcome__source' },
          h('span', { className: tierClass }),
          h('span', { className: 'welcome__source-name' }, src.name),
          h('span', { className: 'welcome__source-meta' }, `${src.records} · ${src.period}`),
        ),
      )
    }
    body.appendChild(sourceList)

    body.appendChild(
      h('p', { className: 'welcome__text welcome__text--closing' },
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
