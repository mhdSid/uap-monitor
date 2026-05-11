# Onboarding

This guide is for new contributors **and for Claude Code instances** picking up work in this repo. Read it end-to-end before writing any code.

If you skip the rules section, your PR will be rejected. The codebase is well-architected; consistency is the point.

---

## 1. Mental model in 60 seconds

- **Vanilla TypeScript SPA.** No React, no framework. We use a custom `Component` base class.
- **Signals are the reactive layer.** `signal`, `computed`, `effect`, `batch`. Familiar if you've used Solid or Preact signals.
- **Views orchestrate components, never molecules or atoms directly.** A view assembles high-level components and wires up the store. It does not construct `<div>`s inline.
- **Every user-facing string lives in `src/data/strings.ts`.** No exceptions.
- **Every class name lives in a per-component `cx.ts` file.** No string literals in JSX-equivalent calls.
- **The design system is CSS variables.** No hardcoded colors, no hardcoded spacing.

---

## 2. Setup

```bash
git clone https://github.com/mhdSid/uap-monitor.git
cd uap-monitor
pnpm install
pnpm dev   # local dev on Vite
```

Build:

```bash
pnpm build
pnpm preview
```

Deploy (Cloudflare Workers):

```bash
pnpm deploy
```

Lint (run before every commit):

```bash
pnpm lint
```

ESLint will reject:
- Dangling commas
- Semicolons
- Missing space before function parens
- Anonymous string literals in user-facing positions

Respect all existing ESLint rules — read `.eslintrc` before assuming a rule doesn't exist.

---

## 3. Coding rules — non-negotiable

These rules are why the codebase is maintainable. Violating them is the fastest way to get changes rolled back.

### 3.1 No anonymous strings

User-facing text **must** import from `src/data/strings.ts`:

```ts
// ❌ wrong
new Button({ label: 'Submit' })

// ✅ right
import { strings } from '@/data/strings'
new Button({ label: strings.common.submit })
```

Class names **must** come from a per-component `cx.ts`:

```
src/components/Button/
├── Button.ts
├── cx.ts          ← class name constants live here
└── styles.css
```

```ts
// ❌ wrong
h('div', { class: 'card card--elevated' })

// ✅ right
import { cx } from './cx'
h('div', { class: cx.card })
```

### 3.2 Never use native HTML elements directly without asking

Before writing `h('button', …)`, `h('input', …)`, `h('select', …)`, **stop**. Ask whether a `Button`, `Input`, `Select` component should exist (or already exists).

Existing components to check first:
`Button`, `Tag`, `Alert`, `Modal`, `Card`, `Chip`, `ChipGroup`, `DataGrid`, `HypothesisModal` (and likely more — `ls src/components/` before assuming).

Native elements are acceptable for layout primitives (`div`, `section`, `span`, `ul`, `li`, etc.) inside a component's own implementation. They are **not** acceptable as interactive elements in a view.

### 3.3 Design system only

Colors, spacing, typography, radii, shadows — all come from CSS variables defined in `src/styles/`. If a value doesn't exist as a token, the answer is to add a token, not inline a literal.

```css
/* ❌ wrong */
.card { background: #1a1a1a; padding: 16px; }

/* ✅ right */
.card { background: var(--surface-1); padding: var(--space-3); }
```

### 3.4 Views orchestrate, components implement

Views compose high-level components. They never:
- Construct atoms (`h('button', …)`) inline
- Construct molecules (`h('div', { class: 'card' }, …)`) inline
- Inline styling
- Reach into another component's internals

If a view feels like it needs to inline something, the answer is usually to make a new component or extend an existing one.

### 3.5 Reuse before creating

Before creating a new component, search `src/components/` for something close. Extend before duplicating. If you create a new component, it must follow the existing folder pattern (`ComponentName/`, `cx.ts`, `styles.css`, `index.ts`).

---

## 4. Component patterns (the ones you'll trip on)

### 4.1 Lifecycle

```ts
class MyThing extends Component {
  // ❌ class-field initialization runs AFTER super(),
  //    overwriting anything create() populated
  private items: Item[] = []

  // ✅ use the bang pattern — assigned in create()
  private items!: Item[]

  create () {
    this.items = []
    this.el = h('div', { class: cx.root })
  }

  didMount () {
    // safe to query layout, attach observers, etc.
  }

  destroy () {
    // cleanup
  }
}
```

### 4.2 Ownership: `ownChild` vs `own`

- **`ownChild(child)`** — for components you created that have external listeners or resources. Lifecycle is yours; you destroy them.
- **`own(unsubscribe)`** — for inbound references from persistent external objects (window, document, store singletons, browser observers). Returns a cleanup you register.
- **DOM refs stored as class fields** do **not** need `own()`.

