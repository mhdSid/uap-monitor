import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  WelcomeModal — introductory overlay shown on first launch          *
 *                                                                     *
 *  Presents the app's mission, active source list, and stats.         *
 *  Shown once per session; dismissed via CTA button or close.         *
 *                                                                     *
 *  Source list lifecycle:                                             *
 *    1. show()        → renders a Loader in the ACTIVE SOURCES slot   *
 *    2. setSources()  → replaces Loader with live-derived source rows *
 *       (called by app.ts once manifests + article feeds are loaded)  *
 * ------------------------------------------------------------------ */

import { Modal } from '@/components/modal'
import { Button } from '@/components/button'
import { Loader } from '@/components/loader'
import { h, clearChildren } from '@/utils/dom'
import { WELCOME } from '@/data/strings'
import { useAnalytics } from '@/composables'
import type { WelcomeSource } from '@/types'

const TIER_CX: Record<WelcomeSource['tier'], string> = {
  high: cx.sourceTierHigh,
  mid:  cx.sourceTierMid,
  base: cx.sourceTierBase
}

export class WelcomeModal {
  /** Track dismiss within this page load only (no sessionStorage). */
  private static dismissed = false

  /**
   * Live reference to the sources slot element so setSources() can
   * swap out the initial Loader without re-rendering the whole modal.
   * Reset to null whenever the modal is closed.
   */
  private static sourcesSlot: HTMLElement | null = null

  // ─── Public API ────────────────────────────────────────────────

  /**
   * Show the welcome modal on initial load.
   * The ACTIVE SOURCES section renders a Loader until setSources() is called.
   * Dismissed for the lifetime of this page — refreshing shows it again.
   */
  static show(): boolean {
    if (WelcomeModal.dismissed) return false

    Modal.open({
      header:  () => WelcomeModal.buildHeader(),
      content: () => WelcomeModal.buildContent(),
      footer:  () => WelcomeModal.buildFooter(),
      onClose: () => {
        WelcomeModal.dismissed = true
        WelcomeModal.sourcesSlot = null
        useAnalytics().welcomeModalClosed()
      }
    })

    return true
  }

  /**
   * Replace the loading placeholder with real source rows derived from
   * the loaded manifests and article collections.
   *
   * Safe to call even if the modal has already been dismissed — in that
   * case sourcesSlot is null and the call is a no-op.
   */
  static setSources(sources: WelcomeSource[]): void {
    const slot = WelcomeModal.sourcesSlot
    if (!slot) return

    clearChildren(slot)

    const list = h('div', { className: cx.sources })
    for (const src of sources) {
      list.appendChild(
        h('div', { className: cx.source },
          h('span', { className: `${cx.sourceTier} ${TIER_CX[src.tier]}` }),
          h('span', { className: cx.sourceName }, src.name),
          h('span', { className: cx.sourceMeta }, `${src.records} · ${src.period}`)
        )
      )
    }

    slot.appendChild(list)
  }

  // ─── Slots ──────────────────────────────────────────────────────

  private static buildHeader(): HTMLElement {
    return h('div', { className: cx.header },
      h('span', { className: cx.title }, WELCOME.TITLE),
      h('span', { className: cx.subtitle }, WELCOME.SUBTITLE)
    )
  }

  private static buildContent(): HTMLElement {
    const body = h('div', { className: cx.body })

    for (const paragraph of WELCOME.BODY) {
      body.appendChild(h('p', { className: cx.text }, paragraph))
    }

    body.appendChild(
      h('div', { className: cx.stats },
        WelcomeModal.stat(WELCOME.STAT_TIMESPAN, WELCOME.STAT_TIMESPAN_LABEL),
        WelcomeModal.stat(WELCOME.STAT_RECORDS, WELCOME.STAT_RECORDS_LABEL),
        WelcomeModal.stat(WELCOME.STAT_SOURCES, WELCOME.STAT_SOURCES_LABEL),
        WelcomeModal.stat(WELCOME.STAT_COVERAGE, WELCOME.STAT_COVERAGE_LABEL)
      )
    )

    // ── Active sources section ───────────────────────────────────
    body.appendChild(h('div', { className: cx.sourcesTitle }, WELCOME.SOURCES_TITLE))

    // Sources slot: initially holds the Loader; replaced by setSources()
    // once manifests + article feeds have resolved in the background.
    const sourcesSlot = h('div', { className: cx.sourcesLoader },
      new Loader({}).el
    )
    WelcomeModal.sourcesSlot = sourcesSlot
    body.appendChild(sourcesSlot)

    body.appendChild(
      h('p', { className: `${cx.text} ${cx.textClosing}` }, WELCOME.CLOSING)
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
      onClick: () => WelcomeModal.dismiss()
    })

    return h('div', { className: cx.footer }, btn.el)
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private static stat(value: string, label: string): HTMLElement {
    return h('div', { className: cx.stat },
      h('span', { className: cx.statValue }, value),
      h('span', { className: cx.statLabel }, label)
    )
  }

  private static dismiss(): void {
    Modal.close()
  }
}
