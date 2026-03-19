import { tokensCSS, baseCSS } from '@/styles'
import { createApp } from '@/views/app/app'
import { qs } from '@/utils/dom'

document.head.insertAdjacentHTML('beforeend', `<style>${tokensCSS}</style>`)
document.head.insertAdjacentHTML('beforeend', `<style>${baseCSS}</style>`)

createApp(qs('#app')!)

// Register service worker after app is mounted (non-blocking)
if ('serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL ?? '/'
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {})
  })
}