Rule of thumb: if it would leak when you're destroyed, it needs ownership.

### 4.3 Single append rule

Prefer one nested `h()` tree appended once over chained `appendChild` calls:

```ts
// ❌ wrong
this.el = h('div')
this.el.appendChild(h('h1', null, title))
this.el.appendChild(h('p', null, body))

// ✅ right
this.el = h('div', { class: cx.root },
  h('h1', { class: cx.title }, title),
  h('p',  { class: cx.body  }, body),
)
```

### 4.4 Focus return through `Card`

`Card` accepts an `onClick` prop. That indirection breaks the trigger-reference chain that modals rely on to return focus. **Do not** rely on `Card`'s `onClick` for elements that open modals.

Instead, wire it directly on `el`, matching the `DataGrid` row pattern:

```ts
// ✅ pattern for clickable card that opens a modal
this.el.tabIndex = 0
this.el.addEventListener('click', this.openModal)
this.el.addEventListener('keydown', this.onKey)
```

### 4.5 `isConnected` guard, not retry loops

When deferring work until after mount (scroll-into-view, layout reads):

```ts
// ❌ wrong — rAF retry chains
const tick = () => {
  if (!this.el.offsetParent) return requestAnimationFrame(tick)
  this.el.scrollIntoView()
}

// ✅ right — guard at the established call site (e.g. setActive)
if (!this.el.isConnected) return
this.el.scrollIntoView()
```

### 4.6 `Alert` for dismissible explanations

Plain-language explanations on data-heavy views use the `Alert` component (dismissible, design-system aware). Don't roll your own banner.

---

## 5. State, routing, signals

### 5.1 Signals

```ts
import { signal, computed, effect, batch } from '@/core/signals'

const count = signal(0)
const doubled = computed(() => count.value * 2)

effect(() => {
  console.log(doubled.value)
})

batch(() => {
  count.value = 1
  count.value = 2   // effect fires once
})
```

### 5.2 Router

`useRouter<K>(key)` owns the full lifecycle of the view it returns. Views are lazy-loaded. Routes are declared in one place — search for `defineRoutes` (or the equivalent registry) before adding a new route.

### 5.3 Stores

Global state lives in singleton stores exposing signals. Components read via `effect` and write via store methods. Don't mutate store signals from outside the store.

---

## 6. Strings & class names

### `src/data/strings.ts`

Namespaced by domain:

```ts
export const strings = {
  common: { submit: '…', cancel: '…' },
  monitor: { title: '…', recentSightings: '…' },
  seismic: { headline: '…', explainer: '…' },
  // …
}
```

When adding a feature, add strings first. Don't write `'Submit'` and "fix it later."

### Per-component `cx.ts`

```ts
// src/components/Card/cx.ts
export const cx = {
  root:      'card',
  elevated:  'card--elevated',
  title:     'card__title',
  body:      'card__body',
}
```

BEM is the convention. Match it.

---

## 7. Working with tarballs

When given a tar of the codebase:

1. **Parse and tokenize the architecture first.** Extract, list, read entry points, follow imports.
2. **Do not assume structure.** Open `src/components/` and look. Open `src/views/` and look.
3. **Find the existing pattern before writing.** Almost everything you need has a precedent.
4. **Return only changed files**, not a full rebuild. Tar back what was actually modified.

The owner pushes back hard on:
- Guessing at structure
- Assuming a component doesn't exist
- Repeating an incorrect diagnosis

If something is unclear, read the source. Don't pattern-match from other codebases.

---

## 8. Data pipeline & hypotheses

See [`DATA_PIPELINE.md`](./DATA_PIPELINE.md) for:
- Source adapters
- Normalized schema
- Hypothesis runner (seeded, time-shifted controls, population-density-corrected nulls)
- Output format (`public/data/hypotheses.json`)
- Self-correction workflow

**Important:** `new Date().toISOString()` must never overwrite a publication date on a re-run. Idempotency is required.

---

## 9. Performance notes

- **LCP bottleneck is network**, not CPU. Sequential large JSON downloads block first paint. The fix is **shell-first rendering**, not web workers.
- Lazy-load views.
- Don't preload datasets a route doesn't need.

---

## 10. Community-facing work

Reddit / X / Reddit-style posts written about findings:
- Plain language, no jargon (no χ², no "effect size of d = 0.4 …")
- Conversational framing
- Invite participation
- Platform link is secondary to the finding itself

The tone is deliberately friendly and non-authoritative. Match it.

---

## 11. When in doubt

- Read the source.
- Find the precedent.
- Ask before introducing a new pattern.
- Prefer extending an existing component over creating a new one.
- Discuss approach before implementation — but keep planning short.

Welcome aboard.
