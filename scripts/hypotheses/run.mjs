#!/usr/bin/env node

/**
 * Hypothesis Runner — test statistical hypotheses against UAP Monitor datasets
 *
 * Loads sighting, geomagnetic, seismic, fireball, and nuclear data from
 * public/data/ and runs each hypothesis defined in HYPOTHESES against them.
 *
 * Each hypothesis is a self-contained test function that receives a shared
 * data context and returns structured results: effect size, p-value proxy,
 * sample counts, and a human-readable summary.
 *
 * Usage:
 *   node scripts/hypotheses/run.mjs [--data-dir public/data] [--out results/hypotheses.json] [--verbose]
 *
 * Adding a hypothesis:
 *   Push a { id, name, description, datasets, test } object to HYPOTHESES.
 *   `datasets` declares which data the hypothesis needs (the runner skips
 *   hypotheses whose data isn't available).
 *   `test(ctx)` receives the loaded data and returns a HypothesisResult.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')

// ─── CLI ────────────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const opts = {
    dataDir: resolve(PROJECT_ROOT, 'public/data'),
    out: resolve(PROJECT_ROOT, 'results/hypotheses.json'),
    verbose: false
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data-dir') opts.dataDir = resolve(args[++i] || '')
    if (args[i] === '--out') opts.out = resolve(args[++i] || '')
    if (args[i] === '--verbose') opts.verbose = true
  }
  return opts
}

// ─── Data loaders ───────────────────────────────────────────────────

function loadJson (filepath) {
  if (!existsSync(filepath)) return null
  try {
    return JSON.parse(readFileSync(filepath, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Load a JSON file that might be a chunked index.
 * If { __chunked: true, files: [...] }, reassemble from chunk files.
 */
function loadJsonChunked (filepath) {
  const data = loadJson(filepath)
  if (!data) return null

  if (data.__chunked === true && Array.isArray(data.files)) {
    const dir = dirname(filepath)
    const merged = []
    for (const chunkFile of data.files) {
      const chunk = loadJson(join(dir, chunkFile))
      if (Array.isArray(chunk)) merged.push(...chunk)
    }
    // If the index has a field name, the chunks belong to that field
    if (data.field && data.envelope) {
      return { ...data.envelope, [data.field]: merged }
    }
    return merged
  }

  return data
}

function loadSightings (dataDir) {
  const sightings = []
  const seen = new Set()

  function addChunk (filepath) {
    const chunk = loadJsonChunked(filepath)
    const arr = Array.isArray(chunk) ? chunk : []
    for (const s of arr) {
      if (s.id && !seen.has(s.id)) { seen.add(s.id); sightings.push(s) }
    }
  }

  // NUFORC year files
  const nuforc = loadJson(join(dataDir, 'nuforc-manifest.json'))
  if (nuforc?.years) {
    for (const meta of Object.values(nuforc.years)) {
      addChunk(join(dataDir, meta.file))
    }
  }

  // Hatch UDB year files
  const hatch = loadJson(join(dataDir, 'hatch-manifest.json'))
  if (hatch?.years) {
    for (const meta of Object.values(hatch.years)) {
      addChunk(join(dataDir, meta.file))
    }
  }

  // Chronology year files
  const chrono = loadJson(join(dataDir, 'chronology-manifest.json'))
  if (chrono?.years) {
    for (const meta of Object.values(chrono.years)) {
      addChunk(join(dataDir, meta.file))
    }
  }

  // Russian historical — envelope: { sightings: [...] }
  const russian = loadJsonChunked(join(dataDir, 'russian-historical.json'))
  const russianSightings = russian?.sightings ?? (Array.isArray(russian) ? russian : [])
  for (const s of russianSightings) {
    if (s.id && !seen.has(s.id)) { seen.add(s.id); sightings.push(s) }
  }

  return sightings
}

function loadGeomagnetic (dataDir) {
  const data = loadJson(join(dataDir, 'geomagnetic-kp.json'))
  return data?.data ?? null
}

