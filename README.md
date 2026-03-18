# UAP Monitor

**The world's most comprehensive open-source UAP/UFO sighting aggregator.**

Live: [uapmonitor.org](https://uapmonitor.org)

238,000+ sighting reports from 15 verified sources across every continent, spanning from 70 AD to present. Zero frameworks. Vanilla TypeScript. Near-zero infrastructure cost.

---

## What It Does

UAP Monitor unifies the world's scattered UAP/UFO data into a single searchable, filterable, and shareable platform.

- **238,000+ sightings** from NUFORC, Hatch UDB, Eberhart's Chronology, NICAP, Vallée's Magonia, Blue Book Unknowns, Russian historical archives, and more
- **Real-time intelligence feed** merging GDELT, GNews, and X/Twitter
- **NASA fireball correlation** — CNEOS bolide data overlaid on the sighting map
- **Nuclear facility proximity** — 140+ reactors, weapons labs, test sites, and enrichment plants worldwide with distance analysis per sighting
- **Credibility scoring** per report
- **Offline geocoding** of 135K+ cities for coordinate resolution
- **Share URLs** — link directly to any sighting with `?s=id&y=year`
- **Bookmarks** — save sightings locally, browse via header radar icon

## Architecture

No React. No Vue. No Next.js. Built entirely on the web platform.

### Core (~3KB runtime)

- **`Component<Props>`** — class-based lifecycle: `create()` → `didMount()` → `destroy()`
- **Signal store** — `signal()`, `computed()`, `effect()`, `batch()` with microtask-coalesced effects and dependency tracking
- **DOM utilities** — `h()`, `el()`, `addClass()`, `setStyles()`, `setAttrs()`, `hide()`, `show()` — every DOM operation in the app goes through `dom.ts`

### Design System

- **Tokens** — CSS custom properties for spacing (base-2 scale), typography, colors, radii, transitions, z-index, shadows
- **cx files** — every component has a `cx.ts` mapping semantic names to BEM class strings
- **Enums** — `ComponentSize`, `ButtonSize`, `SightingShape`, `TagVariant`, `DataSourceId` — no string literals
- **Light/dark** — full theme support via `[data-theme]` attribute, all components adapt
- **Palette** — JS-side color constants for canvas/Leaflet contexts that can't use CSS vars

### Strict Rules (enforced everywhere)

1. **ALL DOM ops** via `dom.ts` utilities — never raw `el.style.*`, `el.classList.*`, `document.createElement`, `.setAttribute()` in components
2. **ALL values** use design tokens — never hardcode px/colors/fonts
3. **ALL sizes** use enums — never string literals
4. **ALL strings** defined in `src/data/strings.ts` — never in components or composables
5. **ALL components** use cx files with light/dark support

### Data Pipeline

```
scripts/
  process-nuforc.mjs      ← 151K sightings, dedup, geocode, chunk by year
  process-hatch.mjs        ← 18K researcher-curated cases (70 AD–2002)
  process-chronology.mjs   ← 28K from 10 sub-sources (Eberhart, NICAP, Magonia...)
  process-russian-historical.mjs
  nuforc-scrapper/         ← Tor-proxied NUFORC scraper with --resume/--merge
  geocoder.mjs             ← 135K city index, 25+ alias mappings
  gdelt/fetch.mjs          ← Time-windowed, tone-banded GDELT fetcher
  gnews/fetch.mjs          ← Paginated GNews with query rotation
  twitter/fetch.mjs        ← Twitter v2 API with author data + media
  nuclear/fetch.mjs        ← 140+ worldwide nuclear facilities dataset
  shared-constants.mjs     ← Dedup, noise filter, merge utilities
```

### Component Tree

```
App
├── Header (clock, bookmarks trigger, theme switch)
├── Ticker (auto-rotating sighting feed)
├── Hero + Highlights Carousel
├── YearSelector + FilterToolbar (desktop inline / mobile drawer+FAB)
├── SightingGrids (per-continent, infinite scroll, inline search)
│   └── DataGrid<Sighting> (sortable, PAGE_SIZE=20)
├── Timeline (canvas density bar, drag-select year range)
├── SightingMap (Leaflet + MarkerCluster)
│   ├── Sightings layer (green)
│   ├── Fireballs layer (orange)
│   └── Nuclear layer (amber trefoil icons)
├── NewsFeed (GDELT + GNews + Twitter merged)
│   └── DataGrid<IntelArticle>
├── SubmitForm (→ Cloudflare KV)
├── DataSources (status cards)
└── Footer
```

### Modals

- **SightingModal** — status bar, metadata, related fireballs, related news, nearby nuclear facilities, bookmark + share buttons
- **GdeltModal** / **GnewsModal** / **TwitterModal** — article detail with async image, metadata, source link
- **BookmarksModal** — saved sightings list with action menu (remove, share)
- **WelcomeModal** — data loading, source stats, CTA

### Composables

| Composable | Purpose |
|------------|---------|
| `use-store` | Signal/computed/effect/batch primitives |
| `use-app-store` | Singleton AppStore with all reactive state |
| `use-data-source` | Orchestrates 3 source loaders |
| `use-nuforc` / `use-hatch-udb` / `use-chronology` | Manifest + chunk loaders |
| `use-gdelt` / `use-gnews` / `use-twitter` | Article loaders via `createArticleLoader` |
| `use-fireball` | NASA CNEOS data + proximity search |
| `use-nuclear` | Nuclear facilities + proximity search |
| `use-bookmarks` | localStorage persistence + reactive signals |
| `use-share` | URL params (`?s=id&y=year`) + clipboard/native share |
| `use-local-storage` | Generic JSON get/set/remove |
| `use-delayed-load` | Deferred callback after page load + delay |
| `use-analytics` | GTM injection via `useDelayedLoad` |
| `use-theme` | Dark/light toggle with persistence |
| `use-media-query` | SP/PC breakpoint detection |
| `use-welcome-sources` | Derive stats from loaded data for welcome modal |

### Reusable Components (Atoms)

`Button`, `Select`, `TextInput` (clearable), `Checkbox` / `CheckboxGroup`, `Switch`, `Tag` / `StatusTag` / `LiveTag`, `Tooltip`, `ActionMenu`, `BookmarkButton`, `ShareButton`, `AsyncImage`, `Loader`, `Alert`, `Toast`, `Drawer`, `Modal`, `DataGrid<T>`

## Deployment

See [DEPLOY.md](./DEPLOY.md) for full Cloudflare Pages + KV setup.

```bash
yarn install
yarn build
wrangler pages deploy dist
```

## Data Sources

| Source | Records | Period | Status |
|--------|---------|--------|--------|
| NUFORC | 151,848 | 1950–2026 | Online |
| Hatch UDB | 18,116 | 70 AD–2002 | Online |
| Chronology (10 sub-sources) | 28,228 | 70 AD–2023 | Online |
| Russian Historical | 20 | 1663–2025 | Online |
| GDELT News | ~1,250 | Rolling 90 days | Syncing |
| GNews | ~500 | Rolling 14 days | Syncing |
| X / Twitter | ~500 | Rolling 7 days | Syncing |
| NASA CNEOS Fireballs | 900+ | 1988–present | Online |
| Nuclear Facilities | 140+ | Current | Online |
| AARO | — | — | Planned |
| GEIPAN | — | — | Planned |
| CJK Scraper | — | — | Planned |

## Tech Stack

- **Language:** TypeScript (strict)
- **Bundler:** Vite
- **Hosting:** Cloudflare Pages (free tier)
- **Storage:** Cloudflare Workers KV (free tier)
- **Map:** Leaflet + MarkerCluster
- **Dependencies:** Zero UI frameworks. Leaflet is the only runtime dependency with DOM access.

## License

MIT.
