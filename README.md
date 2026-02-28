# UAP Monitor

**The most comprehensive open-source UAP sighting aggregator ever built** — 28,000+ chronological records from 10 researcher databases, 147K NUFORC reports, interactive map, timeline visualization, and per-record credibility scoring. Spanning 70 AD to present.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## What This Is

UAP Monitor unifies the world's fragmented UAP/UFO databases into a single searchable, filterable, map-driven interface. No other open tool combines this many sources with this level of normalization.

**12 integrated sources** across 3 data pipelines:

| Pipeline | Sources | Records | Coverage |
|---|---|---|---|
| **Chronology** | Eberhart, Johnson, NICAP, Vallée (Magonia), Blue Book Unknowns, Overmeire, Hall, Wonders in the Sky, Pre-Roswell (Rife), Dolan | 28,228 | 70 AD – 2024 |
| **NUFORC** | National UFO Reporting Center (HuggingFace dataset) | 147,000+ | 1974 – 2024 |
| **Hatch UDB** | Larry Hatch \*U\* Database (richgel999 archive) | 18,000+ | 1942 – 2003 |

Every record is normalized to a common schema: date, location (parsed to country/continent/coordinates), shape, credibility score, source attribution, and full description text.

---

## Features

### Interactive Map
Leaflet-powered world map with marker clustering. Every record with coordinates plotted — color-coded by source (green = NUFORC, cyan = Hatch, amber = Chronology). Dark CartoDB tiles. Popups show date, location, summary, source, shape, and credibility. Syncs bidirectionally with filters and year range.

### Timeline Visualization
Canvas density bar showing sighting volume per year (1900–present). Click-drag to select a year range. Hover for year + count tooltip. Active range highlighted in green. Instantly reveals historical wave patterns — 1952, 1965, 1973, the Belgian wave, post-2004 surge.

### Per-Record Credibility Scoring
Weighted formula replacing flat per-source scores:
- **Sub-source tier** (0–15): Blue Book Unknowns = 15, Eberhart/NICAP/Hall = 10, Vallée = 8, down to Overmeire = 3
- **Description depth** (0–20): 500+ chars = 20, scaled down by length
- **Location specificity** (0–15): Coordinates = 10, known country = 5
- **Date precision** (0–10): Full M/D/Y = 10, M/Y = 5
- **References** (0–10): 3+ citations = 10
- **Time specified** (0–5)

NUFORC uses observer count, characteristics detail, duration specificity, and summary length. Hatch preserves its native 1–10 credibility scale (×10).

### Data Pipeline
- **Location parsing engine** — 4 lookup maps (country aliases, regional mappings, US locations, geographic features) resolve 97%+ of raw location strings to country + continent + coordinates. Handles Overmeire's `FRANCE, City, Region` format, directional prefixes (`Northern China`), period-stripped abbreviations, parenthetical states, and colon-separated formats
- **Year-chunked static JSON** — Data split into per-year/decade files, loaded on demand via manifest
- **3 independent pipelines** — `process-nuforc.mjs`, `process-hatch.mjs`, `process-chronology.mjs` each normalize their source format into the shared schema

### Filtering & Search
- **Year range selector** — FROM/TO dropdowns spanning 70 AD to 2024
- **Full-text search** — Across summaries, descriptions, locations, shapes, sources, and tags
- **Shape filter** — 25 NUFORC classifications (Orb, Triangle, Disk, Cigar, Fireball, etc.)
- **Continent filter** — Americas, Europe, Asia-Pacific, Asia-Middle East, Oceania, Africa
- **Country filter** — Dynamic dropdown populated from loaded data (top 50 by count)
- **All filters sync** — Map, timeline, grid all respond to the same filter state

### Dashboard
- **Continent-grouped grids** — Sightings organized by geographic region
- **Sortable columns** — Date, credibility, status
- **Infinite scroll** — IntersectionObserver pagination, 20 rows per page
- **Sighting detail modals** — Full report with all metadata
- **Mobile responsive** — Date column visible and sortable on mobile, compact layout
- **Data source panel** — Live status indicators for all 12 active + 7 planned sources

### Technical
- **Vanilla TypeScript** — No framework. ~77KB gzipped JS (including Leaflet). Builds in ~11s
- **Component architecture** — Class-based components extending `Component<Props>` with lifecycle
- **Reactive store** — Signal-based state management with computed derivations
- **Non-blocking rendering** — `requestAnimationFrame` batching + chunked filtering with thread yielding
- **PWA** — Installable, service worker with offline fallback, CacheFirst for data chunks
- **WCAG AA** — 4.5:1 contrast ratios, keyboard navigation, focus-visible, ARIA labels
- **CRT aesthetic** — Dark theme, monospace, scanlines, radar loader, typing ticker

---

## Architecture

