/* ------------------------------------------------------------------ *
 *  UAP Monitor — DOM utility layer                                    *
 *  A minimal, zero-dependency toolkit for building and patching DOM.   *
 * ------------------------------------------------------------------ */

// ─── Types ───────────────────────────────────────────────────────────

/** Anything that can appear as a child of h() / fragment(). */
export type DomChild = Node | string | number | null | undefined | false

/** Props accepted by h(). */
export interface DomProps {
  className?: string
  style?: Partial<CSSStyleDeclaration> | string
  dataset?: Record<string, string>
  [key: string]: unknown
}

// ─── Element creation ────────────────────────────────────────────────

/**
 * Create an HTMLElement with optional props and children.
 *
 *   h('div', { className: 'box' }, 'hello', childEl)
 *   h('span', 'just text')
 *   h('br')
 */
export function h (
  tag: string,
  propsOrChild?: DomProps | DomChild | null,
  ...children: DomChild[]
): HTMLElement {
  const node = document.createElement(tag)

  let allChildren: DomChild[]

  if (
    propsOrChild != null &&
    typeof propsOrChild === 'object' &&
    !(propsOrChild instanceof Node)
  ) {
    applyProps(node, propsOrChild as DomProps)
    allChildren = children
  } else {
    allChildren = [propsOrChild as DomChild, ...children]
  }

  appendChildren(node, allChildren)
  return node
}

/**
 * Backward-compatible alias preserving narrow return types
 * (e.g. HTMLTableElement, HTMLButtonElement).
 */
export function el<K extends keyof HTMLElementTagNameMap> (
  tag: K,
  attrs?: Record<string, string>,
  children?: (HTMLElement | string | null)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') {
        node.className = v
      } else {
        node.setAttribute(k, v)
      }
    }
  }
  if (children) {
    for (const child of children) {
      if (child === null) continue
      if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child))
      } else {
        node.appendChild(child)
      }
    }
  }
  return node
}

/** Create a plain text node. */
export function text (value: string | number): Text {
  return document.createTextNode(String(value))
}

/** Group children without a wrapper element. */
export function fragment (...children: DomChild[]): DocumentFragment {
  const frag = document.createDocumentFragment()
  appendChildren(frag, children)
  return frag
}

// ─── Mounting & children ─────────────────────────────────────────────

/** Replace all children of `parent` with a single child. */
export function mount (parent: HTMLElement, child: Node): void {
  clearChildren(parent)
  parent.appendChild(child)
}

/** Remove every child node from an element. */
export function clearChildren (node: Element | DocumentFragment): void {
  while (node.lastChild) node.removeChild(node.lastChild)
}

/** Atomically swap all children with new ones via DocumentFragment. */
export function replaceChildren (
  node: Element,
  ...children: DomChild[]
): void {
  const frag = document.createDocumentFragment()
  appendChildren(frag, children)
  clearChildren(node)
  node.appendChild(frag)
}

// ─── Visibility ──────────────────────────────────────────────────────

/** Hide an element (display: none). */
export function hide (node: HTMLElement): void {
  node.style.display = 'none'
}

/** Show a previously hidden element. Pass original display value if needed. */
export function show (node: HTMLElement, display = ''): void {
  node.style.display = display
}

/** Toggle visibility. Returns `true` when the element becomes visible. */
export function toggle (node: HTMLElement, display = ''): boolean {
  const hidden = node.style.display === 'none'
  node.style.display = hidden ? display : 'none'
  return hidden
}

// ─── Class helpers ───────────────────────────────────────────────────

export function addClass (node: Element, ...names: string[]): void {
  node.classList.add(...names)
}

export function removeClass (node: Element, ...names: string[]): void {
  node.classList.remove(...names)
}

export function toggleClass (
  node: Element,
  name: string,
  force?: boolean
): boolean {
  return node.classList.toggle(name, force)
}

export function hasClass (node: Element, name: string): boolean {
  return node.classList.contains(name)
}

