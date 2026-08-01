/**
 * Palette — raw color values matching CSS tokens.
 *
 * Use CSS custom properties (var(--color-*)) whenever possible.
 * Import from this module ONLY for contexts that can't use CSS variables
 * (e.g. canvas 2D context, inline SVG generation, Leaflet markers).
 */

// ─── Palette ────────────────────────────────────────────────────────

export const palette = {
  black: '#000',
  white: '#fff',

  green600: 'rgb(0, 143, 36)',
  green500: '#00ff41',
  green400: '#00ff88',
  green500_20: 'rgba(0, 255, 65, 0.2)',
  green500_50: 'rgba(0, 255, 65, 0.5)',
  green500_70: 'rgba(0, 255, 65, 0.7)',
  green500_90: 'rgba(0, 255, 65, 0.9)',
  green400_70: 'rgba(0, 255, 136, 0.7)',
  green400_20: 'rgba(0, 255, 136, 0.2)',
  green400_30: 'rgba(0, 255, 136, 0.3)',
  green400_08: 'rgba(0, 255, 136, 0.08)',
  green600_20: 'rgba(0, 143, 36, 0.2)',
  green600_80: 'rgba(0, 143, 36, 0.8)',

  black500_50: 'rgba(0, 0, 0, 0.5)',
  black500_30: 'rgba(0, 0, 0, 0.3)',

  amber500: '#f59e0b',
  amber400: '#ffb400',
  amber500_90: 'rgba(255, 180, 0, 0.9)',
  amber500_40: 'rgba(255, 180, 0, 0.4)',

  red500: '#f87171',
  red500_70: 'rgba(248, 113, 113, 0.7)',
  red500_30: 'rgba(248, 113, 113, 0.3)',
  cyan500: '#22d3ee',
  cyan500_35: 'rgba(34, 211, 238, 0.35)',
  cyan500_70: 'rgba(34, 211, 238, 0.7)',
  cyan400: '#00d4ff',
  purple500: '#a78bfa',
  pink400: '#f472b6',
  blue400: '#60a5fa',

  amber500_70: 'rgba(245, 158, 11, 0.7)',
  amber500_20: 'rgba(245, 158, 11, 0.2)',
  green500_30: 'rgba(0, 255, 65, 0.3)',

  // ── Light-mode canvas equivalents (darker for contrast on white bg) ──
  green600_70: 'rgba(0, 143, 36, 0.7)',
  green600_30: 'rgba(0, 143, 36, 0.3)',
  red600: '#dc2626',
  red600_70: 'rgba(220, 38, 38, 0.7)',
  red600_30: 'rgba(220, 38, 38, 0.3)',
  cyan600: '#0891b2',
  cyan600_70: 'rgba(8, 145, 178, 0.7)',
  cyan600_35: 'rgba(8, 145, 178, 0.35)',
  amber600: '#b45309',
  amber600_70: 'rgba(180, 83, 9, 0.7)',
  amber600_20: 'rgba(180, 83, 9, 0.2)',
  black_08: 'rgba(0, 0, 0, 0.08)',
  black_15: 'rgba(0, 0, 0, 0.15)',

  white50: 'rgba(255, 255, 255, 0.5)',
  white20: 'rgba(255, 255, 255, 0.2)',
  white15: 'rgba(255, 255, 255, 0.15)',
  white08: 'rgba(255, 255, 255, 0.08)'
} as const

// ─── Semantic tokens (JS-side) ──────────────────────────────────────

export const colors = {
  bg: palette.black,
  text: '#c0c0c0',
  muted: '#777',
  green: palette.green500,
  amber: palette.amber500,
  red: palette.red500,
  cyan: palette.cyan500,
  purple: palette.purple500,

  sourceNuforc: palette.green400,
  sourceHatch: palette.cyan400,
  sourceChronology: palette.amber400,
  sourceExperiencer: palette.purple500,
  sourceGeipan: palette.pink400,
  sourceFireball: '#ff6b35',
  sourceNuclear: '#fbbf24',
  sourceDowPursue: palette.blue400
} as const
