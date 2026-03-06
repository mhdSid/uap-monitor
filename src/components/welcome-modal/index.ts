import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  WelcomeModal — introductory overlay shown on first launch          *
 *                                                                     *
 *  Lifecycle:                                                         *
 *    1. show()          → opens modal with a centered Loader          *
 *    2. loadAndRender() → loads all data internally, then replaces    *
 *                         the Loader with the full content            *
 *                                                                     *
 *  All data fetching lives here. app.ts has no involvement.           *
 * ------------------------------------------------------------------ */

import { Modal } from '@/components/modal'
import { Button } from '@/components/button'
import { Loader } from '@/components/loader'
import { h, clearChildren } from '@/utils/dom'
import { WELCOME } from '@/data/strings'
import { useAnalytics, useNuforc, useHatchUdb, useChronology, useGdelt, useGnews, useFireball } from '@/composables'
import { useDeriveWelcomeData } from '@/composables/use-welcome-sources'
import type { WelcomeSource, WelcomeStats } from '@/types'

const TIER_CX: Record<WelcomeSource['tier'], string> = {
  high: cx.sourceTierHigh,
  mid:  cx.sourceTierMid,
  base: cx.sourceTierBase
}

export class WelcomeModal {
  private static dismissed = false

  /**
   * Reference to the content wrapper. Set on open, cleared on close.
   * loadAndRender() checks this before writing — guards against the user
   * dismissing the modal while data is still in flight.
   */
  private static contentEl: HTMLElement | null = null

  // ─── Public API ────────────────────────────────────────────────

  static show(): boolean {
    if (WelcomeModal.dismissed) return false

    Modal.open({
      header:  () => WelcomeModal.buildHeader(),
      content: () => WelcomeModal.buildContent(),
      footer:  () => WelcomeModal.buildFooter(),
      onClose: () => {
        WelcomeModal.dismissed = true
        WelcomeModal.contentEl = null
        useAnalytics().welcomeModalClosed()
      }
    })

    return true
  }

  // ─── Slots ──────────────────────────────────────────────────────

  private static buildHeader(): HTMLElement {
    return h('div', { className: cx.header },
      h('span', { className: cx.title }, WELCOME.TITLE),
      h('span', { className: cx.subtitle }, WELCOME.SUBTITLE)
    )
  }

  private static buildContent(): HTMLElement {
    const wrapper = h('div', { className: cx.bodyLoader },
      new Loader({}).el
    )

    WelcomeModal.contentEl = wrapper
    void WelcomeModal.loadAndRender()

    return wrapper
  }

  private static buildFooter(): HTMLElement {
    const btn = new Button({
      label: WELCOME.CTA,
      variant: 'solid',
      color: 'primary',
      size: 'md',
      block: true,
      onClick: () => Modal.close()
    })

    return h('div', { className: cx.footer }, btn.el)
  }

  // ─── Data loading ───────────────────────────────────────────────

  private static async loadAndRender(): Promise<void> {
    const nuforc = useNuforc()
    const hatch = useHatchUdb()
    const chronology = useChronology()
    const gdelt = useGdelt()
    const gnews = useGnews()
    const fireball = useFireball()

    // All requests are independent — parallelise. Composables cache results
    // so concurrent calls from app.ts share the same in-flight fetches.
    await Promise.all([
      nuforc.loadManifest(),
      hatch.loadManifest(),
      chronology.loadManifest(),
      gdelt.load(),
      gnews.load(),
      fireball.load()
    ])

    // Guard: user may have dismissed the modal while loading
    if (!WelcomeModal.contentEl) return

    const { stats, sources } = useDeriveWelcomeData({
      nuforc,
      hatch,
      chronology,
      chronologyManifest:  await chronology.loadManifest(), // cached, free
      gdeltCollection:     gdelt.getCollection(),
      gnewsCollection:     gnews.getCollection(),
      fireballCollection:  fireball.getCollection()
    })

    clearChildren(WelcomeModal.contentEl)
    WelcomeModal.contentEl.className = cx.body

    WelcomeModal.renderBody(WelcomeModal.contentEl, stats, sources)
  }

  // ─── Rendering ─────────────────────────────────────────────────

  private static renderBody(
    body: HTMLElement,
    stats: WelcomeStats,
    sources: WelcomeSource[]
  ): void {
    for (const paragraph of WELCOME.BODY) {
      body.appendChild(h('p', { className: cx.text }, paragraph))
    }

    body.appendChild(
      h('div', { className: cx.stats },
        WelcomeModal.stat(stats.timespan,  WELCOME.STAT_TIMESPAN_LABEL),
        WelcomeModal.stat(stats.records,   WELCOME.STAT_RECORDS_LABEL),
        WelcomeModal.stat(stats.sources,   WELCOME.STAT_SOURCES_LABEL),
        WelcomeModal.stat(stats.coverage,  WELCOME.STAT_COVERAGE_LABEL)
      )
    )

    body.appendChild(h('div', { className: cx.sourcesTitle }, WELCOME.SOURCES_TITLE))

    const sourceList = h('div', { className: cx.sources })
    for (const src of sources) {
      sourceList.appendChild(
        h('div', { className: cx.source },
          h('span', { className: `${cx.sourceTier} ${TIER_CX[src.tier]}` }),
          h('span', { className: cx.sourceName }, src.name),
          h('span', { className: cx.sourceMeta }, `${src.records} · ${src.period}`)
        )
      )
    }
    body.appendChild(sourceList)

    body.appendChild(
      h('p', { className: `${cx.text} ${cx.textClosing}` }, WELCOME.CLOSING)
    )
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private static stat(value: string, label: string): HTMLElement {
    return h('div', { className: cx.stat },
      h('span', { className: cx.statValue }, value),
      h('span', { className: cx.statLabel }, label)
    )
  }
}