```
src/
├── components/
│   ├── sighting-map/        Leaflet map with marker clustering
│   ├── timeline/            Canvas density bar, drag-to-select year range
│   ├── sighting-grid/       Continent-grouped sortable grids
│   ├── sighting-modal/      Full sighting detail overlay
│   ├── filter-toolbar/      Search + shape + continent + country dropdowns
│   ├── year-selector/       FROM/TO year range
│   ├── data-sources/        Source status panel
│   ├── data-grid/           Generic sortable infinite-scroll table
│   ├── header/              Clock, GitHub link, version
│   ├── footer/              Attribution
│   ├── ticker/              Typing animation ticker bar
│   ├── modal/               Generic modal with focus trap
│   ├── welcome-modal/       First-launch intro with source list
│   └── icons/               SVG factory functions
├── composables/
│   ├── use-data-source.ts   Source registry, orchestrates all pipelines
│   ├── use-nuforc.ts        NUFORC manifest + chunk fetching
│   ├── use-hatch.ts         Hatch UDB manifest + chunk fetching
│   ├── use-chronology.ts    Chronology manifest + chunk fetching
│   ├── use-filter.ts        Non-blocking filter engine (5K chunk processing)
│   ├── use-app-store.ts     Signal-based reactive store
│   └── use-infinite-scroll.ts  IntersectionObserver pagination
├── scripts/
│   ├── process-nuforc.mjs   NUFORC pipeline (147K → year chunks)
│   ├── process-hatch.mjs    Hatch UDB pipeline (18K → year chunks)
│   ├── process-chronology.mjs  Chronology pipeline (28K → year/decade chunks)
│   └── shared-constants.mjs Location maps, country aliases, coordinates
├── types/                   Full TypeScript interfaces
├── enums/                   Continent, Shape, Status, DataSourceId
├── styles/                  Single CSS file, CSS variables
├── app.ts                   Orchestration — lifecycle phases, reactions
└── main.ts                  Entry point
```

---

## Getting Started

```bash
git clone https://github.com/mhdSid/uap-monitor.git
cd uap-monitor
npm install
npm run dev          # http://localhost:5173
```

### Load Data

```bash
# Create sources directory
mkdir -p __sources

# NUFORC (~191MB raw → ~25MB processed)
curl -L -o __sources/nuforc.json https://huggingface.co/datasets/kcimc/NUFORC/resolve/main/nuforc.json
node scripts/process-nuforc.mjs

# Hatch UDB (downloads automatically to __sources/)
node scripts/process-hatch.mjs --download

# Chronology — 10 researcher databases (downloads automatically to __sources/)
node scripts/process-chronology.mjs --download

npm run dev
```

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `node scripts/process-nuforc.mjs` | Process NUFORC into year chunks |
| `node scripts/process-hatch.mjs` | Process Hatch UDB into year chunks |
| `node scripts/process-chronology.mjs` | Process chronology into year/decade chunks |

### Deploy to GitHub Pages

The repo includes `.github/workflows/deploy.yml`. Set **Settings → Pages → Source** to **GitHub Actions** and push to `main`.

---

## Data Sources — Active

| Source | Type | Records | Period | Credibility Tier |
|---|---|---|---|---|
| **Eberhart** | Scholarly timeline | 5,900+ | 70 AD–2024 | Tier 1 |
| **NICAP** | Investigation org | 5,200+ | 1942–1975 | Tier 1 |
| **Johnson** | Date catalog | 4,100+ | 1900–2004 | Tier 2 |
| **Overmeire** | Belgian/French catalog | 4,000+ | 500 BC–2005 | Tier 3 |
| **Blue Book Unknowns** | Official USAF | 700+ | 1947–1969 | Tier 1 |
| **Hall (UFO Evidence)** | Evidence compilation | 600+ | 1947–2003 | Tier 1 |
| **Vallée (Magonia)** | Close encounters | 900+ | 1868–1968 | Tier 1 |
| **Wonders in the Sky** | Ancient/historical | 500+ | 70 AD–1879 | Tier 3 |
| **Pre-Roswell (Rife)** | Historical compilation | 5,000+ | 1880–1947 | Tier 3 |
| **Dolan** | National security focus | 300+ | 1941–2003 | Tier 2 |
| **NUFORC** | Public reports | 147,000+ | 1974–2024 | Per-record |
| **Hatch UDB** | Larry Hatch \*U\* DB | 18,000+ | 1942–2003 | Native scale |

## Data Sources — Planned

| Source | What It Adds | Priority |
|---|---|---|
| **NASA CNEOS** | Fireball/bolide events — cross-correlation | High |
| **OpenSky Network** | ADS-B flight tracks — automated debunking | High |
| **GDELT** | CJK/Russian UAP news, 15-min updates | Medium |
| **AARO** | US gov case database | Medium |
| **GEIPAN** | French gov classified cases | Medium |
| **ENIGMA** | INTCAT comprehensive catalog | Medium |
| **CJK Scraper** | Japanese, Chinese, Korean language sources | Long-term |

---

## Roadmap

### ✅ Shipped

- 12-source data aggregation (28K chronology + 147K NUFORC + 18K Hatch)
- Location parsing engine with 4 lookup maps (97%+ resolution rate)
- Per-record weighted credibility scoring
- Interactive Leaflet map with marker clustering
- Timeline density visualization with drag-to-select
- Country-level geographic filtering
- Year range selector (70 AD – 2024)
- Full-text search + shape/continent/country filters
- Continent-grouped sortable infinite-scroll grids
- Sighting detail modals
- Mobile responsive layout
- PWA with offline support
- CRT terminal aesthetic

### 🔜 Next

- Cross-source deduplication — flag probable duplicates across databases
- NASA CNEOS integration — first live data feed, fireball cross-correlation
- OpenSky cross-referencing — automated flight path debunking
- Geographic drill-down — click map to filter, draw-to-select
- Export — CSV/JSON of filtered results, shareable filter URLs
- GDELT news feed — CJK/Russian language UAP coverage

### 🔭 Horizon

- Real-time WebSocket updates
- CJK language source scrapers (Japan, China, Korea)
- AI-powered report analysis and credibility enhancement
- Temporal clustering and wave pattern detection
- 3D globe visualization

---

## License

MIT
