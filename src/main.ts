import css from '@/styles/main.css?inline'
import { createApp } from '@/app'
import { qs } from '@/utils/dom'

document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`)

createApp(qs('#app'))

// Register service worker after app is mounted (non-blocking)
if ('serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL ?? '/'
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {})
  })
}
