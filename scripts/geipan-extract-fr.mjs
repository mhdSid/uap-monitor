#!/usr/bin/env node

/**
 * geipan-extract-fr.mjs
 *
 * Extracts the columns that need translation (id_cas, cas_resume, cas_resume_web)
 * from the GEIPAN CSV into one or more XLSX files small enough for the
 * translate.google.com Documents tab (10 MB / file limit).
 *
 * Workflow:
 *   1. Run this script → produces __sources/geipan-fr.xlsx (or split into
 *      geipan-fr-1.xlsx, geipan-fr-2.xlsx if --chunk-rows is set).
 *   2. Upload each XLSX to https://translate.google.com → Documents tab →
 *      French → English. Download the translated XLSX back.
 *   3. Place translated file(s) in __sources/ named e.g. geipan-en.xlsx
 *      (or geipan-en-1.xlsx, geipan-en-2.xlsx).
 *   4. Run `yarn process:data:pipeline:geipan:from-xlsx` to merge translations
 *      and produce the per-year JSON chunks.
 *
 * Usage:
 *   node scripts/geipan-extract-fr.mjs                       # one file
 *   node scripts/geipan-extract-fr.mjs --chunk-rows 1000     # split into chunks
 *   node scripts/geipan-extract-fr.mjs --limit 50            # first 50 rows (test)
 *   node scripts/geipan-extract-fr.mjs --csv /path/to/in.csv # custom input
 */

import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DEFAULT_CSV = resolve(ROOT, '__sources/geipan.csv')
const SOURCES_DIR = resolve(ROOT, '__sources')
const DEFAULT_OUT = resolve(SOURCES_DIR, 'geipan-fr.xlsx')

// ─── French accent recovery ──────────────────────────────────────────
// The GEIPAN CSV has corrupted accents — every "é/è/ê/à/ô/ç/etc." was
// replaced with U+FFFD ("�") during a bad encoding conversion before
// the file reached us. The original bytes are gone, but we can make
// educated guesses since most French accents fall on "e" (é/è/ê are ~80%+
// of accent occurrences).
//
// Strategy applied in order:
//   1. Curated dictionary for the most common GEIPAN-corpus French words.
//   2. Standalone " � " (single char between spaces) → " à " (the
//      preposition; appears constantly in dates/times: " � 18h").
//   3. Remaining "�" between letters → "e" (best statistical guess).
//
// The raw FR with "�" intact is preserved unchanged in ref_fr.cas_resume
// in the final JSON output, so the audit trail is not lost.

