import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { Loader } from '@/components/loader'
import { h, el, addClass } from '@/utils/dom'

export interface AsyncImageProps {
  src: string
  alt: string
  /** CSS aspect-ratio value, default '16 / 9' */
  aspect?: string
}

/**
 * AsyncImage — image component with radar loader placeholder, fade-in on load,
 * and graceful error handling. Fixed aspect ratio prevents layout shift.
 *
 * Usage:
 *   const img = new AsyncImage({ src: url, alt: 'Article thumbnail' })
 *   container.appendChild(img.el)
 */
export class AsyncImage extends Component<AsyncImageProps> {
  protected create (): HTMLElement {
    const root = h('div', {
      className: cx.root,
      role: 'img',
      'aria-label': this.props.alt
    })

    if (this.props.aspect) {
      root.style.aspectRatio = this.props.aspect
    }

    // Loader placeholder — centered in the reserved space
    const loader = new Loader({})
    const placeholder = h('div', { className: cx.placeholder })
    placeholder.appendChild(loader.el)

    // Image element — hidden until loaded
    const img = el('img', {
      className: cx.img,
      alt: this.props.alt,
      decoding: 'async'
    })

    img.addEventListener('load', () => {
      addClass(img, cx.imgLoaded)
      setTimeout(() => placeholder.remove(), 350)
    })

    img.addEventListener('error', () => {
      addClass(root, cx.error)
      root.setAttribute('aria-hidden', 'true')
    })

    img.src = this.props.src

    root.appendChild(placeholder)
    root.appendChild(img)

    return root
  }
}
