#!/usr/bin/env node
/**
 * Write cx.ts class-name constant files into each component directory.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const COMPONENTS = resolve(ROOT, 'src/components')

function toCamelCase(str) {
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
    if (cls.startsWith('leaflet-') || cls === 'modal-open' || cls.startsWith('btn__')) continue
    classes.add(cls)
  }
  return [...classes].sort()
}

function findPrefix(classes) {
  if (classes.length === 0) return ''
  const first = classes[0]
  const prefix = first.split('__')[0].split('--')[0]
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

  const entries = classes.map(cls => {
    let key = cls
    if (prefix && cls.startsWith(prefix)) {
      key = cls.slice(prefix.length).replace(/^[-_]+/, '')
      if (!key) key = 'root'
    }
    key = toCamelCase(key) || 'root'
    if (key === 'default') key = 'defaultState'
    return [key, cls]
  })

  // Deduplicate keys
  const seen = new Map()
  for (const [key, cls] of entries) {
    if (seen.has(key)) {
      // Append a suffix
      seen.set(key + '2', cls)
    } else {
      seen.set(key, cls)
    }
  }

  let output = `/** Class name constants for ${dir}. Auto-generated — edit styles.css, re-run gen. */\nexport const cx = {\n`
  for (const [key, cls] of seen) {
    output += `  ${key}: '${cls}',\n`
  }
  output += `} as const\n`

  writeFileSync(resolve(COMPONENTS, dir, 'cx.ts'), output)
  console.log(`  ✓ ${dir}/cx.ts (${seen.size} classes)`)
}
