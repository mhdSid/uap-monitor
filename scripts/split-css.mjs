#!/usr/bin/env node
/**
 * Split main.css into per-component style files + tokens.
 * Creates cx (class names) constants for each component.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CSS_FILE = resolve(ROOT, 'src/styles/main.css')
const css = readFileSync(CSS_FILE, 'utf8')

// ── Section map: CSS section marker → component directory + output file ──
const SECTION_MAP = {
  'APP HEADER': { dir: 'header', file: 'styles.css' },
  'SECTION': { dir: 'layout', file: 'styles.css' },
  'TAG': { dir: 'tags', file: 'styles.css' },
  'CREDIBILITY BAR': { dir: 'credibility-bar', file: 'styles.css' },
  'NEWS FEED': { dir: 'news-feed', file: 'styles.css' },
  'DATA SOURCES': { dir: 'data-sources', file: 'styles.css' },
  'TICKER': { dir: 'ticker', file: 'styles.css' },
  'RADAR LOADER': { dir: 'loader', file: 'styles.css' },
  'MODAL': { dir: 'modal', file: 'styles.css' },
  'MODAL SIGHTING DETAIL': { dir: 'sighting-modal', file: 'styles.css' },
  'TOAST': { dir: 'toast', file: 'styles.css' },
  'YEAR SELECTOR': { dir: 'year-selector', file: 'styles.css' },
  'FILTER TOOLBAR': { dir: 'filter-toolbar', file: 'styles.css' },
  'DATA GRID': { dir: 'data-grid', file: 'styles.css' },
  'CELL: REPORT (summary primary, region secondary)': { dir: 'sighting-grid', file: 'styles.css' },
  'CELL HELPERS': { dir: 'sighting-grid', file: 'styles.css', append: true },
  'EMPTY STATE': { dir: 'sighting-grid', file: 'styles.css', append: true },
  'TOOLTIP': { dir: 'tooltip', file: 'styles.css' },
  'ALERT': { dir: 'alert', file: 'styles.css' },
  'BUTTON': { dir: 'button', file: 'styles.css' },
  'WELCOME MODAL': { dir: 'welcome-modal', file: 'styles.css' },
  'SIGHTING MAP': { dir: 'sighting-map', file: 'styles.css' },
  'TIMELINE': { dir: 'timeline', file: 'styles.css' },
}

// ── Global sections (stay in global.css) ──
const GLOBAL_SECTIONS = new Set([
  'VARIABLES', 'RESET', 'SCANLINES', 'MAIN', 'GRIDS CONTAINER',
  'CONTROLS FORM', 'FOCUS RING (a11y)', 'BODY SCROLL LOCK (when modal open)',
])

// ── Parse CSS into sections ──
const lines = css.split('\n')
const sections = []
let current = null

for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(/^\/\* ===== (.+?) =====/)
  if (match) {
    if (current) current.endLine = i - 1
    current = { name: match[1], startLine: i, endLine: lines.length - 1 }
    sections.push(current)
  }
}

// ── Handle RESPONSIVE section specially — needs to be split per component ──
const responsiveStart = sections.findIndex(s => s.name === 'RESPONSIVE')
let responsiveCSS = ''
if (responsiveStart >= 0) {
  const rs = sections[responsiveStart]
  responsiveCSS = lines.slice(rs.startLine, rs.endLine + 1).join('\n')
  // Remove from sections so it's handled separately
  sections.splice(responsiveStart, 1)
}

// ── Extract and write ──
const componentCSS = new Map() // dir → css content
const globalParts = []

for (const section of sections) {
  const content = lines.slice(section.startLine, section.endLine + 1).join('\n').trim()
  
  if (GLOBAL_SECTIONS.has(section.name)) {
    globalParts.push(content)
    continue
  }

  const mapping = SECTION_MAP[section.name]
  if (!mapping) {
    console.warn(`  ⚠ Unmapped section: "${section.name}" — adding to global`)
    globalParts.push(content)
    continue
  }

  const existing = componentCSS.get(mapping.dir) || ''
  componentCSS.set(mapping.dir, existing + (existing ? '\n\n' : '') + content)
}

// ── Write tokens.css ──
const tokensCSS = `/* ─── Design Tokens ─────────────────────────────────────────────────
 *  Single source of truth for all visual properties.
 *  Components reference these via var(--token-name).
 *  NO hardcoded colors anywhere else in the codebase.
 * ─────────────────────────────────────────────────────────────────── */

