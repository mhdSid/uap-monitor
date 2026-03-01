#!/usr/bin/env node

/**
 * Test the schema transform system with all directives.
 * Usage: node scripts/scrapper/test-transforms.mjs
 */

// ─── Copy of transform functions (imported inline for standalone test) ──────

function resolveMapping(raw, mappingStr) {
  mappingStr = mappingStr.trim()

  if (mappingStr.startsWith("$literal:")) {
    return mappingStr.slice(9)
  }

  const directiveMatch = mappingStr.match(/^\$(\w+)(?:\(([^)]*)\))?:(.+)$/)
  if (directiveMatch) {
    const [, directive, arg, rest] = directiveMatch
    const value = resolveMapping(raw, rest)
    return applyDirective(directive, arg || null, value)
  }

  if (mappingStr.includes("||")) {
    const fields = mappingStr.split("||").map((s) => s.trim())
    for (const f of fields) {
      const val = resolveMapping(raw, f)
      if (val !== null && val !== undefined && val !== "") return val
    }
    return null
  }

  if (mappingStr.includes("|")) {
    const [field, defaultVal] = mappingStr.split("|").map((s) => s.trim())
    const val = raw[field]
    return val !== null && val !== undefined && val !== "" ? val : defaultVal
  }

  return raw[mappingStr] ?? null
}

function applyDirective(name, arg, value) {
  switch (name) {
    case "int": {
      if (value === null || value === undefined) return 0
      const n = parseInt(value, 10)
      return isNaN(n) ? 0 : n
    }
    case "float": {
      if (value === null || value === undefined) return 0
      const f = parseFloat(value)
      return isNaN(f) ? 0 : f
    }
    case "bool":
      return !!value
    case "split":
      return splitValue(value, arg || ",")
    case "array":
      if (Array.isArray(value)) return value
      if (value === null || value === undefined) return []
      return [value]
    case "date":
      return normalizeDate(value, arg)
    case "upper":
      return value != null ? String(value).toUpperCase() : null
    case "lower":
      return value != null ? String(value).toLowerCase() : null
    case "trim":
      return value != null ? String(value).trim() : null
    default:
      return value
  }
}

function splitValue(value, delimiter) {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value
  return String(value).split(delimiter).map((s) => s.trim()).filter(Boolean)
}

function normalizeDate(value, suffix) {
  if (!value || typeof value !== "string") return null

  let normalized = value.trim()
  normalized = normalized.replace(/\s*(Local|Pacific|Eastern|Central|Mountain|UTC)\s*$/i, "").trim()

  const usMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (usMatch) {
    const [, mo, dd, yyyy, hh, mm, ss] = usMatch
    normalized = `${yyyy}-${mo.padStart(2, "0")}-${dd.padStart(2, "0")} ${(hh || "00").padStart(2, "0")}:${mm || "00"}:${ss || "00"}`
  }

  const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/)
  if (isoMatch) {
    const datePart = isoMatch[1]
    let timePart = isoMatch[2] || "00:00:00"
    if (timePart.length === 5) timePart += ":00"
    if (/^\d:/.test(timePart)) timePart = "0" + timePart
    normalized = `${datePart} ${timePart}`
  }

  return suffix ? `${normalized} ${suffix}` : normalized
}

function transformRecord(raw, schema) {
  if (typeof schema === "string") return resolveMapping(raw, schema)
  if (Array.isArray(schema)) return schema.map((item) => transformRecord(raw, item))
  if (typeof schema === "object" && schema !== null) {
    const result = {}
    for (const [key, mapping] of Object.entries(schema)) {
      result[key] = transformRecord(raw, mapping)
    }
    return result
  }
  return schema
}

// ─── Test ───────────────────────────────────────────────────────────────────

const mockRaw = {
  _sighting_id: 185432,
  _source_url: "https://nuforc.org/sighting/?id=185432",
  _scraped_at: "2026-02-28T10:00:00Z",
  occurred: "02/14/2026 21:40",
  reported: "2026-02-15 09:30",
  posted: "2026-02-20",
  duration: "2 minutes",
  num_observers: "3",
  location: "Portland, OR, USA",
  _city: "Portland",
  _state: "OR",
  _country: "USA",
  shape: "Triangle",
  color: "Orange",
  estimated_size: "Large",
  characteristics: "Lights on object, Changed Color, Aura or haze around object",
  summary: "Triangle craft with orange lights hovering silently",
  description: "We observed a large triangular craft with steady orange lights..."
}

let pass = 0
let fail = 0

