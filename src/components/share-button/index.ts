import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/core/dom'
import { iconShare } from '@/components/icons'
import { useShare } from '@/composables'
import { useToast } from '@/components/toast'
import { ARIA, TOAST_MESSAGES } from '@/data/strings'

export interface ShareButtonProps {
  sightingId: string
  year?: number
  title?: string
  size?: number
}

export class ShareButton extends Component<ShareButtonProps> {
  protected create (): HTMLElement {
    const { sightingId, year, title, size = 14 } = this.props
    const share = useShare()
    const toast = useToast()

    const btn = h('button', {
      className: cx.root,
      type: 'button',
      'aria-label': ARIA.SHARE_SIGHTING
    }, iconShare(size)) as HTMLButtonElement

    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      e.preventDefault()

      const result = await share.shareSighting(sightingId, year, title)
      if (result.success) {
        toast.success(result.method === 'native' ? TOAST_MESSAGES.SHARED : TOAST_MESSAGES.LINK_COPIED)
      } else {
        toast.error(TOAST_MESSAGES.SHARE_ERROR)
      }
    })

    return btn
  }
}