:root {
  /* ── Palette ─────────────────────────────────────────────────────── */
  --c-black: #000;
  --c-white: #fff;

  /* Greens */
  --c-green-500: #00ff41;
  --c-green-400: #00ff88;
  --c-green-300: #4ade80;
  --c-green-500-70: rgba(0, 255, 65, 0.7);
  --c-green-500-50: rgba(0, 255, 65, 0.5);
  --c-green-500-40: rgba(0, 255, 65, 0.4);
  --c-green-500-20: rgba(0, 255, 65, 0.2);
  --c-green-500-10: rgba(0, 255, 65, 0.1);
  --c-green-400-70: rgba(0, 255, 136, 0.7);
  --c-green-400-30: rgba(0, 255, 136, 0.3);
  --c-green-400-08: rgba(0, 255, 136, 0.08);

  /* Amber / Yellow */
  --c-amber-500: #f59e0b;
  --c-amber-400: #ffb400;
  --c-amber-500-90: rgba(255, 180, 0, 0.9);
  --c-amber-500-40: rgba(255, 180, 0, 0.4);

  /* Red */
  --c-red-500: #f87171;

  /* Cyan */
  --c-cyan-500: #22d3ee;
  --c-cyan-400: #00d4ff;

  /* Purple */
  --c-purple-500: #a78bfa;

  /* Neutral */
  --c-neutral-950: #0a0a0a;
  --c-neutral-900: #111;
  --c-neutral-850: rgba(8, 8, 8, 0.85);
  --c-neutral-800: #1e1e1e;
  --c-neutral-700: #333;
  --c-neutral-600: #555;
  --c-neutral-500: #777;
  --c-neutral-400: #999;
  --c-neutral-300: #c0c0c0;
  --c-neutral-200: #e0e0e0;
  --c-white-20: rgba(255, 255, 255, 0.2);
  --c-white-15: rgba(255, 255, 255, 0.15);
  --c-overlay: rgba(0, 0, 0, 0.75);

  /* ── Semantic tokens ──────────────────────────────────────────────── */
  --color-bg: var(--c-neutral-950);
  --color-surface: var(--c-neutral-850);
  --color-border: var(--c-neutral-800);
  --color-border-strong: var(--c-neutral-700);
  --color-text: var(--c-neutral-300);
  --color-text-strong: var(--c-neutral-200);
  --color-muted: var(--c-neutral-500);
  --color-dim: var(--c-neutral-600);

  --color-green: var(--c-green-500);
  --color-amber: var(--c-amber-500);
  --color-red: var(--c-red-500);
  --color-cyan: var(--c-cyan-500);
  --color-purple: var(--c-purple-500);

  /* Source marker colors */
  --color-source-nuforc: var(--c-green-400);
  --color-source-hatch: var(--c-cyan-400);
  --color-source-chronology: var(--c-amber-400);

  /* Credibility tier colors */
  --color-cred-high: var(--c-green-500);
  --color-cred-mid: var(--c-amber-500);
  --color-cred-low: var(--c-red-500);

  /* ── Typography ───────────────────────────────────────────────────── */
  --font-mono: 'Menlo', 'Monaco', 'Cascadia Mono', 'Courier New', monospace;
  --radius-sm: 2px;

  --fs-title: 16px;
  --fs-body: 14px;
  --fs-sm: 13px;
  --fs-xs: 12px;
  --fs-xxs: 11px;

  /* ── Spacing ──────────────────────────────────────────────────────── */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;

  /* ── Z-index layers ───────────────────────────────────────────────── */
  --z-base: 1;
  --z-sticky: 10;
  --z-tooltip: 100;
  --z-modal: 1000;
  --z-toast: 1100;
}
`

writeFileSync(resolve(ROOT, 'src/styles/tokens.css'), tokensCSS)
console.log('  ✓ tokens.css')

// ── Write global.css (non-component CSS) ──
let globalCSS = globalParts.join('\n\n')
// Remove the :root variables block since it's now in tokens.css
globalCSS = globalCSS.replace(/\/\* ===== VARIABLES =====.*?(?=\/\* =====|\Z)/s, '')
// Add responsive section
if (responsiveCSS) globalCSS += '\n\n' + responsiveCSS

writeFileSync(resolve(ROOT, 'src/styles/global.css'), globalCSS.trim() + '\n')
console.log('  ✓ global.css')

// ── Write per-component CSS files ──
for (const [dir, content] of componentCSS) {
  const outDir = resolve(ROOT, 'src/components', dir)
  if (!existsSync(outDir)) {
    console.warn(`  ⚠ Dir not found: ${dir}`)
    continue
  }
  const outFile = resolve(outDir, 'styles.css')
  writeFileSync(outFile, content.trim() + '\n')
  console.log(`  ✓ components/${dir}/styles.css`)
}

console.log('\n  Done. Now update imports in each component.\n')
