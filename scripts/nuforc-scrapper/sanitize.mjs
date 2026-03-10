#!/usr/bin/env node

/**
 * Standalone sanitizer for NUFORC JSON output files.
 *
 * Reads a JSON array, sanitizes text fields (strips leaked JS/CSS/HTML
 * from video player embeds), writes back. Creates a hidden backup first.
 *
 * Usage:
 *   node sanitize.mjs __sources/nuforc.json
 *   node sanitize.mjs __sources/nuforc.json --fields text,description,summary
 *   node sanitize.mjs __sources/nuforc.json --dry-run
 *   node sanitize.mjs __sources/nuforc.json --output cleaned.json
 */

import fs from "fs/promises"
import path from "path"
import { Command } from "commander"

const program = new Command()
program
  .name("sanitize")
  .description("Sanitize text fields in a NUFORC JSON file")
  .argument("<file>", "JSON file to sanitize")
  .option("--fields <list>", "Comma-separated field names to sanitize (supports dot notation)", "summary,description,location_details,text,Text")
  .option("--output <file>", "Write to a different file instead of in-place")
  .option("--dry-run", "Show what would change without writing")
  .option("--verbose", "Show each changed record")
  .parse()

const opts = program.opts()
const inputFile = program.args[0]
const fields = opts.fields.split(",").map(f => f.trim())

// ─── Sanitizer ──────────────────────────────────────────────────────────────

