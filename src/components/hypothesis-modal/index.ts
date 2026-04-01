import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  HypothesisModal — detail view for a single hypothesis result       *
 *                                                                     *
 *  Opens via Modal.open() following the SightingModal static pattern. *
 *  Sections: description · datasets · result stats · algorithm source *
 * ------------------------------------------------------------------ */

import { h } from '@/core/dom'
import { Modal } from '@/components/modal'
import { Tag } from '@/components/tags'
import { TagVariant, TagSize } from '@/enums'
import { HYPOTHESIS_MODAL, RESEARCH } from '@/data/strings'

// ─── Type (mirrors HypothesisResult in research-view + new fields) ──

export interface HypothesisEntry {
  id: string
  name: string
  description: string
  datasets: string[]
  testSource?: string
  supported: boolean
  effectSize: number | null
  chiSquared?: number | null
  degreesOfFreedom?: number | null
  summary: string
}

// ─── Component ──────────────────────────────────────────────────────

export class HypothesisModal {
  static open (entry: HypothesisEntry, trigger?: HTMLElement): void {
    Modal.open({
      header: () => HypothesisModal.buildHeader(entry),
      content: () => HypothesisModal.buildContent(entry),
      footer: () => HypothesisModal.buildFooter(entry),
      onClose: () => requestAnimationFrame(() => trigger?.focus())
    }, trigger)
  }

  // ─── Slots ────────────────────────────────────────────────────────

  private static buildHeader (e: HypothesisEntry): HTMLElement {
    return h('div', { className: cx.header },
      h('span', { className: cx.title }, e.name)
    )
  }

  private static buildContent (e: HypothesisEntry): HTMLElement {
    const statusTag = new Tag({
      variant: e.supported ? TagVariant.STATUS_VERIFIED : TagVariant.DISABLED,
      label: e.supported ? RESEARCH.CARD_SUPPORTED : RESEARCH.CARD_NOT_SUPPORTED,
      size: TagSize.XS
    })

    const sections: HTMLElement[] = [statusTag.el]

    // ── Description ────────────────────────────────────────────────
    sections.push(
      h('div', { className: cx.section },
        h('div', { className: cx.sectionTitle }, HYPOTHESIS_MODAL.SECTION_DESCRIPTION),
        h('p', { className: cx.body }, e.description)
      )
    )

    // ── Datasets ───────────────────────────────────────────────────
    if (e.datasets?.length > 0) {
      sections.push(
        h('div', { className: cx.section },
          h('div', { className: cx.sectionTitle }, HYPOTHESIS_MODAL.SECTION_DATASETS),
          h('div', { className: cx.datasetRow },
            ...e.datasets.map(d =>
              new Tag({ variant: TagVariant.COUNT, label: d, size: TagSize.XS }).el
            )
          )
        )
      )
    }

    // ── Result stats + summary ─────────────────────────────────────
    const statItems: HTMLElement[] = []

    if (e.effectSize != null) {
      statItems.push(
        h('div', { className: cx.resultItem },
          h('span', { className: cx.resultLabel }, HYPOTHESIS_MODAL.EFFECT_LABEL),
          h('span', { className: cx.resultValue }, e.effectSize.toFixed(3))
        )
      )
    }

    if (e.chiSquared != null) {
      const label = e.degreesOfFreedom != null
        ? `${HYPOTHESIS_MODAL.CHI_LABEL}(${e.degreesOfFreedom})`
        : HYPOTHESIS_MODAL.CHI_LABEL
      statItems.push(
        h('div', { className: cx.resultItem },
          h('span', { className: cx.resultLabel }, label),
          h('span', { className: cx.resultValue }, e.chiSquared.toFixed(1))
        )
      )
    }

    const resultSection = h('div', { className: cx.section },
      h('div', { className: cx.sectionTitle }, HYPOTHESIS_MODAL.SECTION_RESULT)
    )

    if (statItems.length > 0) {
      resultSection.appendChild(h('div', { className: cx.resultRow }, ...statItems))
    }

    resultSection.appendChild(h('p', { className: cx.body }, e.summary))

    sections.push(resultSection)

    // ── Algorithm source ───────────────────────────────────────────
    if (e.testSource) {
      sections.push(
        h('div', { className: cx.section },
          h('div', { className: cx.sectionTitle }, HYPOTHESIS_MODAL.SECTION_ALGORITHM),
          h('pre', { className: cx.code }, e.testSource)
        )
      )
    }

    return h('div', { className: cx.content }, ...sections)
  }

  private static buildFooter (e: HypothesisEntry): HTMLElement {
    return h('div', { className: cx.footer },
      h('span', { style: 'font-family:var(--font-mono);font-size:var(--fs-3xs);color:var(--color-dim);letter-spacing:0.8px' },
        `ID: ${e.id}`
      )
    )
  }
}