const ACCENT_DICT = {
  // témoin family
  't�moin': 'témoin', 't�moins': 'témoins',
  't�moignage': 'témoignage', 't�moignages': 'témoignages',
  'T�moignage': 'Témoignage', 'T�moignages': 'Témoignages',
  't�moigne': 'témoigne', 't�moignent': 'témoignent',
  // phénomène
  'ph�nom�ne': 'phénomène', 'ph�nom�nes': 'phénomènes',
  // récent / région / réunion family
  'r�cent': 'récent', 'r�cente': 'récente', 'r�cents': 'récents', 'r�centes': 'récentes',
  'r�gion': 'région', 'r�gions': 'régions',
  'r�union': 'réunion', 'R�union': 'Réunion',
  'r�li�es': 'reliées', 'r�li�': 'relié',
  'r�alis�': 'réalisé', 'r�alis�e': 'réalisée',
  // précis / précisions
  'pr�cis': 'précis', 'pr�cise': 'précise', 'pr�cises': 'précises',
  'pr�cision': 'précision', 'pr�cisions': 'précisions',
  'pr�s': 'près',
  'pr�sent': 'présent', 'pr�sente': 'présente',
  // déplacement / déplace / décide / décrit / début
  'd�placement': 'déplacement', 'd�placements': 'déplacements',
  'd�place': 'déplace', 'd�plac�': 'déplacé', 'd�plac�e': 'déplacée',
  'd�crit': 'décrit', 'd�crite': 'décrite',
  'd�bute': 'débute', 'd�but': 'début',
  'd�cide': 'décide', 'd�cident': 'décident',
  'd�couvre': 'découvre', 'd�couvrent': 'découvrent',
  'd�taill�': 'détaillé', 'd�tail': 'détail', 'd�tails': 'détails',
  'd�clare': 'déclare', 'd�clarent': 'déclarent',
  'd�j�': 'déjà',
  'd�s': 'dès',
  // éclair*
  '�clair�': 'éclairé', '�clair�e': 'éclairée',
  '�clair': 'éclair',
  '�clat': 'éclat',
  // très / après / aussi
  'tr�s': 'très',
  'apr�s': 'après',
  // été
  '�t�': 'été',
  // observé
  'observ�': 'observé', 'observ�e': 'observée', 'observ�es': 'observées',
  // donné
  'donn�': 'donné', 'donn�e': 'donnée', 'donn�es': 'données',
  // accolé / situé / signalé
  'accol�': 'accolé', 'accol�es': 'accolées', 'accol�s': 'accolés',
  'situ�': 'situé', 'situ�e': 'située',
  'signal�': 'signalé', 'signal�e': 'signalée',
  // dur
  'dur�': 'duré', 'dur�e': 'durée',
  // arriv / parti
  'arriv�': 'arrivé', 'arriv�e': 'arrivée',
  'parti�': 'partie',
  // caract
  'caract�ris�': 'caractérisé', 'caract�ris�e': 'caractérisée',
  // trajectoire / vérifier
  'v�rifier': 'vérifier', 'v�rifi�': 'vérifié',
  // météo / météorologique
  'm�t�o': 'météo', 'M�t�o': 'Météo',
  'm�t�orologique': 'météorologique', 'm�t�orologiques': 'météorologiques',
  'm�t�ore': 'météore', 'm�t�ores': 'météores',
  'm�t�orite': 'météorite', 'm�t�orites': 'météorites',
  'M�t�ociel': 'Météociel', 'M�t�ociel.': 'Météociel.',
  // common non-e patterns
  'Tha�landaise': 'Thaïlandaise', 'Tha�landaises': 'Thaïlandaises',
  'tha�landaise': 'thaïlandaise', 'tha�landaises': 'thaïlandaises',
  'na�f': 'naïf', 'na�ve': 'naïve',
  'h�tel': 'hôtel',
  'c�t�': 'côté', 'c�t�s': 'côtés',
  't�t': 'tôt',
  'b�timent': 'bâtiment', 'b�timents': 'bâtiments',
  'cha�ne': 'chaîne', 'cha�nes': 'chaînes',
  'tra�n�e': 'traînée', 'tra�n�es': 'traînées',
  // place / agency names
  'Finist�re': 'Finistère',
  'Pyr�n�es': 'Pyrénées',
  'Mers-el-K�bir': 'Mers-el-Kébir',
  'P�rim�tre': 'Périmètre',
  'Cl�ment': 'Clément'
}

function recoverFrenchAccents (text) {
  if (!text || !text.includes('�')) return { text, recovered: 0, fallbackE: 0 }
  let recovered = 0
  let result = text

  // 1. Curated dictionary pass — exact word matches
  for (const [bad, good] of Object.entries(ACCENT_DICT)) {
    if (result.includes(bad)) {
      const before = result
      result = result.split(bad).join(good)
      // Count occurrences replaced
      const diff = (before.match(new RegExp(escapeRegExp(bad), 'g')) || []).length
      recovered += diff
    }
  }

  // 2. Standalone " � " → " à " (preposition; common in "à 18h", "à l'horizon", etc.)
  const standaloneCount = (result.match(/(^|\s)�(\s)/g) || []).length
  result = result.replace(/(^|\s)�(\s)/g, '$1à$2')
  recovered += standaloneCount

  // 3. Fallback: any "�" still surrounded by letters → "e" (covers é/è/ê,
  // which together account for the vast majority of French accent residue)
  const fallbackCount = (result.match(/�/g) || []).length
  result = result.split('�').join('e')

  return { text: result, recovered, fallbackE: fallbackCount }
}

