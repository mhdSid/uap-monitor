#!/usr/bin/env node

/**
 * Boundary tests for the resume-mode latest-id discovery.
 * Usage: node scripts/nuforc-scrapper/test-discovery.mjs
 *
 * Imports the REAL discoverLatestForward from discovery.mjs (not a copy), so a
 * regression in the algorithm fails these tests instead of hiding behind a
 * stale duplicate.
 */

import { discoverLatestForward } from "./discovery.mjs"

let pass = 0
let fail = 0

function assert (label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}`)
    console.log(`    expected: ${e}`)
    console.log(`    actual:   ${a}`)
  }
}

async function assertThrows (label, fn) {
  try {
    await fn()
    fail++
    console.log(`  ✗ ${label} (expected throw, none)`)
  } catch {
    pass++
    console.log(`  ✓ ${label}`)
  }
}

// Build an async existence oracle from a set of ids that "exist".
function probeFrom (existing) {
  const set = new Set(existing)
  return async (id) => set.has(id)
}

// Wrap a probe to record the exact id sequence it was called with.
function recording (probe) {
  const calls = []
  const wrapped = async (id) => { calls.push(id); return probe(id) }
  wrapped.calls = calls
  return wrapped
}

async function main () {
  console.log("\n── discoverLatestForward — boundary tests ──\n")

  // 1. Nothing above the cache → returns the baseline unchanged (never < base).
  assert("nothing new returns base",
    await discoverLatestForward(199767, 100, probeFrom([])), 199767)

  // 2. Contiguous new run → the top of the run.
  assert("contiguous run",
    await discoverLatestForward(100, 5, probeFrom([101, 102, 103, 104, 105])), 105)

  // 3. Hole strictly smaller than window is bridged.
  //    existing {101,105}: holes 102,103,104 = 3 misses < window 5 → reaches 105
  assert("hole < window bridged",
    await discoverLatestForward(100, 5, probeFrom([101, 105])), 105)

  // 4. Hole exactly == window ends the scan (documented, tunable bound).
  //    existing {101,105}: holes 102,103,104 = 3 misses == window 3 → stop at 101
  assert("hole == window stops (undershoot is the contract)",
    await discoverLatestForward(100, 3, probeFrom([101, 105])), 101)

  // 5. Hole of window-1 is the largest that gets bridged.
  assert("hole == window-1 bridged",
    await discoverLatestForward(100, 4, probeFrom([101, 105])), 105)

  // 6. window=1 finds a contiguous run but cannot cross any hole.
  assert("window=1 contiguous",
    await discoverLatestForward(100, 1, probeFrom([101, 102])), 102)
  assert("window=1 cannot cross a 1-hole",
    await discoverLatestForward(100, 1, probeFrom([102])), 100)

  // 7. window < 1 is clamped to 1 (not treated as "stop immediately").
  assert("window=0 clamped to 1 (finds contiguous)",
    await discoverLatestForward(100, 0, probeFrom([101])), 101)
  assert("negative window clamped to 1",
    await discoverLatestForward(100, -5, probeFrom([101, 102])), 102)

  // 8. Runaway guard: a probe that always exists is bounded by maxAbove.
  assert("maxAbove caps a probe that never misses",
    await discoverLatestForward(0, 10, async () => true, { maxAbove: 10 }), 10)

  // 9. from = 0 baseline.
  assert("from=0",
    await discoverLatestForward(0, 5, probeFrom([1, 2, 3])), 3)

  // 10. Non-integer inputs are floored.
  assert("non-integer from floored",
    await discoverLatestForward(100.9, 3, probeFrom([101])), 101)
  assert("non-integer window floored",
    await discoverLatestForward(100, 3.9, probeFrom([101, 104])), 104) // holes 102,103 = 2 < 3

  // 11. Probes exactly the sequential ids it needs, in order, no skips.
  //     existing {101,102}, window 2: probes 101,102,103,104 then stops (2 misses)
  const rec = recording(probeFrom([101, 102]))
  const got = await discoverLatestForward(100, 2, rec)
  assert("sequential probe order", rec.calls, [101, 102, 103, 104])
  assert("sequential probe result", got, 102)

  // 12. Realistic sparse NUFORC-like space above a real cachedMax.
  assert("sparse realistic",
    await discoverLatestForward(199767, 100, probeFrom([199768, 199770, 199775, 199778])),
    199778)

  // 13. Result is never below the baseline even with a miss at base+1.
  assert("result never below base",
    await discoverLatestForward(500, 10, probeFrom([])), 500)

  // 14. A synchronous probe (returns boolean, not a Promise) still works.
  assert("sync probe supported",
    await discoverLatestForward(100, 3, (id) => id === 101 || id === 102), 102)

  // 15. Guards against a large hole are the window's job — proven both ways.
  //     A 421-hole (mirrors the real 198806→199227 gap) is NOT bridged at the
  //     default 100 window ...
  const bigGap = probeFrom([101, 523]) // 102..522 = 421 consecutive misses
  assert("421-hole NOT bridged at window 100",
    await discoverLatestForward(100, 100, bigGap), 101)
  //     ... but IS bridged when the window is widened past it.
  assert("421-hole bridged at window 422",
    await discoverLatestForward(100, 422, bigGap), 523)

  // 16. Invalid probe throws (misuse fails loud, not silent).
  await assertThrows("throws when probe is not a function",
    () => discoverLatestForward(100, 5, null))

  console.log(`\n── Results: ${pass} passed, ${fail} failed ──\n`)
  process.exit(fail > 0 ? 1 : 0)
}

main()
