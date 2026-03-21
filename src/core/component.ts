/* ------------------------------------------------------------------ *
 *  UAP Monitor — Component base class                                 *
 *                                                                     *
 *  A minimal, type-safe foundation for building DOM components.       *
 *  Every UI element in the app extends this class, giving the         *
 *  codebase a consistent interface:                                   *
 *                                                                     *
 *    const c = new MyComponent(props)                                 *
 *    document.body.appendChild(c.el)   // the rendered DOM            *
 *    c.destroy()                       // clean up                    *
 *                                                                     *
 *  Lifecycle:                                                         *
 *    constructor(props) → create() → didMount() → … → destroy()      *
 *                                                                     *
 *  Design principles:                                                 *
 *    • One class = one root element (this.el)                         *
 *    • Props are readonly — rebuild to change                         *
 *    • didMount() for side effects (events, timers, subscriptions)    *
 *    • destroy() for cleanup (override and call super.destroy())      *
 *    • No framework magic — just DOM                                  *
 *                                                                     *
 *  Cleanup infrastructure:                                            *
 *    • own(disposer) — register any cleanup function (unsub, observer *
 *      disconnect, removeEventListener, etc.)                         *
 *    • ownChild(component) — register a child component for destroy   *
 *    • All disposers + children run automatically in destroy()        *
 * ------------------------------------------------------------------ */

/**
 * Abstract base for all UAP Monitor UI components.
 *
 * @typeParam P - Props interface. Defaults to empty object for prop-less components.
 */
export abstract class Component<P extends object = Record<string, never>> {
  /** The root DOM element. Stable for the lifetime of the component. */
  readonly el: HTMLElement

  private _disposed = false
  private _disposers: (() => void)[] | null = null
  private _children: Component[] | null = null

  constructor (protected readonly props: P) {
    this.el = this.create()
    this.didMount()
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  /** Build and return the root DOM element. Called once in the constructor. */
  protected abstract create(): HTMLElement

  /** Called immediately after create(). Bind events, start timers, etc. */
  protected didMount (): void {}

  /**
   * Remove the element and release all resources.
   * Runs all registered disposers and destroys all owned children.
   * Subclasses: always call super.destroy().
   */
  destroy (): void {
    if (this._disposed) return
    this._disposed = true

    // Run disposers (subscriptions, observers, listeners, effects)
    if (this._disposers) {
      for (const fn of this._disposers) fn()
      this._disposers = null
    }

    // Destroy owned child components
    if (this._children) {
      for (const child of this._children) child.destroy()
      this._children = null
    }

    this.el.remove()
  }

  // ─── Cleanup registration ─────────────────────────────────────────

  /**
   * Register a cleanup function to run on destroy.
   * Use for: signal.subscribe(), effect(), addEventListener on window/document,
   * ResizeObserver, IntersectionObserver, setInterval, etc.
   *
   * @returns The same disposer function (for chaining or conditional unsub).
   */
  protected own (disposer: () => void): () => void {
    if (!this._disposers) this._disposers = []
    this._disposers.push(disposer)
    return disposer
  }

  /**
   * Register a child component for automatic destroy() on parent destroy.
   * Use when a child has its own cleanup needs (Leaflet map, animation frame, etc.).
   *
   * @returns The child (for chaining).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected ownChild<C extends Component<any>> (child: C): C {
    if (!this._children) this._children = []
    this._children.push(child)
    return child
  }

  // ─── Queries ─────────────────────────────────────────────────────

  get disposed (): boolean {
    return this._disposed
  }

  /** Query a child element within this component's root. */
  protected query<T extends Element = HTMLElement> (selector: string): T | null {
    return this.el.querySelector<T>(selector)
  }

  /** Query all matching child elements. */
  protected queryAll<T extends Element = HTMLElement> (selector: string): T[] {
    return Array.from(this.el.querySelectorAll<T>(selector))
  }
}