function escapeRegExp (s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── CSV parser (same one as process-geipan.mjs) ────────────────────

function parseCSV (text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++
    } else {
      if (c === '"') { inQuotes = true; i++; continue }
      if (c === ';') { row.push(field); field = ''; i++; continue }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
      if (c === '\r') { i++; continue }
      field += c; i++
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ─── CLI ─────────────────────────────────────────────────────────────

function parseArgs (argv) {
  const args = { csv: DEFAULT_CSV, out: DEFAULT_OUT, limit: null, chunkRows: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--csv') args.csv = resolve(argv[++i])
    else if (a === '--out') args.out = resolve(argv[++i])
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10)
    else if (a === '--chunk-rows') args.chunkRows = parseInt(argv[++i], 10)
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/geipan-extract-fr.mjs [options]

Options:
  --csv <path>          GEIPAN CSV (default: ${DEFAULT_CSV})
  --out <path>          Output XLSX (default: ${DEFAULT_OUT})
                        With --chunk-rows, files are suffixed -1, -2, ...
  --chunk-rows <n>      Split into chunks of N rows (no default)
  --limit <n>           Only the first N data rows (for testing)
  --help, -h            Show this help`)
      process.exit(0)
    }
  }
  return args
}

// ─── XLSX writer ─────────────────────────────────────────────────────

async function writeXlsx (outPath, rows) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'uap-monitor:geipan-extract-fr'
  wb.created = new Date()

  const ws = wb.addWorksheet('GEIPAN', {
    properties: { defaultRowHeight: 14 }
  })

  // Header row
  ws.addRow(['id_cas', 'cas_resume', 'cas_resume_web'])
  ws.getRow(1).font = { bold: true }

  // Data rows
  for (const r of rows) {
    ws.addRow([r.id_cas, r.cas_resume, r.cas_resume_web])
  }

  // Column widths for readability if the user opens the file locally
  ws.getColumn(1).width = 10
  ws.getColumn(2).width = 80
  ws.getColumn(3).width = 60

  mkdirSync(dirname(outPath), { recursive: true })
  await wb.xlsx.writeFile(outPath)
}

// ─── Main ────────────────────────────────────────────────────────────

async function main () {
  const args = parseArgs(process.argv)

  console.log(`  Reading ${args.csv}`)
  if (!existsSync(args.csv)) {
    console.error(`  ✗ File not found: ${args.csv}`)
    process.exit(1)
  }

  const text = readFileSync(args.csv, 'utf-8')
  const rows = parseCSV(text)
  const header = rows[0]
  const dataRows = rows.slice(1).filter(r => r.length > 1)

  const idx = Object.fromEntries(header.map((h, i) => [h, i]))
  for (const col of ['id_cas', 'cas_resume', 'cas_resume_web']) {
    if (idx[col] === undefined) {
      console.error(`  ✗ Column not found in CSV: ${col}`)
      process.exit(1)
    }
  }

  const sampled = args.limit ? dataRows.slice(0, args.limit) : dataRows
  console.log(`  Source rows: ${sampled.length}${args.limit ? ` (limited from ${dataRows.length})` : ''}`)

  // Pre-process: clean French text before XLSX export.
  //  - <br> → \n\n so paragraph structure survives translation (Google
  //    strips literal <br> from XLSX cells during Documents translation,
  //    but preserves embedded newlines).
  //  - Recover accents from "�" so Google translates real French words.
  let totalRecovered = 0
  let totalFallback = 0
  const extracted = sampled.map(r => {
    const id_cas = r[idx.id_cas]
    const rawResume = r[idx.cas_resume] ?? ''
    const rawWeb = r[idx.cas_resume_web] ?? ''
    const cleanedResume = rawResume.replace(/<br>/gi, '\n\n')
    const cleanedWeb = rawWeb.replace(/<br>/gi, '\n\n')
    const a = recoverFrenchAccents(cleanedResume)
    const b = recoverFrenchAccents(cleanedWeb)
    totalRecovered += a.recovered + b.recovered
    totalFallback += a.fallbackE + b.fallbackE
    return {
      id_cas,
      cas_resume: a.text,
      cas_resume_web: b.text
    }
  })

  // Diagnostics
  const totalChars = extracted.reduce((a, r) => a + r.cas_resume.length + r.cas_resume_web.length, 0)
  const longest = extracted.reduce((m, r) => Math.max(m, r.cas_resume.length, r.cas_resume_web.length), 0)
  console.log(`  Text payload: ${(totalChars / 1024 / 1024).toFixed(2)} MB across ${extracted.length} cases`)
  console.log(`  Longest single cell: ${longest.toLocaleString()} chars`)
  console.log(`  Accent recovery: ${totalRecovered.toLocaleString()} restored via dictionary, ${totalFallback.toLocaleString()} fell back to "e"`)

  // Write
  if (!args.chunkRows) {
    await writeXlsx(args.out, extracted)
    console.log(`  ✓ Wrote ${args.out}`)
  } else {
    const baseDir = dirname(args.out)
    const baseName = args.out.split('/').pop().replace(/\.xlsx$/i, '')
    let written = 0
    for (let i = 0; i < extracted.length; i += args.chunkRows) {
      written++
      const chunk = extracted.slice(i, i + args.chunkRows)
      const chunkPath = resolve(baseDir, `${baseName}-${written}.xlsx`)
      await writeXlsx(chunkPath, chunk)
      console.log(`  ✓ Wrote ${chunkPath} (${chunk.length} rows)`)
    }
    console.log(`\n  → ${written} chunk file(s) total`)
  }

  console.log()
  console.log('  Next steps:')
  console.log('    1. Upload the file(s) to https://translate.google.com → Documents → French → English')
  console.log('    2. Download the translated XLSX(s) and place them in __sources/')
  console.log('       (e.g. __sources/geipan-en.xlsx, or geipan-en-1.xlsx, geipan-en-2.xlsx ...)')
  console.log('    3. Run: yarn process:data:pipeline:geipan:from-xlsx')
}

main().catch(err => { console.error(err); process.exit(1) })
