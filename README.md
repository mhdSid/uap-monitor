# UAP Monitor

**Real-time UAP/UFO sighting dashboard** — aggregating open-source UAP/UFO sighting data, unlocking the missing CJK + Russia region, and cross-referencing reports against known objects.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

> **Status: Active Development** — NUFORC data pipeline complete. 147K sightings searchable. CJK + Russia integration next.

---

## The Problem

UAP research has a massive blind spot — and it's exactly where the data matters most.

AARO (the US government's All-domain Anomaly Resolution Office) designated **western Japan to China** as a UAP hotspot. Japan has an **80-member parliamentary UAP group** pushing for SDF data release. China's PLA is running **AI-powered aerial anomaly tracking**. Korea has active investigation centers. Russia's Academy of Sciences collected **3,000+ reports** through the Soviet-era "Network" program.

None of this data exists in any Western database.

Enigma Labs — the largest modern sighting platform — has **510 Japan, 315 China, and 42 South Korea** entries. Against **270,000+** English-language reports. That's not a gap. That's an entire region of the planet missing from the global picture, and it happens to be the region the US government flagged as a hotspot.

Meanwhile, the tools that do exist are broken in other ways:

- **Fragmented** — NUFORC, MUFON, GEIPAN, Enigma Labs, NASA fireballs, GDELT news all sit in separate silos with incompatible formats
- **No cross-referencing** — A sighting 2km from a commercial flight path could be debunked in seconds with OpenSky ADS-B data. Nobody does this automatically
- **Stuck in the 90s** — The primary research interfaces are static HTML tables and paywalled desktop apps

UAP Monitor exists to solve all three.

---

## Features

### Data Pipeline
- **NUFORC integration** — 147K sightings processed from the HuggingFace dataset via build-time Node script
- **Year-chunked static JSON** — Raw 191MB dataset stripped, normalized, and split into per-year files (~20-30MB total)
- **Naive credibility scoring** — Computed from observer count, characteristics detail, and report specificity
- **Location parsing** — Free-text location strings resolved to country, region, and continent

### Dashboard
- **Year range selector** — FROM/TO dropdowns to load any time range on demand
- **Search + filters** — Full-text search across summaries/locations, shape and continent dropdowns
- **Continent-grouped grids** — Sightings grouped by Asia-Pacific, Europe, Americas, Oceania, Africa
- **Sortable columns** — Click any header to sort ascending/descending
- **Infinite scroll** — 100 rows per grid initially, more loaded on scroll via IntersectionObserver
- **Sighting detail modals** — Full report with shape, duration, observers, characteristics, credibility
- **25 NUFORC shape classifications** — Orb, Triangle, Disk, Cigar, Fireball, Formation, and 19 more
- **Credibility bars** — Color-coded (green >80, amber >65)
- **Status tracking** — VERIFIED, PENDING, ANALYZING, DEBUNKED per sighting
- **Data source panel** — Live status indicators for each connected source

### Technical
- **Vanilla TypeScript** — No framework. 26KB gzipped JS, 2.4KB gzipped CSS. Builds in <700ms
- **Component architecture** — Every UI element is a typed `render(props): HTMLElement` function
- **DOM utility layer** — `h()`, `safeHtml()`, class/visibility helpers. Zero raw DOM calls outside `utils/dom.ts`
- **Non-blocking rendering** — `requestAnimationFrame` batching + chunked filtering with `setTimeout` yields
- **PWA** — Installable, service worker with offline fallback, CacheFirst for data chunks
- **App shell** — Inline critical CSS + SVG loader renders before JS loads
- **WCAG AA contrast** — All text colors meet 4.5:1 minimum contrast ratio against the dark background
- **Keyboard accessible** — Focus-visible outlines, Escape to close modals, aria labels on all controls
- **CRT aesthetic** — Scanlines, monospace, radar loader, typing ticker

---

## Architecture

```
src/
├── components/
│   ├── header/              renderHeader() — clock, GitHub link
│   ├── footer/              renderFooter()
│   ├── ticker/              renderTicker(props) — typing animation
│   ├── loader/              renderLoader() — radar sweep SVG
│   ├── tags/                renderTag / renderStatusTag / renderLiveTag
│   ├── data-grid/           renderDataGrid<T>(props) — sortable, infinite scroll
│   ├── credibility-bar/     renderCredibilityBar(props)
│   ├── data-sources/        renderDataSources(props)
│   ├── news-feed/           renderNewsFeed(props) — ready for GDELT
│   ├── sighting-modal/      openSightingModal(sighting)
│   ├── modal/               openModal / closeModal — Escape key, focus trap
│   ├── toast/               renderToast / useToast
│   ├── layout/              renderSection(props, content)
│   └── icons/               iconRadar / iconClose / iconGithub / ...
├── composables/
│   ├── use-nuforc.ts        Manifest + year chunk fetch, cache, filter engine
│   ├── use-data-source.ts   Source registry, delegates to useNuforc
│   ├── use-infinite-scroll.ts IntersectionObserver pagination
│   └── use-async-action.ts  Generic async state + toast errors
├── data/
│   └── sightings.ts         groupByContinent utility (no mock data)
├── enums/                   Continent, SightingShape, SightingStatus, SightingCharacteristic, ...
├── types/                   Full TypeScript interfaces — Sighting, NuforcManifest, SightingFilter, ...
├── utils/
│   └── dom.ts               h(), el(), fragment(), safeHtml(), qs/qsa, mount(), show/hide, ...
├── styles/                  Single CSS file, CSS variables, WCAG AA colors
├── app.ts                   Orchestration — year selector, filter toolbar, grid rendering
└── main.ts                  Entry point
```

---

## Getting Started

```bash
git clone https://github.com/mhdSid/uap-monitor.git
cd uap-monitor
yarn install
yarn dev          # http://localhost:5173 — loads with test data
```

### Load Real Data (147K NUFORC Sightings)

```bash
# Download the dataset (~191MB)
curl -L -o nuforc.json https://huggingface.co/datasets/kcimc/NUFORC/resolve/main/nuforc.json

# Process into year-chunked static JSON
yarn data:nuforc

# Start dev server — grids now populated with real data
yarn dev
```

### Commands

| Command | Description |
|---|---|
| `yarn dev` | Vite dev server with HMR |
| `yarn build` | TypeScript check + production build |
| `yarn preview` | Preview production build locally |
| `yarn data:nuforc` | Process raw NUFORC JSON into year chunks |

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_REPO_URL` | `https://github.com/mhdSid/uap-monitor` | GitHub repo link in header |
| `VITE_BASE_URL` | `/` | Base URL path (set to `/uap-monitor/` for GitHub Pages) |

### Deploy to GitHub Pages

The repo includes a GitHub Actions workflow at `.github/workflows/deploy.yml`. To enable:

1. Go to **Settings → Pages** in your GitHub repo
2. Under **Build and deployment → Source**, select **GitHub Actions**
3. Push to `main` — the workflow runs automatically

The workflow sets `VITE_BASE_URL=/uap-monitor/` so all asset paths resolve correctly under the repo subpath. If you have NUFORC data committed as `nuforc.json`, it will be processed during the build.

---

## Data Sources

### Connected

| Source | Status | Records | Notes |
|---|---|---|---|
| **[NUFORC Sightings Dataset](https://huggingface.co/datasets/kcimc/NUFORC)** | ✅ Active | 147K | Originally compiled by [Kyle McDonald](https://github.com/kcimc). Raw JSON (~191MB) processed at build time into year-chunked static files via `scripts/process-nuforc.mjs` |

### Planned

| Source | What It Provides | Integration Path |
|---|---|---|
| **NASA Fireball API** | Atmospheric bolide events with coordinates | Public REST API |
| **OpenSky Network** | Real-time ADS-B flight tracking for cross-referencing | Public REST API |
| **GDELT** | CJK/Russian UAP news articles, 15-min updates | Public API |
| **Enigma Labs** | 270K+ scored sightings | Partner API via SCU |
| **GEIPAN** | 3,200+ French gov classified cases | Scraper |
| **MUFON** | Detailed investigation reports | RapidAPI |

### CJK + Russia Sources (The Data Moat)

| Region | Sources | Scale |
|---|---|---|
| **Japan** | MUFON Japan, International UFO Laboratory (3,000+ materials), Mu Monthly, 80-member parliamentary UAP group | Active community, gov interest since 2020 |
| **China** | CURO (3,500+ members), Purple Mountain Observatory (2,000+ analyzed), PLA AI tracking | State-level interest |
| **Korea** | Korean UFO Investigation Analysis Center, documented military encounters | Small but active community |
| **Russia** | Soviet "Network" program (~3,000 Academy of Sciences reports) | Historic archive |

---

## Roadmap

- [x] Component architecture with typed `render(props)` pattern
- [x] DOM utility layer — `h()`, `safeHtml()`, class/visibility helpers
- [x] NUFORC data pipeline — 147K sightings processed into year chunks
- [x] Year range selector with FROM/TO dropdowns
- [x] Full-text search + shape/continent filters
- [x] Sortable grid columns
- [x] Infinite scroll via IntersectionObserver (100 rows per page)
- [x] Non-blocking rendering (rAF batching + chunked filtering)
- [x] Continent-grouped sighting grids with detail modals
- [x] Credibility scoring with color-coded bars
- [x] 25 NUFORC shape classifications
- [x] CRT terminal aesthetic — scanlines, radar loader, typing ticker
- [x] PWA — installable, offline fallback, CacheFirst for data chunks
- [x] App shell for instant first paint
- [x] SEO meta tags — Open Graph, Twitter Card, JSON-LD
- [x] WCAG AA color contrast compliance
- [x] Keyboard accessibility — focus-visible, Escape key, aria labels
- [ ] Location geocoding (lat/lng from NUFORC location strings)
- [ ] NASA Fireball API integration
- [ ] OpenSky flight cross-referencing
- [ ] GDELT CJK news feed aggregation
- [ ] Interactive globe visualization (Globe.gl or CesiumJS)
- [ ] Real-time WebSocket updates
- [ ] CJK language source scraper pipeline
- [ ] AI credibility scoring (LLM-based report analysis)

---

## Related Projects

- **[SCU](https://www.explorescu.org/)** — Scientific Coalition for UAP Studies
- **[NUFORC](https://nuforc.org/)** — National UFO Reporting Center, 170K+ reports since 1974
- **[Enigma Labs](https://enigmalabs.io/)** — 270K+ scored sightings
- **[AARO](https://www.aaro.mil/)** — US gov All-domain Anomaly Resolution Office

---

## License

MIT