function assert(label, actual, expected) {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr === expectedStr) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}`)
    console.log(`    expected: ${expectedStr}`)
    console.log(`    actual:   ${actualStr}`)
  }
}

console.log("\n── Schema Transform Tests ──\n")

// Direct mapping
assert("direct field", resolveMapping(mockRaw, "shape"), "Triangle")
assert("missing field", resolveMapping(mockRaw, "nonexistent"), null)

// Default
assert("default (has value)", resolveMapping(mockRaw, "shape | Unknown"), "Triangle")
assert("default (null)", resolveMapping(mockRaw, "nonexistent | Fallback"), "Fallback")

// Fallback chain
assert("fallback (first exists)", resolveMapping(mockRaw, "summary || description"), "Triangle craft with orange lights hovering silently")
assert("fallback (first null)", resolveMapping(mockRaw, "nonexistent || shape"), "Triangle")

// Literal
assert("literal", resolveMapping(mockRaw, "$literal:NUFORC"), "NUFORC")

// $int
assert("$int from string", resolveMapping(mockRaw, "$int:num_observers"), 3)
assert("$int from null", resolveMapping(mockRaw, "$int:nonexistent"), 0)
assert("$int from number", resolveMapping({ n: 42 }, "$int:n"), 42)

// $float
assert("$float", resolveMapping({ f: "3.14" }, "$float:f"), 3.14)

// $bool
assert("$bool truthy", resolveMapping(mockRaw, "$bool:shape"), true)
assert("$bool falsy", resolveMapping(mockRaw, "$bool:nonexistent"), false)

// $split
assert("$split comma",
  resolveMapping(mockRaw, "$split:characteristics"),
  ["Lights on object", "Changed Color", "Aura or haze around object"]
)
assert("$split null", resolveMapping(mockRaw, "$split:nonexistent"), [])
assert("$split(;) custom",
  resolveMapping({ x: "a;b;c" }, "$split(;):x"),
  ["a", "b", "c"]
)

// $array
assert("$array from string", resolveMapping(mockRaw, "$array:shape"), ["Triangle"])
assert("$array from null", resolveMapping(mockRaw, "$array:nonexistent"), [])
assert("$array from array",
  resolveMapping({ arr: ["a", "b"] }, "$array:arr"),
  ["a", "b"]
)

// $date
assert("$date US format",
  resolveMapping(mockRaw, "$date:occurred"),
  "2026-02-14 21:40:00"
)
assert("$date(Local)",
  resolveMapping(mockRaw, "$date(Local):occurred"),
  "2026-02-14 21:40:00 Local"
)
assert("$date(Pacific) ISO",
  resolveMapping(mockRaw, "$date(Pacific):reported"),
  "2026-02-15 09:30:00 Pacific"
)
assert("$date bare date",
  resolveMapping(mockRaw, "$date:posted"),
  "2026-02-20 00:00:00"
)
assert("$date null", resolveMapping(mockRaw, "$date:nonexistent"), null)

// $upper / $lower / $trim
assert("$upper", resolveMapping(mockRaw, "$upper:shape"), "TRIANGLE")
assert("$lower", resolveMapping(mockRaw, "$lower:shape"), "triangle")
assert("$trim", resolveMapping({ s: "  hello  " }, "$trim:s"), "hello")

// Directive + default: "$int:field | 0" (field via fallback then directive)
// The directive resolves the inner field first
assert("$int with existing field", resolveMapping(mockRaw, "$int:num_observers"), 3)

// Full HuggingFace schema test
console.log("\n── HuggingFace Schema ──\n")

const hfSchema = {
  "Sighting": "$int:_sighting_id",
  "Occurred": "$date(Local):occurred",
  "Location": "location",
  "Shape": "shape",
  "Duration": "duration",
  "No of observers": "$int:num_observers",
  "Reported": "$date(Pacific):reported",
  "Posted": "$date:posted",
  "Characteristics": "$split:characteristics",
  "Summary": "summary",
  "Text": "description"
}

const result = transformRecord(mockRaw, hfSchema)

assert("HF Sighting (int)", result.Sighting, 185432)
assert("HF Occurred (date Local)", result.Occurred, "2026-02-14 21:40:00 Local")
assert("HF Location (string)", result.Location, "Portland, OR, USA")
assert("HF Shape (string)", result.Shape, "Triangle")
assert("HF No of observers (int)", result["No of observers"], 3)
assert("HF Reported (date Pacific)", result.Reported, "2026-02-15 09:30:00 Pacific")
assert("HF Posted (date)", result.Posted, "2026-02-20 00:00:00")
assert("HF Characteristics (array)",
  result.Characteristics,
  ["Lights on object", "Changed Color", "Aura or haze around object"]
)
assert("HF Summary", result.Summary, "Triangle craft with orange lights hovering silently")
assert("HF Text", result.Text, "We observed a large triangular craft with steady orange lights...")

console.log(`\n── Results: ${pass} passed, ${fail} failed ──\n`)
process.exit(fail > 0 ? 1 : 0)
