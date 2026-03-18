import './styles.css'
import { cx } from './cx'
import { h } from '@/utils/dom'
import { Modal } from '@/components/modal'
import { SubmitForm } from '@/components/submit-form'
import { SUBMIT_FORM } from '@/data/strings'

export class SubmitModal {
  static open (trigger?: HTMLElement): void {
    Modal.open({
      header: () => SubmitModal.buildHeader(),
      content: () => new SubmitForm({}).el
    }, trigger)
  }

  private static buildHeader (): HTMLElement {
    return h('div', { className: cx.header },
      h('span', { className: cx.title }, SUBMIT_FORM.MODAL_TITLE),
      h('span', { className: cx.subtitle }, SUBMIT_FORM.MODAL_SUBTITLE)
    )
  }
}
