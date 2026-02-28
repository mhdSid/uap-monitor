#!/usr/bin/env node
/**
 * Replace hardcoded className strings with cx.KEY references in component files.
 * Reads cx.ts to build a reverse lookup, then patches index.ts.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const COMPONENTS = resolve(ROOT, 'src/components')

function parseCx(content) {
  // Parse cx.ts to get class → key mapping
  const map = new Map() // class string → cx key
  const re = /(\w+):\s*'([^']+)'/g
  let m
  while ((m = re.exec(content))) {
    map.set(m[2], m[1])
  }
  return map
}

function replaceClassNames(code, cxMap) {
  let changed = false
  let result = code

  // Pattern 1: className: 'exact-class'
  result = result.replace(
    /className:\s*'([^']+)'/g,
    (full, classes) => {
      // Split on space for multi-class
      const parts = classes.split(/\s+/)
      const resolved = parts.map(cls => {
        const key = cxMap.get(cls)
        return key ? `cx.${key}` : null
      })

      // Only replace if ALL parts resolved
      if (resolved.every(r => r !== null)) {
        changed = true
        if (resolved.length === 1) {
          return `className: ${resolved[0]}`
        }
        return `className: \`\${${resolved.join('} \${')}}\``
      }
      return full
    }
  )

  // Pattern 2: className: `prefix ${condition ? 'a' : 'b'}`
  // These are more complex — replace the individual quoted classes within template literals
  result = result.replace(
    /className:\s*`([^`]+)`/g,
    (full, template) => {
      let newTemplate = template
      let hasChange = false

      // Replace 'class-name' within the template
      newTemplate = newTemplate.replace(
        /(?<![${])([a-z][-a-z0-9_]+(?:__[-a-z0-9_]+)?(?:--[-a-z0-9_]+)?)/g,
        (cls) => {
          const key = cxMap.get(cls)
          if (key) {
            hasChange = true
            return `\${${`cx.${key}`}}`
          }
          return cls
        }
      )

      if (hasChange) {
        changed = true
        return `className: \`${newTemplate}\``
      }
      return full
    }
  )

  return { result, changed }
}

const dirs = readdirSync(COMPONENTS, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

let totalFiles = 0
let totalReplaced = 0

for (const dir of dirs) {
  const cxFile = resolve(COMPONENTS, dir, 'cx.ts')
  const indexFile = resolve(COMPONENTS, dir, 'index.ts')
  if (!existsSync(cxFile) || !existsSync(indexFile)) continue

  const cxContent = readFileSync(cxFile, 'utf8')
  const cxMap = parseCx(cxContent)

  let code = readFileSync(indexFile, 'utf8')

  // Add cx import if not present
  if (!code.includes("from './cx'") && !code.includes('from "./cx"')) {
    // Find first import line and add after styles import
    if (code.includes("import './styles.css'")) {
      code = code.replace("import './styles.css'", "import './styles.css'\nimport { cx } from './cx'")
    } else {
      code = `import { cx } from './cx'\n` + code
    }
  }

  const { result, changed } = replaceClassNames(code, cxMap)

  if (changed) {
    writeFileSync(indexFile, result)
    totalReplaced++
    console.log(`  ✓ ${dir}: replaced classNames with cx references`)
  } else {
    // Still write if we added the import
    if (result !== readFileSync(indexFile, 'utf8')) {
      writeFileSync(indexFile, result)
    }
    console.log(`  · ${dir}: cx import added (no simple replacements)`)
  }
  totalFiles++
}

console.log(`\n  ${totalReplaced}/${totalFiles} files had className replacements.`)
console.log('  Review complex template literals manually.\n')
