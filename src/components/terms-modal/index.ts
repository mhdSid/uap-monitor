import './styles.css'
import { cx } from './cx'
import { h } from '@/utils/dom'
import { Modal } from '@/components/modal'
import { TERMS } from '@/data/legal'

export class TermsModal {
  static open(trigger?: HTMLElement | null): void {
    Modal.open({
      header: () => h('h2', { className: cx.title }, TERMS.TITLE),
      content: () => {
        const body = h('div', { className: cx.body })

        body.appendChild(
          h('p', { className: cx.updated }, TERMS.LAST_UPDATED)
        )

        for (const section of TERMS.SECTIONS) {
          body.appendChild(h('h3', { className: cx.heading }, section.heading))
          body.appendChild(h('p', { className: cx.paragraph }, section.body))
        }

        return body
      }
    }, trigger)
  }
}
