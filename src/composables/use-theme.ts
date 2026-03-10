import { signal, type Signal } from './use-store'

// ─── Types ──────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'uap-theme'
const ATTR = 'data-theme'

// ─── Singleton ──────────────────────────────────────────────────────

let instance: { theme: Signal<Theme>; toggle: () => void } | null = null

export function useTheme () {
  if (instance) return instance

  const initial = resolveInitial()
  const theme = signal<Theme>(initial)

  apply(initial)

  function toggle (): void {
    const next: Theme = theme.get() === 'dark' ? 'light' : 'dark'
    theme.set(next)
    apply(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* private mode */ }
  }

  instance = { theme, toggle }
  return instance
}

// ─── Helpers ────────────────────────────────────────────────────────

function resolveInitial (): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'dark' || stored === 'light') return stored
  } catch { /* private mode */ }

  return 'dark'
}

function apply (theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.removeAttribute(ATTR)
  } else {
    document.documentElement.setAttribute(ATTR, theme)
  }
}
