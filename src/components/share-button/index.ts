import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { iconShare } from '@/components/icons'
import { useShare } from '@/composables'
import { useToast } from '@/components/toast'

export interface ShareButtonProps {
  sightingId: string
  year?: number
  title?: string
  size?: number
}

const ARIA_SHARE = 'Share sighting'

export class ShareButton extends Component<ShareButtonProps> {
  protected create (): HTMLElement {
    const { sightingId, year, title, size = 14 } = this.props
    const share = useShare()
    const toast = useToast()

    const btn = h('button', {
      className: cx.root,
      type: 'button',
      'aria-label': ARIA_SHARE
    }, iconShare(size)) as HTMLButtonElement

    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      e.preventDefault()

      const result = await share.shareSighting(sightingId, year, title)
      if (result.success) {
        toast.success(result.method === 'native' ? 'SHARED' : 'LINK COPIED')
      } else {
        toast.error('COULD NOT SHARE')
      }
    })

    return btn
  }
}