function loadEarthquakes (dataDir) {
  const manifest = loadJson(join(dataDir, 'earthquakes-manifest.json'))
  if (!manifest?.years) return null

  const quakes = []
  for (const meta of Object.values(manifest.years)) {
    const chunk = loadJsonChunked(join(dataDir, meta.file))
    if (Array.isArray(chunk)) quakes.push(...chunk)
  }
  return quakes
}

function loadFireballs (dataDir) {
  const data = loadJsonChunked(join(dataDir, 'nasa-fireballs.json'))
  return data?.fireballs ?? null
}

function loadNuclear (dataDir) {
  const data = loadJsonChunked(join(dataDir, 'nuclear-facilities.json'))
  return data?.facilities ?? null
}

// ─── Shared utilities ───────────────────────────────────────────────

function toDateStr (iso) {
  return (iso || '').slice(0, 10)
}

function haversineKm (lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function chiSquared (observed, expected) {
  let chi2 = 0
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] === 0) continue
    chi2 += (observed[i] - expected[i]) ** 2 / expected[i]
  }
  return chi2
}

function mean (arr) {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stddev (arr) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1))
}

// ─── Hypotheses ─────────────────────────────────────────────────────

const HYPOTHESES = [

  // ── H1: Geomagnetic storm overrepresentation ────────────────────
  {
    id: 'geomagnetic-overrep',
    name: 'UAP sighting rate differs on geomagnetic storm days vs calm days',
    description: 'Compare mean daily sighting count on storm days (Kp ≥ 5) vs calm days. A ratio > 1.0 means more sightings on storm days; < 1.0 could indicate weather-correlated suppression (storms often coincide with cloud cover). Stratified by era to control for secular reporting trends.',
    datasets: ['sightings', 'geomagnetic'],

    test (ctx) {
      const { sightings, geomagnetic } = ctx

      // Build Kp lookup: date → max Kp that day
      const kpByDate = new Map()
      for (const day of geomagnetic) {
        const maxKp = Math.max(...day.kp.filter(v => v !== null))
        if (maxKp > -Infinity) kpByDate.set(day.date, maxKp)
      }

      const KP_THRESHOLD = 5

      // Count sightings per date
      const sightingCountByDate = new Map()
      const geoStart = geomagnetic[0]?.date
      const geoEnd = geomagnetic[geomagnetic.length - 1]?.date
      for (const s of sightings) {
        const d = toDateStr(s.occurredAt)
        if (d >= geoStart && d <= geoEnd) {
          sightingCountByDate.set(d, (sightingCountByDate.get(d) || 0) + 1)
        }
      }

      // Only analyze dates that have at least one sighting anywhere in the dataset
      // This controls for the "no reports before modern era" problem
      const stormDayCounts = []
      const calmDayCounts = []

      for (const [date, kp] of kpByDate.entries()) {
        const count = sightingCountByDate.get(date) || 0
        if (kp >= KP_THRESHOLD) stormDayCounts.push(count)
        else calmDayCounts.push(count)
      }

      const meanStorm = mean(stormDayCounts)
      const meanCalm = mean(calmDayCounts)
      const ratio = meanCalm > 0 ? meanStorm / meanCalm : 0

      // Cohen's d
      const pooledStd = Math.sqrt(
        ((stormDayCounts.length - 1) * stddev(stormDayCounts) ** 2 +
         (calmDayCounts.length - 1) * stddev(calmDayCounts) ** 2) /
        (stormDayCounts.length + calmDayCounts.length - 2)
      )
      const cohensD = pooledStd > 0 ? (meanStorm - meanCalm) / pooledStd : 0

      // Era-stratified analysis (modern era where reporting is consistent)
      const ERAS = [
        { label: '1990-2005', from: '1990', to: '2005' },
        { label: '2006-2015', from: '2006', to: '2015' },
        { label: '2016-2026', from: '2016', to: '2026' }
      ]

      const byEra = ERAS.map(era => {
        const eraStorm = []
        const eraCalm = []
        for (const [date, kp] of kpByDate.entries()) {
          if (date < era.from || date > era.to + '-12-31') continue
          const count = sightingCountByDate.get(date) || 0
          if (kp >= KP_THRESHOLD) eraStorm.push(count)
          else eraCalm.push(count)
        }
        const ms = mean(eraStorm)
        const mc = mean(eraCalm)
        return {
          era: era.label,
          stormDays: eraStorm.length,
          calmDays: eraCalm.length,
          meanStorm: +ms.toFixed(2),
          meanCalm: +mc.toFixed(2),
          ratio: mc > 0 ? +(ms / mc).toFixed(2) : 0
        }
      })

      return {
        supported: meanStorm > meanCalm,
        effectSize: +cohensD.toFixed(3),
        samples: {
          stormDays: stormDayCounts.length,
          calmDays: calmDayCounts.length,
          meanSightingsOnStormDays: +meanStorm.toFixed(2),
          meanSightingsOnCalmDays: +meanCalm.toFixed(2),
          ratio: +ratio.toFixed(2),
          byEra
        },
        summary: `Mean daily sightings: storm days ${meanStorm.toFixed(2)} vs calm days ${meanCalm.toFixed(2)} (ratio: ${ratio.toFixed(2)}x). Cohen's d = ${cohensD.toFixed(3)}. Era breakdown: ${byEra.map(e => `${e.era}: ${e.ratio}x`).join(', ')}.`
      }
    }
  },

  // ── H2: Kp band distribution ────────────────────────────────────
  {
    id: 'geomagnetic-kp-bands',
    name: 'UAP sighting distribution across Kp bands deviates from uniform expectation',
    description: 'Bin sightings by the max Kp on their date into bands (0-1, 1-2, ..., 8-9) and compare the observed distribution to the expected distribution based on how many days fall in each band.',
    datasets: ['sightings', 'geomagnetic'],

    test (ctx) {
      const { sightings, geomagnetic } = ctx
      const BANDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

      // Kp lookup
      const kpByDate = new Map()
      for (const day of geomagnetic) {
        const maxKp = Math.max(...day.kp.filter(v => v !== null))
        if (maxKp > -Infinity) kpByDate.set(day.date, maxKp)
      }

      // Count days per band
      const daysByBand = new Array(BANDS.length).fill(0)
      for (const kp of kpByDate.values()) {
        const bin = Math.min(Math.floor(kp), BANDS.length - 1)
        daysByBand[bin]++
      }

      // Count sightings per band
      const geoStart = geomagnetic[0]?.date
      const geoEnd = geomagnetic[geomagnetic.length - 1]?.date
      const sightingsByBand = new Array(BANDS.length).fill(0)
      let total = 0

      for (const s of sightings) {
        const d = toDateStr(s.occurredAt)
        if (d < geoStart || d > geoEnd) continue
        const kp = kpByDate.get(d)
        if (kp === undefined) continue
        const bin = Math.min(Math.floor(kp), BANDS.length - 1)
        sightingsByBand[bin]++
        total++
      }

      // Expected sightings per band (proportional to days in band)
      const totalDays = kpByDate.size
      const expected = daysByBand.map(d => (d / totalDays) * total)

      const chi2 = chiSquared(sightingsByBand, expected)
      const df = BANDS.length - 1

      const bandDetails = BANDS.map((b, i) => ({
        band: `Kp ${b}-${b + 1}`,
        days: daysByBand[i],
        sightings: sightingsByBand[i],
        expected: +expected[i].toFixed(1),
        ratio: expected[i] > 0 ? +(sightingsByBand[i] / expected[i]).toFixed(2) : 0
      }))

      return {
        supported: chi2 > 16.92, // p < 0.05 with df=8
        effectSize: null,
        chiSquared: +chi2.toFixed(2),
        degreesOfFreedom: df,
        samples: { totalSightings: total, totalDays, bands: bandDetails },
        summary: `χ²(${df}) = ${chi2.toFixed(1)}. ${chi2 > 16.92 ? 'Sighting distribution across Kp bands significantly deviates from the day-count baseline.' : 'No significant deviation from baseline day distribution.'}`
      }
    }
  },

  // ── H3: Seismic proximity ───────────────────────────────────────
  {
    id: 'seismic-proximity',
    name: 'UAP sightings cluster near recent earthquakes',
    description: 'For each earthquake M4.0+, count sightings within 150 km and ±7 days. Baseline uses time-shifted control: same spatial pairs but with earthquake dates shifted ±90 days to break any real temporal association while preserving geographic co-location.',
    datasets: ['sightings', 'earthquakes'],

    test (ctx) {
      const { sightings, earthquakes } = ctx
      const RADIUS_KM = 150
      const WINDOW_DAYS = 7
      const CONTROL_SHIFT_DAYS = 90

      // Only sightings with coordinates
      const geoSightings = sightings.filter(s => s.coordinates?.lat != null && s.coordinates?.lng != null)

      // Index sightings by date for fast window lookup
      const sightingsByDate = new Map()
      for (const s of geoSightings) {
        const d = toDateStr(s.occurredAt)
        if (!sightingsByDate.has(d)) sightingsByDate.set(d, [])
        sightingsByDate.get(d).push(s)
      }

      // Count pairs for a given date offset applied to earthquakes
      function countPairs (dateOffsetDays) {
        let pairs = 0
        let quakesWithPairs = 0
        const distances = []

        for (const eq of earthquakes) {
          if (eq.lat == null || eq.lng == null) continue
          const eqDate = new Date(eq.time)
          eqDate.setDate(eqDate.getDate() + dateOffsetDays)
          let hasPair = false

          for (let offset = -WINDOW_DAYS; offset <= WINDOW_DAYS; offset++) {
            const d = new Date(eqDate)
            d.setDate(d.getDate() + offset)
            const dateStr = d.toISOString().slice(0, 10)
            const daySightings = sightingsByDate.get(dateStr)
            if (!daySightings) continue

            for (const s of daySightings) {
              const dist = haversineKm(eq.lat, eq.lng, s.coordinates.lat, s.coordinates.lng)
              if (dist <= RADIUS_KM) {
                pairs++
                distances.push(dist)
                hasPair = true
              }
            }
          }

          if (hasPair) quakesWithPairs++
        }

        return { pairs, quakesWithPairs, distances }
      }

      // Real pairs (offset = 0)
      const real = countPairs(0)

      // Control pairs (shifted ±90 days — same geography, different time)
      const controlFwd = countPairs(CONTROL_SHIFT_DAYS)
      const controlBwd = countPairs(-CONTROL_SHIFT_DAYS)
      const controlMean = (controlFwd.pairs + controlBwd.pairs) / 2

      const ratio = controlMean > 0 ? real.pairs / controlMean : 0

      return {
        supported: real.pairs > controlMean,
        effectSize: +ratio.toFixed(2),
        samples: {
          earthquakes: earthquakes.length,
          geoSightings: geoSightings.length,
          radiusKm: RADIUS_KM,
          windowDays: WINDOW_DAYS,
          realPairs: real.pairs,
          realQuakesWithPairs: real.quakesWithPairs,
          controlPairsForward: controlFwd.pairs,
          controlPairsBackward: controlBwd.pairs,
          controlMean: +controlMean.toFixed(0),
          meanDistanceKm: +mean(real.distances).toFixed(1),
          stdDistanceKm: +stddev(real.distances).toFixed(1)
        },
        summary: `${real.pairs} real sighting–earthquake pairs (within ${RADIUS_KM} km, ±${WINDOW_DAYS} days). Control (±${CONTROL_SHIFT_DAYS}-day shift): ${controlMean.toFixed(0)} pairs. Ratio: ${ratio.toFixed(2)}x. ${real.quakesWithPairs} earthquakes had nearby sightings.`
      }
    }
  },

  // ── H4: Nuclear facility proximity ──────────────────────────────
  {
    id: 'nuclear-proximity',
    name: 'UAP sightings are disproportionately concentrated near nuclear facilities',
    description: 'Compare the fraction of sightings within 80 km of nuclear facilities to control sets of the same size (140 random sighting locations). Controls for population density and geographic reporting bias.',
    datasets: ['sightings', 'nuclear'],

    test (ctx) {
      const { sightings, nuclear } = ctx
      const RADIUS_KM = 80
      const NUM_CONTROL_SETS = 20

      const geoSightings = sightings.filter(s => s.coordinates?.lat != null && s.coordinates?.lng != null)

      // Helper: count fraction of sightings within RADIUS_KM of any point in a set
      // Samples every 5th sighting for speed on large datasets
      function fractionNear (points) {
        const sampleStep = 5
        let near = 0
        let sampled = 0
        for (let i = 0; i < geoSightings.length; i += sampleStep) {
          const s = geoSightings[i]
          sampled++
          for (const p of points) {
            if (haversineKm(s.coordinates.lat, s.coordinates.lng, p.lat, p.lng) <= RADIUS_KM) {
              near++
              break
            }
          }
        }
        return sampled > 0 ? near / sampled : 0
      }

      // Real: fraction near nuclear facilities
      const nuclearPoints = nuclear.map(f => ({ lat: f.lat, lng: f.lng }))
      const observedFraction = fractionNear(nuclearPoints)

      // Control: create sets of 140 random sighting locations and measure same metric
      const controlFractions = []
      for (let trial = 0; trial < NUM_CONTROL_SETS; trial++) {
        const controlPoints = []
        for (let j = 0; j < nuclear.length; j++) {
          const idx = Math.floor(Math.random() * geoSightings.length)
          const s = geoSightings[idx]
          controlPoints.push({ lat: s.coordinates.lat, lng: s.coordinates.lng })
        }
        controlFractions.push(fractionNear(controlPoints))
      }

      const controlMean = mean(controlFractions)
      const controlStd = stddev(controlFractions)
      const overrep = controlMean > 0 ? observedFraction / controlMean : 0

      // Z-score: how many standard deviations above the control mean
      const zScore = controlStd > 0 ? (observedFraction - controlMean) / controlStd : 0

      // By facility type
      const byType = {}
      for (const f of nuclear) {
        if (!byType[f.type]) byType[f.type] = { facilities: 0, nearbySightings: 0 }
        byType[f.type].facilities++
      }
      for (const s of geoSightings) {
        for (const f of nuclear) {
          if (haversineKm(s.coordinates.lat, s.coordinates.lng, f.lat, f.lng) <= RADIUS_KM) {
            byType[f.type].nearbySightings++
            break
          }
        }
      }

      // By country (top 5)
      const countryMap = {}
      for (const f of nuclear) {
        if (!countryMap[f.country]) countryMap[f.country] = { facilities: 0, nearbySightings: 0 }
        countryMap[f.country].facilities++
      }
      for (const s of geoSightings) {
        for (const f of nuclear) {
          if (haversineKm(s.coordinates.lat, s.coordinates.lng, f.lat, f.lng) <= RADIUS_KM) {
            if (!countryMap[f.country]) countryMap[f.country] = { facilities: 0, nearbySightings: 0 }
            countryMap[f.country].nearbySightings++
            break
          }
        }
      }

      return {
        supported: observedFraction > controlMean && zScore > 1.96,
        effectSize: +overrep.toFixed(2),
        samples: {
          facilities: nuclear.length,
          geoSightings: geoSightings.length,
          radiusKm: RADIUS_KM,
          observedFraction: +(observedFraction * 100).toFixed(2),
          controlMeanFraction: +(controlMean * 100).toFixed(2),
          controlStdFraction: +(controlStd * 100).toFixed(2),
          controlSets: NUM_CONTROL_SETS,
          zScore: +zScore.toFixed(2),
          byType,
          byCountry: countryMap
        },
        summary: `${(observedFraction * 100).toFixed(1)}% of sightings within ${RADIUS_KM} km of nuclear facilities. Control (${NUM_CONTROL_SETS} random sets of ${nuclear.length} sighting locations): ${(controlMean * 100).toFixed(1)}% ± ${(controlStd * 100).toFixed(1)}%. Ratio: ${overrep.toFixed(2)}x. z = ${zScore.toFixed(2)}.`
      }
    }
  },

  // ── H5: Fireball temporal coincidence ───────────────────────────
  {
    id: 'fireball-coincidence',
    name: 'UAP sightings spike on days with NASA CNEOS fireball events',
    description: 'Compare the mean sighting count on fireball days vs non-fireball days within the dataset overlap period.',
    datasets: ['sightings', 'fireballs'],

    test (ctx) {
      const { sightings, fireballs } = ctx

      // Fireball dates
      const fireballDates = new Set()
      for (const f of fireballs) {
        fireballDates.add(toDateStr(f.date))
      }

      // Sighting counts by date
      const countsByDate = new Map()
      for (const s of sightings) {
        const d = toDateStr(s.occurredAt)
        countsByDate.set(d, (countsByDate.get(d) || 0) + 1)
      }

      const fireballDayCounts = []
      const nonFireballDayCounts = []

      for (const [date, count] of countsByDate.entries()) {
        if (fireballDates.has(date)) fireballDayCounts.push(count)
        else nonFireballDayCounts.push(count)
      }

      const meanFireball = mean(fireballDayCounts)
      const meanNonFireball = mean(nonFireballDayCounts)
      const ratio = meanNonFireball > 0 ? meanFireball / meanNonFireball : 0

      // Effect size (Cohen's d)
      const pooledStd = Math.sqrt(
        ((fireballDayCounts.length - 1) * stddev(fireballDayCounts) ** 2 +
         (nonFireballDayCounts.length - 1) * stddev(nonFireballDayCounts) ** 2) /
        (fireballDayCounts.length + nonFireballDayCounts.length - 2)
      )
      const cohensD = pooledStd > 0 ? (meanFireball - meanNonFireball) / pooledStd : 0

      return {
        supported: meanFireball > meanNonFireball,
        effectSize: +cohensD.toFixed(3),
        samples: {
          fireballDays: fireballDayCounts.length,
          nonFireballDays: nonFireballDayCounts.length,
          meanSightingsOnFireballDays: +meanFireball.toFixed(2),
          meanSightingsOnNonFireballDays: +meanNonFireball.toFixed(2),
          ratio: +ratio.toFixed(2)
        },
        summary: `Mean sightings on fireball days: ${meanFireball.toFixed(1)} vs non-fireball days: ${meanNonFireball.toFixed(1)} (ratio: ${ratio.toFixed(2)}x). Cohen's d = ${cohensD.toFixed(3)}.`
      }
    }
  },

  // ── H6: Weekend effect ──────────────────────────────────────────
  {
    id: 'weekend-effect',
    name: 'UAP sightings are more frequent on weekends (observer bias)',
    description: 'Test whether Friday–Sunday accounts for a disproportionate share of sightings vs Monday–Thursday. Expected: 3/7 = 42.9%.',
    datasets: ['sightings'],

    test (ctx) {
      const { sightings } = ctx

      let weekend = 0
      let weekday = 0

      for (const s of sightings) {
        const d = new Date(s.occurredAt)
        if (isNaN(d.getTime())) continue
        const dow = d.getUTCDay() // 0=Sun, 6=Sat
        if (dow === 0 || dow === 5 || dow === 6) weekend++
        else weekday++
      }

      const total = weekend + weekday
      const observedRate = total > 0 ? weekend / total : 0
      const expectedRate = 3 / 7
      const overrep = observedRate / expectedRate

      const expected = [total * expectedRate, total * (1 - expectedRate)]
      const observed = [weekend, weekday]
      const chi2 = chiSquared(observed, expected)

      return {
        supported: overrep > 1.0,
        effectSize: +overrep.toFixed(3),
        chiSquared: +chi2.toFixed(2),
        degreesOfFreedom: 1,
        samples: {
          total,
          weekend,
          weekday,
          weekendPercent: +(observedRate * 100).toFixed(1),
          expectedPercent: +(expectedRate * 100).toFixed(1)
        },
        summary: `${(observedRate * 100).toFixed(1)}% of sightings on Fri–Sun vs expected ${(expectedRate * 100).toFixed(1)}%. Overrepresentation: ${overrep.toFixed(3)}x. χ²(1) = ${chi2.toFixed(1)}.`
      }
    }
  },

  // ── H7: Summer seasonality ──────────────────────────────────────
  {
    id: 'summer-seasonality',
    name: 'UAP sightings peak in Northern Hemisphere summer months',
    description: 'Test whether June–August accounts for more than 25% (3/12) of sightings. This tests observer availability bias (longer days, outdoor activity, July 4th).',
    datasets: ['sightings'],

    test (ctx) {
      const { sightings } = ctx
      const monthCounts = new Array(12).fill(0)

      for (const s of sightings) {
        const m = parseInt((s.occurredAt || '').slice(5, 7), 10)
        if (m >= 1 && m <= 12) monthCounts[m - 1]++
      }

      const total = monthCounts.reduce((a, b) => a + b, 0)
      const summer = monthCounts[5] + monthCounts[6] + monthCounts[7] // Jun Jul Aug
      const summerRate = total > 0 ? summer / total : 0
      const expectedRate = 3 / 12
      const overrep = summerRate / expectedRate

      const peakMonth = monthCounts.indexOf(Math.max(...monthCounts))
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

      return {
        supported: summerRate > expectedRate,
        effectSize: +overrep.toFixed(3),
        samples: {
          total,
          summer,
          summerPercent: +(summerRate * 100).toFixed(1),
          peakMonth: monthNames[peakMonth],
          peakCount: monthCounts[peakMonth],
          monthlyCounts: Object.fromEntries(monthNames.map((n, i) => [n, monthCounts[i]]))
        },
        summary: `${(summerRate * 100).toFixed(1)}% of sightings in Jun–Aug vs expected ${(expectedRate * 100).toFixed(1)}%. Overrepresentation: ${overrep.toFixed(2)}x. Peak month: ${monthNames[peakMonth]} (${monthCounts[peakMonth]} sightings).`
      }
    }
  },

  // ── H8: Credibility vs characteristics ──────────────────────────
  {
    id: 'credibility-characteristics',
    name: 'Sightings with more reported characteristics have higher credibility scores',
    description: 'Test whether there is a positive correlation between the number of characteristics reported and the credibility score assigned.',
    datasets: ['sightings'],

    test (ctx) {
      const { sightings } = ctx

      const pairs = sightings
        .filter(s => s.credibility > 0 && Array.isArray(s.characteristics))
        .map(s => ({ chars: s.characteristics.length, cred: s.credibility }))

      if (pairs.length < 10) {
        return {
          supported: false,
          effectSize: 0,
          samples: { pairs: pairs.length },
          summary: 'Insufficient data (< 10 sightings with characteristics and credibility).'
        }
      }

      // Pearson correlation
      const xs = pairs.map(p => p.chars)
      const ys = pairs.map(p => p.cred)
      const mx = mean(xs)
      const my = mean(ys)
      let num = 0
      let dx2 = 0
      let dy2 = 0
      for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - mx
        const dy = ys[i] - my
        num += dx * dy
        dx2 += dx * dx
        dy2 += dy * dy
      }
      const r = dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0

      // Bin by characteristic count
      const bins = {}
      for (const p of pairs) {
        const bin = Math.min(p.chars, 5)
        if (!bins[bin]) bins[bin] = { count: 0, totalCred: 0 }
        bins[bin].count++
        bins[bin].totalCred += p.cred
      }
      const binSummary = Object.fromEntries(
        Object.entries(bins).map(([k, v]) => [
          `${k}${parseInt(k) >= 5 ? '+' : ''} chars`,
          { count: v.count, meanCredibility: +(v.totalCred / v.count).toFixed(1) }
        ])
      )

      return {
        supported: r > 0.05,
        effectSize: +r.toFixed(4),
        samples: {
          pairs: pairs.length,
          meanCharacteristics: +mean(xs).toFixed(2),
          meanCredibility: +mean(ys).toFixed(1),
          correlation: +r.toFixed(4),
          byCharacteristicCount: binSummary
        },
        summary: `Pearson r = ${r.toFixed(4)} across ${pairs.length} sightings. ${r > 0.05 ? 'Weak positive correlation' : r < -0.05 ? 'Weak negative correlation' : 'No meaningful correlation'} between characteristic count and credibility.`
      }
    }
  }

]

