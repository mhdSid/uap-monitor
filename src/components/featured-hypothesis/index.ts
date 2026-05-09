import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  FeaturedHypothesis — banner surfacing one hypothesis on the        *
 *                        monitor view                                 *
 *                                                                     *
 *  Reads public/data/hypotheses.json, finds the entry whose id        *
 *  matches FEATURED_HYPOTHESIS_ID, and renders an eyebrow / headline  *
 *  / summary / two CTAs.                                              *
 *                                                                     *
 *  Click anywhere (except CTAs) → opens HypothesisModal for entry.   *
 *  READ button       → opens HypothesisModal.                         *
 *  VIEW ALL button   → navigates to /research.                        *
 *                                                                     *
 *  Hidden until the entry resolves. On fetch failure: stays hidden.   *
 * ------------------------------------------------------------------ */

import { Component, RouteName } from '@/core'
import { h, clearChildren, hide, show, setAttrs } from '@/core/dom'
import { Button } from '@/components/button'
import { HypothesisModal } from '@/components/hypothesis-modal'
import type { HypothesisEntry } from '@/components/hypothesis-modal'
import { iconExternal } from '@/components/icons'
import { fetchJson, dataUrl } from '@/composables/use-fetch'
import { ButtonSize, ButtonVariant, ButtonColor } from '@/enums'
import { FEATURED, ARIA } from '@/data/strings'
import { FEATURED_HYPOTHESIS_ID } from '@/data/config'
import { formatMonthDay } from '@/utils/format'

// ─── Local types (mirror ResearchView's HypothesesReport) ───────────

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
  results: HypothesisResult[]
}

// ─── Component ──────────────────────────────────────────────────────

export class FeaturedHypothesis extends Component {
  private bodyEl!: HTMLElement
  private entry: HypothesisEntry | null = null

  protected create (): HTMLElement {
    this.bodyEl = h('div', { className: cx.body })

    return h('article', {
      className: cx.root,
      tabIndex: 0,
      role: 'button',
      'aria-label': ARIA.FEATURED_HYPOTHESIS,
      hidden: true
    },
      h('div', { className: cx.crosshair, 'aria-hidden': 'true' }),
      this.bodyEl
    )
  }

  protected didMount (): void {
    this.el.addEventListener('click', (e) => this.handleClick(e))
    this.el.addEventListener('keydown', (e) => this.handleKey(e))
    void this.loadAsync()
  }

  // ─── Async load ─────────────────────────────────────────────────

  private async loadAsync (): Promise<void> {
    try {
      const report = await fetchJson<HypothesesReport>(dataUrl('hypotheses.json'))
      const result = report.results.find(r => r.id === FEATURED_HYPOTHESIS_ID)
      if (!result || !this.el.isConnected) return

      this.entry = {
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

      this.renderEntry(report.generatedAt)
      setAttrs(this.el, { hidden: null })
      show(this.el)
    } catch {
      hide(this.el)
    }
  }

  // ─── Build body ─────────────────────────────────────────────────

  private renderEntry (generatedAt: string): void {
    const date = formatMonthDay(generatedAt)

    const eyebrow = h('div', { className: cx.eyebrow },
      h('span', { className: cx.eyebrowDot, 'aria-hidden': 'true' }),
      h('span', { className: cx.eyebrowText }, `${FEATURED.LABEL} ${FEATURED.SEP} ${date}`)
    )

    const headline = h('h2', { className: cx.headline }, this.entry!.name)
    const summary = h('p', { className: cx.summary }, this.entry!.summary)

    const readBtn = new Button({
      label: FEATURED.READ_METHODOLOGY,
      variant: ButtonVariant.SOFT,
      color: ButtonColor.PRIMARY,
      size: ButtonSize.SM,
      trailingIcon: () => iconExternal(11),
      onClick: () => this.openModal()
    })

    const allBtn = new Button({
      label: FEATURED.VIEW_ALL,
      variant: ButtonVariant.OUTLINE,
      color: ButtonColor.NEUTRAL,
      size: ButtonSize.SM,
      onClick: () => this.navigateResearch()
    })

    const ctaRow = h('div', { className: cx.cta }, readBtn.el, allBtn.el)

    clearChildren(this.bodyEl)
    this.bodyEl.appendChild(eyebrow)
    this.bodyEl.appendChild(headline)
    this.bodyEl.appendChild(summary)
    this.bodyEl.appendChild(ctaRow)
  }

  // ─── Handlers ───────────────────────────────────────────────────

  private handleClick (e: MouseEvent): void {
    // Clicks on the CTA buttons handle their own actions; ignore here.
    const target = e.target as HTMLElement | null
    if (target && target.closest(`.${cx.cta}`)) return
    this.openModal()
  }

  private handleKey (e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      this.openModal()
    }
  }

  private openModal (): void {
    if (!this.entry) return
    HypothesisModal.open(this.entry, this.el)
  }

  private navigateResearch (): void {
    window.history.pushState(null, '', `/${RouteName.RESEARCH}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}
