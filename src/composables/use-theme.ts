import { THEME } from '@/data/strings'
import { signal, type Signal } from './use-store'

// ─── Types ──────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'uap-theme'
const ATTR = 'data-theme'

// ─── Singleton ──────────────────────────────────────────────────────

export interface ITheme {
  theme: Signal<Theme>
  toggle: (value?: Theme) => void
  isLightTheme: () => boolean
  isDarkTheme: () => boolean
}

let instance: ITheme | null = null

export function useTheme () {
  if (instance) return instance

  const initial = resolveInitial()
  const theme = signal<Theme>(initial)

  apply(initial)

  function toggle (value?: Theme): void {
    const next: Theme = theme.get() === THEME.DARK ? THEME.LIGHT : THEME.DARK
    const themVal = value ?? next
    theme.set(themVal)
    apply(themVal)
    try {
      localStorage.setItem(STORAGE_KEY, themVal)
    } catch { /* private mode */ }
  }

  const isLightTheme = () => theme.get() === THEME.LIGHT
  const isDarkTheme = () => theme.get() === THEME.DARK

  instance = { theme, toggle, isLightTheme, isDarkTheme }
  return instance
}

// ─── Helpers ────────────────────────────────────────────────────────

function resolveInitial (): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === THEME.DARK || stored === THEME.LIGHT) return stored
  } catch { /* private mode */ }

  return THEME.DARK
}

function apply (theme: Theme): void {
  if (theme === THEME.DARK) {
    document.documentElement.removeAttribute(ATTR)
  } else {
    document.documentElement.setAttribute(ATTR, theme)
  }
}