// ─── Runner ─────────────────────────────────────────────────────────

async function main () {
  const opts = parseArgs()
  console.log('UAP Monitor — Hypothesis Runner')
  console.log(`Data dir: ${opts.dataDir}`)
  console.log(`Output:   ${opts.out}\n`)

  // Load all datasets
  console.log('Loading datasets...')
  const sightings = loadSightings(opts.dataDir)
  const geomagnetic = loadGeomagnetic(opts.dataDir)
  const earthquakes = loadEarthquakes(opts.dataDir)
  const fireballs = loadFireballs(opts.dataDir)
  const nuclear = loadNuclear(opts.dataDir)

  const available = {
    sightings: sightings.length > 0,
    geomagnetic: geomagnetic != null,
    earthquakes: earthquakes != null,
    fireballs: fireballs != null,
    nuclear: nuclear != null
  }

  console.log(`  Sightings:    ${sightings.length.toLocaleString()}`)
  console.log(`  Geomagnetic:  ${geomagnetic ? `${geomagnetic.length.toLocaleString()} days` : 'NOT FOUND'}`)
  console.log(`  Earthquakes:  ${earthquakes ? `${earthquakes.length.toLocaleString()} records` : 'NOT FOUND'}`)
  console.log(`  Fireballs:    ${fireballs ? `${fireballs.length.toLocaleString()} events` : 'NOT FOUND'}`)
  console.log(`  Nuclear:      ${nuclear ? `${nuclear.length.toLocaleString()} facilities` : 'NOT FOUND'}`)
  console.log()

  const ctx = { sightings, geomagnetic, earthquakes, fireballs, nuclear }

  // Run hypotheses
  const results = []

  for (const h of HYPOTHESES) {
    const missing = h.datasets.filter(d => !available[d])
    if (missing.length > 0) {
      console.log(`⏭  ${h.id} — SKIPPED (missing: ${missing.join(', ')})`)
      results.push({
        id: h.id,
        name: h.name,
        status: 'skipped',
        reason: `Missing datasets: ${missing.join(', ')}`
      })
      continue
    }

    try {
      const start = performance.now()
      const result = h.test(ctx)
      const elapsed = performance.now() - start

      const icon = result.supported ? '✓' : '✗'
      console.log(`${icon}  ${h.id} — ${result.supported ? 'SUPPORTED' : 'NOT SUPPORTED'} (${elapsed.toFixed(0)} ms)`)
      if (opts.verbose) console.log(`   ${result.summary}\n`)

      // Capture the test function source. Strip the outer `test (ctx) { ... }`
      // wrapper so readers see only the algorithm body.
      const rawSrc = h.test.toString()
      const bodyStart = rawSrc.indexOf('{') + 1
      const bodyEnd = rawSrc.lastIndexOf('}')
      const rawBody = rawSrc.slice(bodyStart, bodyEnd)

      // Dedent: remove the common leading whitespace shared by all non-empty lines
      // so the extracted body is flush-left regardless of nesting in the source file.
      const bodyLines = rawBody.split('\n')
      const minIndent = bodyLines
        .filter(l => l.trim().length > 0)
        .reduce((min, l) => {
          const m = l.match(/^(\s*)/)
          return Math.min(min, m ? m[1].length : 0)
        }, Infinity)
      const testSource = bodyLines
        .map(l => l.slice(minIndent === Infinity ? 0 : minIndent))
        .join('\n')
        .trim()

      results.push({
        id: h.id,
        name: h.name,
        description: h.description,
        datasets: h.datasets,
        testSource,
        status: 'completed',
        ...result,
        elapsedMs: +elapsed.toFixed(0)
      })
    } catch (err) {
      console.log(`✗  ${h.id} — ERROR: ${err.message}`)
      results.push({
        id: h.id,
        name: h.name,
        status: 'error',
        error: err.message
      })
    }
  }

  // Write results
  const output = {
    generatedAt: new Date().toISOString(),
    dataDir: opts.dataDir,
    datasetsLoaded: available,
    totalHypotheses: HYPOTHESES.length,
    completed: results.filter(r => r.status === 'completed').length,
    supported: results.filter(r => r.supported === true).length,
    results
  }

  mkdirSync(dirname(opts.out), { recursive: true })
  writeFileSync(opts.out, JSON.stringify(output, null, 2), 'utf-8')

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${output.supported}/${output.completed} hypotheses supported`)
  console.log(`Written: ${opts.out}`)
}

main().catch(err => {
  console.error('Fatal:', err.message || err)
  process.exit(1)
})