// ─── Attributes ──────────────────────────────────────────────────────

/** Set / remove one or more attributes. null | undefined | false removes. */
export function setAttrs (
  node: Element,
  attrs: Record<string, string | number | boolean | null | undefined>
): void {
  for (const key in attrs) {
    const v = attrs[key]
    if (v == null || v === false) {
      node.removeAttribute(key)
    } else if (v === true) {
      node.setAttribute(key, '')
    } else {
      node.setAttribute(key, String(v))
    }
  }
}

// ─── HTML injection (safe & raw) ─────────────────────────────────────

/** Parse raw HTML into a DocumentFragment. No sanitisation — use with care. */
export function rawHtml (html: string): DocumentFragment {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  return tpl.content
}

const SAFE_TAGS = new Set([
  'strong', 'em', 'b', 'i', 'br', 'p', 'ul', 'ol', 'li',
  'span', 'div', 'a', 'code', 'pre', 'blockquote'
])
const SAFE_ATTRS = new Set([
  'style', 'class', 'href', 'target', 'rel'
])

/**
 * Like rawHtml() but strips tags and attributes not in the allow-list.
 * Ideal for rendering user-submitted NUFORC report text safely.
 */
export function safeHtml (html: string): DocumentFragment {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  const walk = (parent: Element | DocumentFragment) => {
    const nodes = Array.from(parent.childNodes)
    for (const node of nodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue
      const child = node as Element
      if (!SAFE_TAGS.has(child.tagName.toLowerCase())) {
        while (child.firstChild) parent.insertBefore(child.firstChild, child)
        parent.removeChild(child)
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        if (!SAFE_ATTRS.has(attr.name.toLowerCase())) {
          child.removeAttribute(attr.name)
        }
      }
      if (child.hasAttribute('href')) {
        const href = child.getAttribute('href') ?? ''
        if (
          !/^https?:\/\//i.test(href) &&
          !href.startsWith('/') &&
          !href.startsWith('#')
        ) {
          child.removeAttribute('href')
        }
      }
      walk(child)
    }
  }
  walk(tpl.content)
  return tpl.content
}

// ─── IDs ─────────────────────────────────────────────────────────────

/** Generate a short random id (8 chars, a-z0-9). */
export function generateId (): string {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Query helpers ───────────────────────────────────────────────────

/** querySelector that throws when nothing is found. */
export function qs<T extends Element = HTMLElement> (
  selector: string,
  parent: Element | Document = document
): T {
  const node = parent.querySelector<T>(selector)
  if (!node) throw new Error(`[dom] Element not found: ${selector}`)
  return node
}

/** querySelectorAll returning a real Array. */
export function qsa<T extends Element = HTMLElement> (
  selector: string,
  parent: Element | Document = document
): T[] {
  return Array.from(parent.querySelectorAll<T>(selector))
}

// ─── Internals ───────────────────────────────────────────────────────

function applyProps (node: HTMLElement, props: DomProps): void {
  for (const key in props) {
    const value = props[key]
    if (value == null || value === false) continue

    if (key === 'className') {
      node.className = value as string
    } else if (key === 'style') {
      if (typeof value === 'string') {
        node.style.cssText = value
      } else if (typeof value === 'object') {
        Object.assign(node.style, value)
      }
    } else if (key === 'dataset') {
      const ds = value as Record<string, string>
      for (const k in ds) {
        node.dataset[k] = ds[k]!
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(
        key.slice(2).toLowerCase(),
        value as EventListener
      )
    } else if (value === true) {
      node.setAttribute(key, '')
    } else {
      node.setAttribute(key, String(value))
    }
  }
}

function appendChildren (
  parent: Element | DocumentFragment,
  children: DomChild[]
): void {
  for (const child of children) {
    if (child == null || child === false) continue
    if (child instanceof Node) {
      parent.appendChild(child)
    } else {
      parent.appendChild(document.createTextNode(String(child)))
    }
  }
}
