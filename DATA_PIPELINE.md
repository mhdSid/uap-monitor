# Data Pipeline Architecture

Reference for how UAP Monitor ingests, normalizes, stores, and statistically tests its data. Read alongside [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the frontend that consumes these outputs.

---

## 1. Pipeline shape

```
 ┌──────────────────────────────┐
 │ 15+ heterogeneous sources    │
 │   NUFORC · Hatch UDB         │
 │   NASA fireballs · USGS      │
 │   NOAA Kp · Nuclear DBs      │
 │   GDELT · GNews · Reddit · X │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ Source adapters              │   one per source
 │   fetch → parse → normalize  │   idempotent, dated, seeded
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ Canonical schema             │   one shape to rule them all
 │   sighting | environmental | │
 │   geopolitical | facility    │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ Public datasets              │
 │   public/data/*.json         │   served as static assets
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ Hypothesis runner            │   seeded, controlled, reproducible
 │   scripts/hypotheses/        │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ public/data/hypotheses.json  │   consumed by the Research view
 └──────────────────────────────┘
```

Everything to the left of `public/data/` is offline work. Everything to the right is what the SPA actually loads.

---

## 2. Sources

230K+ records across 15+ feeds.

| Source                      | Type             | Cadence     | Notes                                |
|-----------------------------|------------------|-------------|--------------------------------------|
| NUFORC                      | Sightings        | Continuous  | Primary modern English-language feed |
| Hatch UDB                   | Sightings        | Periodic    | Historical archive                   |
| Reddit r/UFOs               | Sightings/social | Continuous  | Heavy noise; filtered                |
| X / Twitter                 | Sightings/social | Continuous  | Heavy noise; filtered                |
| NASA CNEOS                  | Fireballs        | Continuous  | Authoritative astronomical baseline  |
| USGS                        | Earthquakes      | Continuous  | M ≥ 2.5 typical                      |
| NOAA / SWPC                 | Geomagnetic Kp   | 3-hourly    | Index 0–9                            |
| Nuclear facility datasets   | Infrastructure   | Static-ish  | Location + capacity                  |
| GDELT                       | News signal      | 15 min      | Event metadata                       |
| GNews                       | News             | Continuous  | Headlines + summaries                |
| (others)                    | Various          | Various     | Documented per-adapter               |

Each source has its own quirks (encoding, time zone, geocoding quality, schema drift). The point of the adapter layer is to absorb those quirks so the rest of the system only ever sees the canonical schema.

---

## 3. Source adapters

Each source has an adapter under `scripts/` (or wherever the pipeline lives in your checkout — verify with `ls`). Each adapter:

1. **Fetches** raw data (HTTP, archive download, scrape, etc.).
2. **Parses** into native records.
3. **Normalizes** into the canonical schema.
4. **Writes** the output to `public/data/<source>.json` (or a partitioned variant).

Adapter contract:

- **Idempotent.** Re-running must not corrupt prior state.
- **Dated.** Each record has a stable `t` (ISO 8601 UTC).
- **Seeded.** Any randomness (sampling, jitter) uses a fixed seed.
- **No clock-fallback writes.** `new Date().toISOString()` must **never** overwrite a correct prior publication date on a re-run. Default to "preserve the existing value" when in doubt.

---

## 4. Canonical schema

The frontend reads one shape. Roughly:

```ts
// sighting
{
  id:       string
  t:        string          // ISO 8601 UTC
  lat:      number
  lon:      number
  source:   string          // 'nuforc' | 'hatch' | …
  shape?:   string
  summary?: string
  raw?:     unknown         // source-specific payload, opaque to UI
}

// environmental sample (earthquake, fireball, Kp)
{
  id:    string
  t:     string
  lat?:  number             // omitted for global-scalar signals (Kp)
  lon?:  number
  kind:  'quake' | 'fireball' | 'kp'
  value: number             // magnitude / brightness / Kp index
  raw?:  unknown
}

// facility / static-location
{
  id:    string
  lat:   number
  lon:   number
  kind:  'nuclear' | …
  meta?: Record<string, unknown>
}
```

If you're adding a new source, your adapter's output **must** fit into one of these shapes. Extending the schema is a deliberate change, not an adapter detail.

---

## 5. Storage

- Outputs are committed JSON under `public/data/`.
- Files are versioned with the repo — auditability over freshness.
- Large feeds are partitioned (by year, by region) to keep individual file sizes sane.
- Service worker caches the shell and core datasets; large feeds are fetched on demand.

**Why JSON over a database:** the platform's credibility argument is "anyone can audit the inputs." A git-tracked dataset is the strongest possible form of that.

---

## 6. Hypothesis runner

The differentiator. Located under `scripts/hypotheses/`.

### 6.1 What it produces

`public/data/hypotheses.json` — an array of hypothesis result objects, each with:

```ts
{
  id:          string
  title:       string
  question:    string
  algorithm:   string        // human-readable methodology summary
  source:      string        // path to the runner script (for "view methodology")
  publishedAt: string        // ISO 8601 UTC — preserved across re-runs
  n:           number        // sample size
  observed:    number        // observed metric (e.g. clustering ratio)
  baseline:    number        // baseline / null expectation
  effect:      number        // observed / baseline (or absolute diff)
  cohensD?:    number        // standardized effect size
  ci?:         [number, number]
  seed:        number
  notes?:      string        // including self-correction history
}
```

The `Research` view renders this list; clicking a card opens `HypothesisModal` with the algorithm and the source link.

### 6.2 Controls

Two control patterns are in active use; both are essential to the credibility story.

**Time-shifted controls (±90 days)** — for seismic baselines.
- For each sighting, sample the seismic activity at ±90 days from the sighting timestamp at the same location.
- The shifted distributions form the null. The actual sighting day is compared against them.
- Eliminates seasonality and persistent local activity as confounders.

**Population-density-corrected nulls (20 random location sets)** — for facility / point-of-interest clustering.
- For each facility, draw 20 random location sets matched on population density (so we're comparing a nuclear plant against 20 demographically similar non-plant points, not against random ocean).
- Compute the same metric (e.g. nearby-sightings count) at each random set.
- The aggregate of these forms the null distribution. The actual facility result is compared against it.
- Eliminates "more people → more sightings" as a confounder. This is the control that flipped nuclear clustering from 12× → 0.42×.

### 6.3 Reproducibility

- **Seeded RNG.** Every runner takes a seed. Same seed → same outputs.
- **Inputs are committed.** Datasets used by a run are in the repo.
- **Algorithm summary in output.** The methodology shown in the modal is sourced from the same constants the runner uses; they don't drift.
- **Source link in output.** Each hypothesis includes the path to the script that produced it.

### 6.4 Idempotency

A re-run must:

- Preserve `publishedAt` on existing hypotheses.
- Update derived fields (`observed`, `baseline`, `effect`, `cohensD`, `ci`, `n`) if the inputs changed.
- Append, never silently overwrite, when methodology changes substantially — instead, publish a new hypothesis ID and link it as the successor.

`new Date().toISOString()` is the single most common bug-source here. Guard against it in every runner.

---

## 7. The self-correction workflow

This is the platform's most important credibility lever. When a finding is revised:

1. **Don't delete the original.** Update `notes` with a self-correction log entry. Add a new hypothesis ID for the corrected result if the methodology change is non-trivial.
2. **Publish the correction publicly** — Reddit / X — in plain language. The community posts about nuclear clustering (original) and its self-correction (after population-density control) are the canonical reference.
3. **Link the methodology in the modal.** The reader can see exactly what changed.

The nuclear case: original analysis showed UAP sightings clustered near nuclear facilities at ~12× a naïve baseline. After introducing population-density-matched controls, the corrected ratio was 0.42× — i.e. sightings near nuclear facilities are slightly **less** dense than population-matched controls would predict. Publishing the correction built more credibility than the original headline ever could have.

---

## 8. Published hypotheses (current set)

The Research view currently surfaces, among others:

- **Nuclear clustering** — original + self-correction
- **Fireball coincidence** — temporal overlap of sightings with NASA fireballs
- **Geomagnetic suppression** — sightings during quiet vs disturbed Kp bands
- **Observer bias** — population density × reporting rate
- **Kp band distribution** — sightings across Kp 0–9 buckets

Each has a community post associated with it.

---

## 9. Adding a new source

1. **Decide which canonical shape it normalizes to.** If none fits, propose a schema extension first.
2. **Write the adapter** under `scripts/<source>/`. Match the existing pattern (fetch → parse → normalize → write).
3. **Guarantee idempotency and `publishedAt` preservation.**
4. **Document quirks** at the top of the adapter (time zone, encoding, known data quality issues).
5. **Output to `public/data/<source>.json`** (or partitioned equivalent).
6. **Update the source registry** so the frontend knows where to load it from.
7. **Decide whether the new data unlocks a new hypothesis** — if so, write the runner.

---

## 10. Adding a new hypothesis

1. **Write the question in one sentence.** If you can't, you don't have a hypothesis yet.
2. **Choose the correct control** — time-shifted, population-density-matched, or a new control type (which is a deliberate methodology change, not an adapter detail).
3. **Seed the runner.**
4. **Produce the result object** matching the schema in §6.1.
5. **Append to `public/data/hypotheses.json`** with idempotent merge semantics.
6. **Write the community post.** Plain language. No χ². Conversational. Invite participation.
7. **Verify the modal renders correctly.** The `algorithm` field is what users actually read.

---

## 11. Roadmap items (data-pipeline-adjacent)

- Extract the **statistical methodology layer** (`spatial-null` / `geo-hypothesis`) as a standalone MIT-licensed toolkit. The self-correction narrative leads the README.
- Extract the **source adapter pattern** (15 sources → one schema) as a reusable package for the broader UAP / anomaly-research community.
- Add **temporal clustering / flap detection** as a differentiating analytical feature.

---

## 12. Hard rules

- Adapters are idempotent.
- `publishedAt` is never silently overwritten by a clock.
- Every randomness is seeded.
- Every hypothesis publishes its algorithm and source link.
- Corrections are published. Quietly fixing a bad finding is worse than the bad finding.
