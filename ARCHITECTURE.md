# Architecture

Technical reference for the UAP Monitor frontend. Companion to [`ONBOARDING.md`](./ONBOARDING.md) (rules and patterns) and [`DATA_PIPELINE.md`](./DATA_PIPELINE.md) (data ingestion + statistics).

---

## 1. High-level shape

```
┌───────────────────────────────────────────────────────────────┐
│                       Cloudflare Worker                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Static SPA shell (Vite build, PWA)                     │  │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────────┐    │  │
│  │  │  main.ts   │→ │   Router   │→ │  Lazy views     │    │  │
│  │  └────────────┘  └────────────┘  └─────────────────┘    │  │
│  │         │              │                  │             │  │
│  │         ▼              ▼                  ▼             │  │
│  │     Stores         History API        Components        │  │
│  │   (signals)                          (Component base)   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                │
│                              ▼                                │
│         /public/data/*.json  (sightings, hypotheses,          │
│                                geomagnetic, seismic, …)       │
└───────────────────────────────────────────────────────────────┘
```

- **No framework.** All UI is built on a custom `Component` class and an `h()` factory.
- **Reactivity is signals.** `signal`, `computed`, `effect`, `batch`.
- **Routing is History API**, with lazy view modules.
- **Hosting is Cloudflare Workers** serving the built SPA shell + static JSON.
- **PWA-enabled** via Vite's PWA plugin.

---

## 2. The `Component` system

### 2.1 Lifecycle

```ts
abstract class Component {
  el!: HTMLElement

  create   ()       // build DOM, assign this.el
  didMount ()       // post-attach work (layout reads, observers)
  destroy  ()       // cleanup (auto-runs ownChild / own disposers)
}
```

- `create()` is where the DOM tree is built and assigned to `this.el`.
- `didMount()` runs after the element is in the document. Safe to read layout, attach `ResizeObserver`, etc.
- `destroy()` is invoked by the parent (or router). Owned children and `own()` disposers are cleaned up automatically.

### 2.2 The class-field initialization trap

```ts
class Bad extends Component {
  items: Item[] = []        // ← runs AFTER super(), wipes anything create() set
  create () { this.items = loadInitial() }   // overwritten!
}

class Good extends Component {
  items!: Item[]
  create () { this.items = loadInitial() }   // safe
}
```

Use the `!:` "definite assignment" pattern. Always.

### 2.3 Ownership

Two complementary helpers:

| Helper        | When                                                                                  |
|---------------|---------------------------------------------------------------------------------------|
| `ownChild(c)` | `c` is a child component **you** instantiated. Its lifecycle follows yours.           |
| `own(off)`    | `off` is a cleanup for a subscription to a **persistent external** (window, store, …).|

DOM refs as class fields do **not** need `own()` — the GC handles them when the component is destroyed.

```ts
create () {
  this.button = this.ownChild(new Button({ … }))

  this.own(this.store.selected.subscribe(this.onChange))
  this.own(addEventListener('resize', this.onResize))
}
```

### 2.4 The `h()` factory

```ts
h(tag, props?, ...children)
```

- `tag`: string or component class.
- `props`: `{ class, style, dataset, on:click, … }`.
- `children`: nodes, strings, or arrays.

**Single-append rule:** build one nested tree, append once.

```ts
this.el = h('section', { class: cx.root },
  h('header', { class: cx.head },
    h('h2', { class: cx.title }, strings.seismic.title),
  ),
  h('div', { class: cx.body }, this.chart.el),
)
```

Chained `appendChild` calls fragment ownership and obscure structure. Don't.

### 2.5 The `Card` focus-return caveat

`Card`'s `onClick` prop introduces an indirection that breaks `document.activeElement` → trigger return when a modal closes. For clickable cards that open modals, mirror the `DataGrid` row pattern:

```ts
this.el.tabIndex = 0
this.el.addEventListener('click',   this.openModal)
this.el.addEventListener('keydown', this.onKey)   // Enter / Space
```

The opened modal will then return focus to `this.el` on close.

### 2.6 `isConnected`, not retry loops

Deferred work (scroll, measure) should guard, not poll:

```ts
// in setActive() or another established call site
if (!this.el.isConnected) return
this.el.scrollIntoView({ block: 'center' })
```

Adding `requestAnimationFrame` retry chains for a single one-shot operation is an anti-pattern.

---

## 3. Signals

The reactive primitive. Lightweight, synchronous, batchable.

```ts
import { signal, computed, effect, batch } from '@/core/signals'

const count   = signal(0)
const doubled = computed(() => count.value * 2)

const stop = effect(() => {
  render(doubled.value)
})

batch(() => {
  count.value = 1
  count.value = 2          // effect runs once, with value 4
})

stop()                     // disposes the effect
```

Conventions:
- `effect` returns a disposer. Register it with `own()`.
- `computed` is lazy; reading `.value` triggers re-evaluation only when dependencies changed.
- Mutations outside `batch` fire effects immediately. Use `batch` when updating ≥2 related signals.

---

## 4. Routing

`useRouter<K>` is a composable that owns the full lifecycle of the view it returns. Concretely:

- Reads the current path
- Lazy-imports the matching view module
- Calls `create()` → mounts → `didMount()`
- On navigation, calls `destroy()` on the outgoing view, then mounts the next

Views are keyed by a closed union `K` (e.g. `'monitor' | 'geomagnetic' | 'seismic' | 'intel' | 'spiritual' | 'research'`). The router enforces exhaustiveness — adding a route means updating the union, the registry, and the navigation surface in one go.

