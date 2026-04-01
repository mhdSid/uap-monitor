import './styles.css'
import { cx } from './cx'
import { cx as appCx } from '../app/cx'
/* ------------------------------------------------------------------ *
 *  ResearchView — statistical hypothesis results + methodology        *
 *                                                                     *
 *  Fetches public/data/hypotheses.json and renders each result as     *
 *  a card with status badge, summary, and effect size.                *
 *  No reactive store dependency — pure static data display.           *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, hide, show } from '@/core/dom'
import { Loader } from '@/components/loader'
import { RESEARCH } from '@/data/strings'
import { fetchJson, dataUrl } from '@/composables/use-fetch'

// ─── Local types (not in global types — research-view only) ─────────

interface HypothesisResult {
  id: string
  name: string
  status: string
  supported: boolean
  effectSize: number | null
  chiSquared?: number | null
  degreesOfFreedom?: number | null
  summary: string
}

interface HypothesesReport {
  generatedAt: string
  totalHypotheses: number
  completed: number
  supported: number
  datasetsLoaded: Record<string, boolean>
  results: HypothesisResult[]
}

// ─── Component ──────────────────────────────────────────────────────

export class ResearchView extends Component {
  private loaderEl!: HTMLElement
  private contentEl!: HTMLElement
  private loaded = false

  protected create (): HTMLElement {
    this.loaderEl = h('div', { className: appCx.viewLoader }, new Loader({}).el)
    this.contentEl = h('div', { className: appCx.appViewContent })
    hide(this.contentEl)

    return h('div', { className: [cx.root, appCx.appView].join(' ') },
      this.loaderEl,
      this.contentEl
    )
  }

  // ─── Public API ─────────────────────────────────────────────────

  async load (): Promise<void> {
    if (this.loaded) return

    try {
      const report = await fetchJson<HypothesesReport>(dataUrl('hypotheses.json'))
      this.buildContent(report)
    } catch {
      this.buildError()
    }

    this.loaded = true
    hide(this.loaderEl)
    show(this.contentEl)
  }

  // ─── Build ──────────────────────────────────────────────────────

  private buildContent (report: HypothesesReport): void {
    const datasets = Object.values(report.datasetsLoaded).filter(Boolean).length

    // Header
    this.contentEl.appendChild(
      h('div', { className: cx.header },
        h('h1', { className: cx.title }, RESEARCH.TITLE),
        h('p', { className: cx.subtitle }, RESEARCH.SUBTITLE)
      )
    )

    // Summary stats
    const stats: [string, string][] = [
      [String(report.totalHypotheses), RESEARCH.STAT_TOTAL],
      [String(report.supported), RESEARCH.STAT_SUPPORTED],
      [String(datasets), RESEARCH.STAT_DATASETS]
    ]

    this.contentEl.appendChild(
      h('div', { className: cx.summaryGrid },
        ...stats.map(([value, label]) =>
          h('div', { className: cx.summaryItem },
            h('span', { className: cx.summaryValue }, value),
            h('span', { className: cx.summaryLabel }, label)
          )
        )
      )
    )

    // Hypothesis cards
    const listContainer = h('div', {})
    listContainer.appendChild(h('p', { className: cx.listTitle }, `HYPOTHESES — ${report.completed} TESTED`))

    for (const result of report.results) {
      listContainer.appendChild(ResearchView.buildCard(result))
    }

    this.contentEl.appendChild(listContainer)

    // Methodology block
    this.contentEl.appendChild(
      h('div', { className: cx.methodology },
        h('p', { className: cx.methodologyTitle }, RESEARCH.METHODOLOGY_TITLE),
        h('p', { className: cx.methodologyBody }, RESEARCH.METHODOLOGY_BODY)
      )
    )

    // Attribution
    this.contentEl.appendChild(
      h('p', { className: cx.attribution }, RESEARCH.ATTRIBUTION)
    )
  }

  private buildError (): void {
    this.contentEl.appendChild(
      h('p', { className: cx.subtitle }, RESEARCH.ERROR)
    )
  }

  // ─── Card builder ───────────────────────────────────────────────

  private static buildCard (result: HypothesisResult): HTMLElement {
    const isSupported = result.supported
    const cardCls = `${cx.card} ${isSupported ? cx.cardSupported : cx.cardRefuted}`
    const badgeCls = `${cx.badge} ${isSupported ? cx.badgeSupported : cx.badgeRefuted}`
    const badgeText = isSupported ? RESEARCH.CARD_SUPPORTED : RESEARCH.CARD_NOT_SUPPORTED

    const metaItems: HTMLElement[] = []

    if (result.effectSize != null) {
      const item = h('span', { className: cx.cardMetaItem },
        RESEARCH.CARD_EFFECT,
        h('span', {}, result.effectSize.toFixed(3))
      )
      metaItems.push(item)
    }

    if (result.chiSquared != null) {
      const df = result.degreesOfFreedom != null ? `(${result.degreesOfFreedom})` : ''
      const item = h('span', { className: cx.cardMetaItem },
        `${RESEARCH.CARD_CHI}${df}`,
        h('span', {}, result.chiSquared.toFixed(1))
      )
      metaItems.push(item)
    }

    return h('div', { className: cardCls },
      h('div', { className: cx.cardHeader },
        h('span', { className: cx.cardName }, result.name),
        h('span', { className: badgeCls }, badgeText)
      ),
      h('p', { className: cx.cardSummary }, result.summary),
      ...(metaItems.length > 0
        ? [h('div', { className: cx.cardMeta }, ...metaItems)]
        : []
      )
    )
  }
}
