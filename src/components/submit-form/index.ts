import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, hide, show, setAttrs } from '@/core/dom'
import { TextInput } from '@/components/text-input'
import { TextArea } from '@/components/text-area'
import { Select } from '@/components/select'
import { Button } from '@/components/button'
import { ButtonSize, ComponentSize, SightingShape } from '@/enums'
import { SUBMIT_FORM, ARIA } from '@/data/strings'
import { useToast } from '@/components/toast'
import type { SelectOption } from '@/components/select'

// ─── Helpers ────────────────────────────────────────────────────────

const SHAPE_OPTIONS: SelectOption[] = [
  { value: '', label: SUBMIT_FORM.SHAPE_DEFAULT },
  ...Object.values(SightingShape).map((shape) => ({
    value: shape,
    label: shape
  }))
]

// ─── Component ──────────────────────────────────────────────────────

export class SubmitForm extends Component {
  private formRoot!: HTMLElement
  private successEl!: HTMLElement
  private errorEl!: HTMLElement
  private submitBtn!: Button
  private submitting = false

  // Field refs
  private dateInput!: TextInput
  private locationInput!: TextInput
  private shapeSelect!: Select
  private durationInput!: TextInput
  private observersInput!: TextInput
  private titleInput!: TextInput
  private descriptionTextarea!: TextArea
  private emailInput!: TextInput

  protected create (): HTMLElement {
    const toast = useToast()

    // ── Fields ──────────────────────────────────────────────────
    this.dateInput = new TextInput({
      name: 'date',
      ariaLabel: ARIA.SUBMIT_DATE,
      inputType: 'date',
      size: ComponentSize.LG
    })

    this.locationInput = new TextInput({
      name: 'location',
      placeholder: SUBMIT_FORM.LOCATION_PLACEHOLDER,
      ariaLabel: ARIA.SUBMIT_LOCATION,
      size: ComponentSize.LG
    })

    this.shapeSelect = new Select({
      name: 'shape',
      ariaLabel: ARIA.SUBMIT_SHAPE,
      options: SHAPE_OPTIONS,
      size: ComponentSize.LG
    })

    this.durationInput = new TextInput({
      name: 'duration',
      placeholder: SUBMIT_FORM.DURATION_PLACEHOLDER,
      ariaLabel: ARIA.SUBMIT_DURATION,
      size: ComponentSize.LG
    })

    this.observersInput = new TextInput({
      name: 'observers',
      placeholder: SUBMIT_FORM.OBSERVERS_PLACEHOLDER,
      ariaLabel: ARIA.SUBMIT_OBSERVERS,
      inputType: 'number',
      min: '1',
      max: '10000',
      size: ComponentSize.LG
    })

    this.titleInput = new TextInput({
      name: 'title',
      placeholder: SUBMIT_FORM.TITLE_PLACEHOLDER,
      ariaLabel: ARIA.SUBMIT_TITLE,
      size: ComponentSize.LG
    })

    this.descriptionTextarea = new TextArea({
      name: 'description',
      placeholder: SUBMIT_FORM.DESCRIPTION_PLACEHOLDER,
      ariaLabel: ARIA.SUBMIT_DESCRIPTION,
      rows: 5,
      size: ComponentSize.LG
    })

    this.emailInput = new TextInput({
      name: 'email',
      placeholder: SUBMIT_FORM.EMAIL_PLACEHOLDER,
      ariaLabel: ARIA.SUBMIT_EMAIL,
      inputType: 'email',
      size: ComponentSize.LG
    })

    // ── Layout ──────────────────────────────────────────────────

    this.errorEl = h('div', { className: cx.error })
    hide(this.errorEl)

    this.successEl = h('div', { className: cx.success },
      h('span', { className: cx.successIcon }, SUBMIT_FORM.SUCCESS_ICON),
      SUBMIT_FORM.SUCCESS_MESSAGE
    )
    hide(this.successEl)

    this.submitBtn = new Button({
      label: SUBMIT_FORM.SUBMIT_LABEL,
      variant: 'solid',
      color: 'primary',
      size: ButtonSize.MD,
      onClick: async () => {
        if (this.submitting) return
        hide(this.errorEl)
        const payload = this.getPayload()
        if (!payload) return

        this.submitting = true
        setAttrs(this.submitBtn.el, { disabled: true })

        try {
          const res = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })

          const data = await res.json()

          if (res.ok && data.success) {
            hide(this.formRoot)
            show(this.successEl)
            toast.success(SUBMIT_FORM.TOAST_SUCCESS)
          } else {
            this.errorEl.textContent = data.error || SUBMIT_FORM.ERROR_GENERIC
            show(this.errorEl)
          }
        } catch {
          this.errorEl.textContent = SUBMIT_FORM.ERROR_NETWORK
          show(this.errorEl)
        } finally {
          this.submitting = false
          setAttrs(this.submitBtn.el, { disabled: false })
        }
      }
    })

    this.formRoot = h('div', { className: cx.root },
      // Row: Date + Shape (half)
      h('div', { className: cx.rowHalf },
        this.buildField(SUBMIT_FORM.DATE_LABEL, this.dateInput.el, true),
        this.buildField(SUBMIT_FORM.SHAPE_LABEL, this.shapeSelect.el, true)
      ),

      // Row: Location
      this.buildField(SUBMIT_FORM.LOCATION_LABEL, this.locationInput.el, true),

      // Row: Duration + Observers (half)
      h('div', { className: cx.rowHalf },
        this.buildField(SUBMIT_FORM.DURATION_LABEL, this.durationInput.el),
        this.buildField(SUBMIT_FORM.OBSERVERS_LABEL, this.observersInput.el)
      ),

      // Row: Title
      this.buildField(SUBMIT_FORM.TITLE_LABEL, this.titleInput.el, true),

      // Row: Description
      this.buildField(SUBMIT_FORM.DESCRIPTION_LABEL, this.descriptionTextarea.el, true),

      // Row: Email
      this.buildField(SUBMIT_FORM.EMAIL_LABEL, this.emailInput.el, false,
        SUBMIT_FORM.EMAIL_HINT
      ),

      // Error + submit
      this.errorEl,
      h('div', { className: cx.footer }, this.submitBtn.el)
    )

    return h('div', {},
      this.formRoot,
      this.successEl
    )
  }

  private buildField (
    label: string,
    input: HTMLElement,
    required = false,
    hint?: string
  ): HTMLElement {
    const labelEl = h('label', { className: cx.label },
      label,
      required ? h('span', { className: cx.required }, '*') : ''
    )

    const row = h('div', { className: cx.row }, labelEl, input)

    if (hint) {
      row.appendChild(h('span', { className: cx.hint }, hint))
    }

    return row
  }

  private getPayload (): Record<string, unknown> | null {
    const date = this.dateInput.value.trim()
    const location = this.locationInput.value.trim()
    const shape = this.shapeSelect.value
    const title = this.titleInput.value.trim()
    const description = this.descriptionTextarea.value.trim()
    const duration = this.durationInput.value.trim() || undefined
    const observers = this.observersInput.value ? Number(this.observersInput.value) : undefined
    const contactEmail = this.emailInput.value.trim() || undefined

    if (!date || !location || !shape || !description || !title) {
      this.errorEl.textContent = SUBMIT_FORM.ERROR_REQUIRED
      show(this.errorEl)
      return null
    }

    return { date, location, shape, title, description, duration, observers, contactEmail }
  }
}
