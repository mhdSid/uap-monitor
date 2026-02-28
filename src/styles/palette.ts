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

  green500: '#00ff41',
  green400: '#00ff88',
  green500_70: 'rgba(0, 255, 65, 0.7)',
  green500_50: 'rgba(0, 255, 65, 0.5)',
  green400_70: 'rgba(0, 255, 136, 0.7)',
  green400_30: 'rgba(0, 255, 136, 0.3)',
  green400_08: 'rgba(0, 255, 136, 0.08)',

  amber500: '#f59e0b',
  amber400: '#ffb400',
  amber500_90: 'rgba(255, 180, 0, 0.9)',
  amber500_40: 'rgba(255, 180, 0, 0.4)',

  red500: '#f87171',
  cyan500: '#22d3ee',
  cyan400: '#00d4ff',
  purple500: '#a78bfa',

  white20: 'rgba(255, 255, 255, 0.2)',
  white15: 'rgba(255, 255, 255, 0.15)',
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
} as const