function sanitizeText (text) {
  if (!text || typeof text !== "string") return text

  const lines = text.split("\n")
  const cleaned = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { cleaned.push(""); continue }

    // CSS: selector { ... } on one line
    if (/^[.#]?[\w-]+[^{]*\{.*\}\s*$/.test(trimmed) && !/^[A-Z]/.test(trimmed)) continue
    // CSS: @-rules on one line
    if (/^@[\w-]+[\s(].*\{.*\}\s*$/.test(trimmed)) continue
    // CSS: @-rule opening
    if (/^@[\w-]+\s*(?:\([^)]*\))?\s*\{?\s*$/.test(trimmed)) continue
    // CSS: opening selector {
    // eslint-disable-next-line no-useless-escape
    if (/^[.#][\w->+~\s,.:#\[\]='"*]+\{\s*$/.test(trimmed)) continue
    // CSS: closing }
    if (/^\}?\s*\}\s*;?\s*$/.test(trimmed)) continue
    // CSS: property: value;
    if (/^(?:margin|padding|width|height|display|position|overflow|float|clear|color|font(?:-\w+)?|background(?:-\w+)?|border(?:-\w+)?|text-(?:align|decoration|transform|indent|overflow|shadow)|line-height|z-index|opacity|visibility|cursor|content|top|right|bottom|left|max-width|min-width|max-height|min-height|box-sizing|flex(?:-\w+)?|grid(?:-\w+)?|transform|transition|animation|vertical-align|white-space|word-break|list-style|outline|appearance|resize|object-fit|pointer-events|src|fill|stroke)\s*:[^]*;?\s*$/i.test(trimmed)) continue
    // CSS: lone units
    if (/^\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|pt)\s*;?\s*$/.test(trimmed)) continue
    // CSS: bare selector
    if (/^[.#][\w-]+(?:\s*[,>+~]\s*[.#]?[\w-]+)*\s*$/.test(trimmed)) continue

    // JS: declarations
    if (/^\s*(?:var|let|const|function)\s+/.test(trimmed)) continue
    // JS: global objects
    if (/^\s*(?:window|document|console|navigator|self)\./.test(trimmed)) continue
    // JS: method calls
    if (/^\s*\w+\.\w+\s*\(/.test(trimmed)) continue
    // JS: closing braces
    if (/^[}\]);,]+\s*$/.test(trimmed)) continue
    // JS: arrow functions
    if (/^\s*(?:\w+|\([^)]*\))\s*=>\s*/.test(trimmed)) continue
    // JS: control flow
    if (/^\s*(?:if|else|for|while|return|new|typeof|try|catch|throw|switch|case|break|continue)\s*[\s({]/.test(trimmed)) continue
    // JS: style assignments
    if (/\.\s*style\s*\./.test(trimmed)) continue
    // JS: property assignments (vid.src = ..., el.width = 640)
    if (/^\s*\w+\.\w+\s*=\s*.+;?\s*$/.test(trimmed) && !/[.]\s*$/.test(trimmed)) continue
    // JS: DOM methods
    if (/(?:addEventListener|removeEventListener|querySelector|getElementById|getElementsBy|createElement|appendChild|innerHTML|className|classList|setAttribute)\s*[.(]/.test(trimmed)) continue
    // JS: object literal properties (key: "value", key: 640, key: true)
    if (/^\s*[\w$]+\s*:\s*(?:["'][^"']*["']|\d+(?:\.\d+)?|true|false|null|undefined|\[.*\]|\{.*\})\s*,?\s*$/.test(trimmed)) continue

    // Media players
    if (/\b(?:videojs|flowplayer|jwplayer|plyr|hls\.js|dash\.js|wistia|brightcove|MusePlayer|EmbedPlayer|MediaElement|Kaltura|SproutVideo)\b/i.test(trimmed)) continue
    if (/\bplayer\b.*(?:setup|init|ready|play|pause|src|load|dispose|on|off)\s*\(/i.test(trimmed)) continue

    // URLs to assets
    if (/^https?:\/\/\S+\.(?:js|css|mp4|webm|m3u8|woff|ttf|svg)\b/.test(trimmed)) continue
    // Data URIs
    if (/^data:/.test(trimmed)) continue
    // Orphaned HTML attributes
    if (/^(?:class|id|style|data-[\w-]+|aria-[\w-]+)\s*=\s*["']/.test(trimmed)) continue

    cleaned.push(line)
  }

  let result = cleaned.join("\n")
  result = result
    .replace(/\b(?:display|margin|padding|width|height|position|overflow|opacity|visibility|z-index|float|clear)\s*:\s*[^;.!?\n]+;/gi, "")
    .replace(/!important/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "")
    .replace(/(?:window|document|console)\.\w[\w.]*/g, "")
    .replace(/&(?:amp|lt|gt|quot|nbsp|#\d+);/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[{}]/g, "")
    .replace(/^\s*;+\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+$/gm, "")
    .trim()

  if (result.length < 3) return null
  return result
}

// ─── Field access (dot notation) ────────────────────────────────────────────

function getByPath (obj, keyPath) {
  const parts = keyPath.split(".")
  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

function setByPath (obj, keyPath, value) {
  const parts = keyPath.split(".")
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null) return
    current = current[parts[i]]
  }
  current[parts[parts.length - 1]] = value
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main () {
  const raw = await fs.readFile(inputFile, "utf-8")
  const data = JSON.parse(raw)

  if (!Array.isArray(data)) {
    console.error("Error: file must contain a JSON array")
    process.exit(1)
  }

  console.log(`Loaded ${data.length} records from ${inputFile}`)
  console.log(`Sanitizing fields: ${fields.join(", ")}`)

  let changed = 0
  let fieldsChanged = 0

  for (let i = 0; i < data.length; i++) {
    const record = data[i]
    let recordChanged = false

    for (const field of fields) {
      const original = getByPath(record, field)
      if (!original || typeof original !== "string") continue

      const sanitized = sanitizeText(original)

      if (sanitized !== original) {
        if (opts.verbose) {
          const id = record.id || record._sighting_id || record.sighting_id || `#${i}`
          console.log(`  [${id}] ${field}: ${original.length} → ${sanitized ? sanitized.length : 0} chars`)
        }
        setByPath(record, field, sanitized)
        fieldsChanged++
        recordChanged = true
      }
    }

    if (recordChanged) changed++
  }

  console.log(`\nSanitized ${fieldsChanged} fields across ${changed} records (${data.length - changed} unchanged)`)

  if (opts.dryRun) {
    console.log("Dry run — no files written.")
    return
  }

  const outputFile = opts.output || inputFile

  // Backup if writing in-place
  if (!opts.output) {
    const dir = path.dirname(inputFile)
    const ext = path.extname(inputFile)
    const base = path.basename(inputFile, ext)
    const backupPath = path.join(dir, `.${base}${ext}.pre-sanitize`)
    await fs.copyFile(inputFile, backupPath)
    console.log(`Backup: ${backupPath}`)
  }

  await fs.writeFile(outputFile, JSON.stringify(data, null, 2), "utf-8")
  console.log(`✓ Written to ${outputFile}`)
}

main().catch(err => {
  console.error("Error:", err.message)
  process.exit(1)
})
