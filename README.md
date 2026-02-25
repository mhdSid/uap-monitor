# UAP Monitor

**Real-time UAP/UFO sighting dashboard** — aggregating UAP/UFO sighting data from every open source, unlocking the missing CJK + Russia region, and cross-referencing reports against known objects.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

> **Status: Work in Progress** — Core UI and component architecture complete. Data integration in progress.

---

## The Problem

UAP research has a massive blind spot — and it's exactly where the data matters most.

AARO (the US government's All-domain Anomaly Resolution Office) designated **western Japan to China** as a UAP hotspot. Japan has an **80-member parliamentary UAP group** pushing for SDF data release. China's PLA is running **AI-powered aerial anomaly tracking**. Korea has active investigation centers. Russia's Academy of Sciences collected **3,000+ reports** through the Soviet-era "Network" program.

None of this data exists in any Western database.

Enigma Labs — the largest modern sighting platform — has **510 Japan, 315 China, and 42 South Korea** entries. Against **270,000+** English-language reports. That's not a gap. That's an entire region of the planet missing from the global picture, and it happens to be the region the US government flagged as a hotspot.

Meanwhile, the tools that do exist are broken in other ways:

- **Fragmented** — NUFORC, MUFON, GEIPAN, Enigma Labs, NASA fireballs, GDELT news all sit in separate silos with incompatible formats. No unified operational view exists.
- **No cross-referencing** — A sighting 2km from a commercial flight path could be debunked in seconds with OpenSky ADS-B data. Nobody does this automatically.
- **Stuck in the 90s** — The primary research interfaces are static HTML tables and paywalled desktop apps. There is no real-time, filterable, credibility-scored dashboard for the phenomenon that now has congressional hearings and a dedicated Pentagon office.

UAP Monitor exists to solve all three: **aggregate every open source into one view**, **unlock the CJK + Russia data that Western researchers can't access**, and **cross-reference sightings against known objects** so researchers can focus on the cases that actually matter.

---

## What It Does

A terminal-aesthetic PWA dashboard that displays UAP/UFO sighting data grouped by continent, with credibility scoring, shape classification, status tracking, and a news feed aggregating UAP-related reporting from CJK and Russian sources.

### Current Features

- **Continent-grouped sighting grids** — Asia-Pacific, Europe, Americas with clickable detail modals
- **25 NUFORC shape classifications** — Orb, Triangle, Disk, Cigar, Fireball, Formation, and 19 more
- **Credibility scoring** — Color-coded bars (green >80, amber >65, muted below)
- **Status tracking** — VERIFIED, PENDING, ANALYZING, DEBUNKED per sighting
- **UAP news feed** — Aggregated reporting from NHK, Xinhua, Yonhap, TASS, Kyodo
- **Data source status panel** — Live indicators for each connected source
- **CRT terminal aesthetic** — Scanlines, monospace, radar loader, typing ticker
- **Offline-capable PWA** — Installable, service worker with offline fallback
- **App shell** — Inline critical CSS + SVG loader renders before JS loads
- **Component architecture** — Every UI element is a typed `render(props)` component

---

## Architecture

```
src/
├── components/
│   ├── header/              renderHeader()
│   ├── footer/              renderFooter()
│   ├── ticker/              renderTicker(props)
│   ├── loader/              renderLoader()
│   ├── tags/                renderTag / renderStatusTag / renderLiveTag
│   ├── data-grid/           renderDataGrid<T>(props)
│   ├── credibility-bar/     renderCredibilityBar(props)
│   ├── data-sources/        renderDataSources(props)
│   ├── news-feed/           renderNewsFeed(props)
│   ├── sighting-modal/      openSightingModal(sighting)
│   ├── modal/               openModal / closeModal
│   ├── toast/               renderToast / useToast
│   ├── layout/              renderSection(props, content)
│   └── icons/               iconRadar / iconClose / iconChevron / ...
├── composables/             useAsyncAction, useDataSource
├── data/                    Mock sighting data (replaced by real sources)
├── enums/                   Continent, SightingShape, SightingStatus, ...
├── types/                   Full TypeScript interfaces for all props
├── utils/
│   └── dom.ts               h(), el(), fragment(), text(), show/hide,
│                             addClass/removeClass, safeHtml(), qs/qsa,
│                             mount(), replaceChildren(), generateId()
├── styles/                  Single CSS file, CSS variables, responsive
├── app.ts                   Orchestration only (~140 lines)
└── main.ts                  Entry point
```

**Tech stack**: Vite + vanilla TypeScript + PWA. No framework. 19KB gzipped JS, 2KB gzipped CSS. Builds in under 500ms.

**Zero raw DOM calls** outside `utils/dom.ts` — every component uses the `h()` builder or utility functions. The only `document.body` references are for top-level overlays (modal, toast).

---

## Data Sources

### Connected

| Source | Type | Status | Notes |
|---|---|---|---|
| **NUFORC** | Sighting database | 🟡 Pending | 170K+ reports. ToS forbids scraping — emailed CTO for data access. HuggingFace dump available for POC |

### Planned Integration

| Source | Type | What It Provides | Integration Path |
|---|---|---|---|
| **NUFORC (HuggingFace)** | Pre-scraped dataset | 147K sightings with lat/lng, shape, date, summary | JSON/CSV import — immediate |
| **Enigma Labs** | Scored sighting DB | 270K+ sightings with credibility scores | Partner API — request access via SCU |
| **NASA Fireball API** | Bolide events | Date, coordinates, energy, velocity for atmospheric fireballs | Public REST API — `ssd-api.jpl.nasa.gov` |
| **NASA CNEOS** | Near-earth objects | Fireball and bolide event data | Public REST API |
| **GEIPAN** | French gov UAP DB | 3,200+ classified cases (A/B/C/D ratings) | Public database — scraper needed |
| **OpenSky Network** | Flight tracking | Real-time ADS-B aircraft positions for cross-referencing | Public REST API — `opensky-network.org` |
| **GDELT** | Global news | 100+ languages, 15-min updates, geo-tagged UAP articles | Public API — `api.gdeltproject.org` |
| **MUFON** | Sighting database | Detailed investigation reports with witness data | RapidAPI — limited free tier |
| **AARO** | US gov UAP office | Official reports, declassified data | Manual integration — PDF/report parsing |

### CJK + Russia Sources (The Data Moat)

| Region | Sources | Scale |
|---|---|---|
| **Japan** | MUFON Japan chapter, International UFO Laboratory (Fukushima, 3000+ materials), Mu Monthly magazine, SDF protocols, 80-member parliamentary UAP group | Active research community, gov interest since 2020 |
| **China** | CURO (3,500+ members), Purple Mountain Observatory (2,000+ analyzed), PLA AI tracking system | State-level interest, academic research |
| **Korea** | Korean UFO Investigation Analysis Center, documented military encounters (1976 Seoul incident) | Small but active community |
| **Russia** | Soviet "Network" program (~3,000 Academy of Sciences + Defense Ministry reports) | Historic archive, ongoing military sightings |

---

## Getting Started

```bash
git clone https://github.com/your-username/uap-monitor.git
cd uap-monitor
yarn
yarn dev        # http://localhost:5173
```

### Build

```bash
yarn build      # TypeScript check + Vite production build
```

### Project Commands

| Command | Description |
|---|---|
| `yarn dev` | Vite dev server with HMR |
| `yarn build` | TypeScript + production build |
| `yarn preview` | Preview production build locally |

---

## Roadmap

- [x] Component architecture with typed `render(props)` pattern
- [x] DOM utility layer (`h()`, `safeHtml()`, class/visibility helpers)
- [x] Continent-grouped sighting grids with clickable modals
- [x] Credibility scoring with visual indicators
- [x] 25 NUFORC shape classifications
- [x] CRT terminal aesthetic (scanlines, radar loader, typing ticker)
- [x] Installable PWA with offline fallback
- [x] App shell for instant first paint
- [x] SEO meta tags, Open Graph, JSON-LD structured data
- [x] Full accessibility attributes (aria-modal, aria-live, roles)
- [ ] Integrate NUFORC HuggingFace dataset (147K real sightings)
- [ ] NASA Fireball API integration
- [ ] OpenSky flight cross-referencing
- [ ] GDELT CJK news feed aggregation
- [ ] Interactive globe visualization (Globe.gl or CesiumJS)
- [ ] Real-time WebSocket updates
- [ ] CJK language source scraper pipeline
- [ ] AI credibility scoring (LLM-based report analysis)
- [ ] Serverless functions for data aggregation
- [ ] Weekly NUFORC incremental update cron

---

## Related Efforts

- **[SCU](https://www.explorescu.org/)** — Scientific Coalition for UAP Studies. Built a similar tool 2 years ago; identified CJK data gap as the key missing piece
- **[NUFORC](https://nuforc.org/)** — National UFO Reporting Center. 170K+ reports since 1974. The gold standard sighting database
- **[Enigma Labs](https://enigmalabs.io/)** — 270K+ scored sightings. Modern UX but English-only sources
- **[AARO](https://www.aaro.mil/)** — US gov All-domain Anomaly Resolution Office. Designated western Japan–China corridor as a hotspot

---

## License

MIT

---
