import './styles.css'
import { cx } from './cx'
import { cx as appCx } from '../app/cx'
/* ------------------------------------------------------------------ *
 *  ResearchView — statistical hypothesis results + methodology        *
 *                                                                     *
 *  Fetches public/data/hypotheses.json and renders each result.       *
 *  Composes existing components — no inline molecule construction.    *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, hide, show, setText } from '@/core/dom'
import { Loader } from '@/components/loader'
import { Footer } from '@/components/footer'
import { Section } from '@/components/layout'
import { Alert } from '@/components/alert'
import { Card } from '@/components/card'
import { DataSources } from '@/components/data-sources'
import { StatCard, StatCardGrid, createStatValue } from '@/components/stat-card'
import { HypothesisCard } from '@/components/hypothesis-card'
import { HypothesisModal } from '@/components/hypothesis-modal'
import { RESEARCH, SECTION } from '@/data/strings'
import { AlertVariant } from '@/enums'
import { fetchJson, dataUrl } from '@/composables/use-fetch'
import { useAppStore } from '@/composables'
import type { HypothesisEntry } from '@/components/hypothesis-modal'

// ─── Local types ─────────────────────────────────────────────────────

interface HypothesisResult {
  id: string
  name: string
  description: string
  status: string
  supported: boolean
  effectSize: number | null
  chiSquared?: number | null
  degreesOfFreedom?: number | null
  summary: string
  datasets?: string[]
  testSource?: string
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

    // ── Summary stat values ───────────────────────────────────────
    const totalVal = createStatValue()
    const supportedVal = createStatValue()
    const datasetsVal = createStatValue()
    setText(totalVal, String(report.totalHypotheses))
    setText(supportedVal, String(report.supported))
    setText(datasetsVal, String(datasets))

    // ── Hypothesis cards ──────────────────────────────────────────
    const cards = report.results.map(result => {
      const entry: HypothesisEntry = {
        id: result.id,
        name: result.name,
        description: result.description,
        datasets: result.datasets ?? [],
        testSource: result.testSource,
        supported: result.supported,
        effectSize: result.effectSize,
        chiSquared: result.chiSquared,
        degreesOfFreedom: result.degreesOfFreedom,
        summary: result.summary
      }
      return this.ownChild(new HypothesisCard({
        entry,
        onOpen: (e, trigger) => HypothesisModal.open(e, trigger)
      })).el
    })

    // ── Data sources ──────────────────────────────────────────────
    const sources = useAppStore().sources.get()
    const sourcesSection = sources.length > 0
      ? this.ownChild(new Section({
          title: SECTION.DATA_SOURCES,
          tooltip: SECTION.DATA_SOURCES_TOOLTIP,
          content: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
            this.ownChild(new Alert({
              variant: AlertVariant.INFO,
              title: SECTION.INTEL_TITLE,
              content: SECTION.INTEL_CONTENT,
              dismissible: true
            })).el,
            new DataSources({ sources }).el
          )
        })).el
      : null

    // ── Single append — full content tree built with h() ─────────
    this.contentEl.appendChild(
      h('div', {
        className: cx.root
      },
        h('div', { className: cx.header },
          h('h1', { className: cx.title }, RESEARCH.TITLE),
          h('p', { className: cx.subtitle }, RESEARCH.SUBTITLE)
        ),
        StatCardGrid(
          new StatCard({ label: RESEARCH.STAT_TOTAL, valueEl: totalVal, sub: '' }).el,
          new StatCard({ label: RESEARCH.STAT_SUPPORTED, valueEl: supportedVal, sub: '' }).el,
          new StatCard({ label: RESEARCH.STAT_DATASETS, valueEl: datasetsVal, sub: '' }).el
        ),
        h('div', {},
          h('p', { className: cx.listTitle }, `HYPOTHESES — ${report.completed} TESTED`),
          ...cards
        ),
        new Card({
          children: [
            h('div', { className: cx.methodology },
              h('p', { className: cx.methodologyTitle }, RESEARCH.METHODOLOGY_TITLE),
              h('p', { className: cx.methodologyBody }, RESEARCH.METHODOLOGY_BODY)
            )
          ]
        }).el,
        ...(sourcesSection ? [sourcesSection] : []),
        new Footer({}).el
      )
    )
  }

  private buildError (): void {
    this.contentEl.appendChild(
      h('p', { className: cx.subtitle }, RESEARCH.ERROR)
    )
  }
}