Navigation is plain History API (`pushState` / `popstate`). No hash routing.

---

## 5. Views

A view is a thin orchestrator. Its job is to:

1. Compose **high-level components** (already built atoms / molecules).
2. Subscribe to the relevant stores.
3. Wire user interactions (handlers that call store methods).
4. Clean up on destroy.

A view does **not**:
- Construct atoms inline (`h('button', …)`)
- Construct molecules inline (a `Card`-shaped `div`)
- Hold business logic that belongs in a store

Each route's view lives in `src/views/<route>/`. The `Research` view is a good reference for composition patterns; the `Seismic` view is a good reference for chart/Alert/data composition.

---

## 6. Stores

State that's shared across views lives in singleton stores under `src/stores/`. A store exposes signals as its read surface and methods as its write surface.

```ts
// pattern
export const sightingsStore = {
  items:    signal<Sighting[]>([]),
  loading:  signal(false),

  async load () {
    this.loading.value = true
    this.items.value   = await fetchSightings()
    this.loading.value = false
  },
}
```

Components subscribe via `effect`, written through methods only. Don't mutate `items.value` from a view.

---

## 7. Design system

### 7.1 Tokens

All visual values are CSS custom properties defined in `src/styles/`. Categories:

- `--color-*`         palette and semantic colors
- `--surface-*`       layered backgrounds
- `--text-*`          foreground variants
- `--space-*`         spacing scale
- `--radius-*`        corner radii
- `--shadow-*`        elevation
- `--font-*`          family / size / weight
- `--ease-*`, `--dur-*`  motion

Theming is variable swapping — light/dark are sibling tokensets, not separate stylesheets.

### 7.2 Naming

BEM. Class names live in per-component `cx.ts`:

```ts
// src/components/Alert/cx.ts
export const cx = {
  root:    'alert',
  info:    'alert--info',
  warn:    'alert--warn',
  title:   'alert__title',
  body:    'alert__body',
  dismiss: 'alert__dismiss',
}
```

No inline class string literals anywhere else.

### 7.3 Strings

`src/data/strings.ts`, namespaced by domain. No user-facing literal anywhere else.

---

## 8. Component catalog

Atoms / molecules currently in `src/components/`:

`Button`, `Tag`, `Chip`, `ChipGroup`, `Alert`, `Modal`, `Card`, `DataGrid`, `HypothesisModal`, …

Before creating anything new:

```bash
ls src/components/
```

If something close exists, extend it. If you must create, follow the existing folder convention: `ComponentName/{index.ts, ComponentName.ts, cx.ts, styles.css}`.

---

## 9. Visualization layer

- **Maps:** Leaflet, wrapped in components. Don't reach into the raw map instance from a view.
- **Charts:** built directly with SVG + signals. The Seismic view uses a **2D density heatmap** (`BINS_X = 24`, `BINS_Y = 16`) with a cyan → amber → red ramp produced by `lerp3` / `heatColor`.
- **Spiritual view:** generative canvas; treat it as an isolated experiment, not a chart pattern to reuse.

---

## 10. Analytics

Google Analytics 4 with a custom event taxonomy:

- `sighting_viewed`
- `sighting_dismissed`
- `welcome_modal_closed`
- `form_start`

Events are fired through a small wrapper, not `gtag` directly. New events go through the wrapper and are documented alongside the taxonomy.

---

## 11. Build & deploy

- **Dev:** `pnpm dev` (Vite HMR).
- **Build:** `pnpm build` produces a static SPA shell + assets.
- **PWA:** generated by the Vite PWA plugin. Service worker caches the shell and core data files.
- **Deploy:** `pnpm deploy` pushes to Cloudflare Workers.

Performance posture:

- **LCP bottleneck is network**, not CPU. Sequential large JSON requests block first paint.
- The fix is **shell-first rendering** — paint the chrome immediately, hydrate data on arrival.
- Web workers are **not** the LCP fix.
- Lazy-load every view. Don't import a view module from `main.ts`.

---

## 12. Anti-patterns recap

| Don't                                                | Do                                                    |
|------------------------------------------------------|-------------------------------------------------------|
| Inline string literals for UI text                   | Import from `src/data/strings.ts`                     |
| Inline class strings                                 | Import from the component's `cx.ts`                   |
| Native interactive elements in views                 | Use existing components (`Button`, `Chip`, …)         |
| Construct atoms / molecules inline in views          | Compose existing components                           |
| Class-field initializers for state                   | `!:` and assign in `create()`                         |
| `Card.onClick` + modal                               | Wire `tabIndex` + click + keydown on `el` directly    |
| `requestAnimationFrame` retry loops for mount timing | `isConnected` guard at the established call site      |
| Hardcoded colors / spacing                           | CSS variables                                         |
| `chained appendChild`                                | Nested `h()`, single append                           |
| Mutating store signals from outside the store        | Call a store method                                   |

---

## 13. Reading order for a new contributor

1. `src/core/component.ts`  — the base class
2. `src/core/signals.ts`    — reactivity
3. `src/core/h.ts`          — DOM factory
4. `src/core/router.ts`     — routing + view lifecycle
5. `src/data/strings.ts`    — string namespace
6. `src/styles/tokens.css`  — design tokens
7. `src/components/Button/` — a minimal component reference
8. `src/components/DataGrid/` — a non-trivial component reference
9. `src/views/research/`    — a good view composition reference

If filenames differ slightly, follow the imports.
