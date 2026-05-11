# UAP Monitor

> Open-source geospatial intelligence platform for UAP/UFO sighting analysis. 230K+ records from 15+ heterogeneous sources, cross-referenced against environmental datasets with publicly reproducible statistical methodology.

🌐 **Live:** [uapmonitor.org](https://uapmonitor.org) · 🛰️ **Stack:** Vanilla TypeScript · Cloudflare Workers · Leaflet · Vite + PWA

---

## What this is

A research-grade analytics platform that aggregates UAP sightings spanning ancient history to present and tests them against environmental, geophysical, and geopolitical datasets. The goal is to surface statistically meaningful correlations — and, when those correlations don't survive proper controls, to say so publicly.

The platform is built around three principles:

1. **Methodological transparency** — every hypothesis published exposes its algorithm, controls, sample size, effect size, and source link.
2. **Self-correction over strong claims** — the nuclear-facility clustering finding was revised from 12× → 0.42× after population-density controls were added. We published the correction.
3. **Reproducibility** — the hypothesis runner uses fixed seeds, time-shifted baselines, and population-density-corrected nulls. Output is committed JSON anyone can audit.

---

## Data sources

| Domain | Sources |
|---|---|
| Sightings | NUFORC, Hatch UDB, Reddit r/UFOs, X/Twitter |
| Astronomical | NASA fireballs (CNEOS) |
| Geophysical | USGS earthquakes, NOAA/SWPC geomagnetic Kp |
| Infrastructure | Nuclear facility datasets |
| News/Signal | GDELT, GNews |
| Other | 230K+ records normalized into a single schema |

All sources are ingested through adapters that normalize to one canonical schema. See [`DATA_PIPELINE.md`](./DATA_PIPELINE.md).

---

## Routes

| Route | Purpose |
|---|---|
| `/` Monitor | Main dashboard — global map, recent sightings, filters |
| `/geomagnetic` | Sightings × Kp index correlation |
| `/seismic` | Sightings × earthquake activity (2D density heatmap) |
| `/intel` | News/social-signal cross-referencing |
| `/spiritual` | Generative canvas (artistic/exploratory) |
| `/research` | Published hypothesis results with methodology modals |

---

## Tech stack

- **Language:** Vanilla TypeScript, zero framework dependencies
- **Build:** Vite + PWA plugin
- **Hosting:** Cloudflare Workers
- **Mapping:** Leaflet
- **Reactivity:** Custom signals (`signal` / `computed` / `effect` / `batch`)
- **Components:** Custom `Component` base class with `create()` / `didMount()` / `destroy()` lifecycle
- **Routing:** History API, lazy-loaded views, `useRouter<K>` composable
- **Analytics:** Google Analytics 4 with custom event taxonomy

No React. No Vue. No Svelte. The component system is small enough to read in one sitting and explicit about ownership.

---

## Quick start

```bash
# install
pnpm install

# dev
pnpm dev

# build
pnpm build

# preview production build
pnpm preview

# deploy (Cloudflare Workers)
pnpm deploy
```

See [`ONBOARDING.md`](./ONBOARDING.md) for a walkthrough of the codebase.

---

## Project structure

```
src/
├── components/      atoms + molecules (Button, Tag, Alert, Modal, Card, Chip, DataGrid, …)
├── views/           one folder per route, orchestrates components
├── core/            Component base class, h(), signals, router
├── data/
│   ├── strings.ts   all user-facing strings (no inline literals)
│   └── …
├── stores/          signals-based global state
├── styles/          design tokens, theme CSS vars
└── main.ts          app bootstrap

public/
└── data/
    ├── hypotheses.json   published statistical results
    └── …                 normalized sighting + environmental datasets

scripts/
└── hypotheses/      statistical runners (seeded, idempotent)
```

---

## Documentation

- [`ONBOARDING.md`](./ONBOARDING.md) — read this first if you're contributing or running Claude Code
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — component system, signals, router, design system
- [`DATA_PIPELINE.md`](./DATA_PIPELINE.md) — source adapters, schema, hypothesis methodology

---

## Methodology highlights

- **Time-shifted controls (±90 days)** for seismic baselines
- **Population-density-corrected nulls (20 random location sets)** for facility clustering
- **Cohen's d** for effect size; raw counts alone are not published
- **Seeded RNG** — every result reproducible from `scripts/hypotheses/`
- **Self-correction log** — public posts whenever a finding is revised

---

## Contributing

Before touching the codebase, read [`ONBOARDING.md`](./ONBOARDING.md). The codebase has strict conventions (no anonymous strings, no native HTML without justification, design-system CSS variables only). Violating them creates more work than skipping them saves.

Issues and discussion welcome via GitHub Issues. The platform is based in Japan and has an international early-adopter user base.

---

## License

MIT.

---

## Repo

[`github.com/mhdSid/uap-monitor`](https://github.com/mhdSid/uap-monitor)
