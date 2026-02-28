#!/usr/bin/env node
/**
 * Generate cx (class-name constants) for each component from its styles.css.
 * Outputs a TypeScript const object per component.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const COMPONENTS = resolve(ROOT, 'src/components')

function toCamelCase(str) {
  // .map-popup__date--active → mapPopupDateActive
  return str
    .replace(/^\./, '')
    .replace(/--/g, '-')
    .replace(/__/g, '-')
    .replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function extractClasses(css) {
  const classes = new Set()
  const re = /\.([-a-zA-Z_][-a-zA-Z0-9_]*)/g
  let m
  while ((m = re.exec(css))) {
    const cls = m[1]
    // Skip pseudo-classes and known framework classes
    if (cls.startsWith('leaflet-') || cls === 'modal-open') continue
    classes.add(cls)
  }
  return [...classes].sort()
}

function findPrefix(classes) {
  if (classes.length === 0) return ''
  const first = classes[0]
  const prefix = first.split('__')[0].split('--')[0]
  // Check if most classes share this prefix
  const matching = classes.filter(c => c.startsWith(prefix))
  return matching.length > classes.length * 0.5 ? prefix : ''
}

const dirs = readdirSync(COMPONENTS, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

for (const dir of dirs) {
  const cssFile = resolve(COMPONENTS, dir, 'styles.css')
  if (!existsSync(cssFile)) continue

  const css = readFileSync(cssFile, 'utf8')
  const classes = extractClasses(css)
  if (classes.length === 0) continue

  const prefix = findPrefix(classes)

  // Generate keys
  const entries = classes.map(cls => {
    let key = cls
    if (prefix && cls.startsWith(prefix)) {
      key = cls.slice(prefix.length).replace(/^[-_]+/, '')
      if (!key) key = 'root'
    }
    key = toCamelCase(key) || 'root'
    // Avoid JS reserved words
    if (key === 'default') key = 'defaultState'
    return [key, cls]
  })

  console.log(`\n// ── ${dir} ──`)
  console.log(`export const cx = {`)
  for (const [key, cls] of entries) {
    console.log(`  ${key}: '${cls}',`)
  }
  console.log(`} as const`)
}
