import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  DataGrid<T> — sortable, infinitely-scrolling table component       *
 *                                                                     *
 *  Usage:                                                             *
 *    const grid = new DataGrid<Sighting>({ columns, data, onRowClick })
 *    container.appendChild(grid.el)                                   *
 *    grid.scrollToItem(s => s.id === '123')                           *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { Tooltip } from '@/components/tooltip'
import type { DataGridProps } from '@/types'
import { h, el, addClass, removeClass, clearChildren, setAttrs, fragment } from '@/utils/dom'
import { useInfiniteScroll } from '@/composables/use-infinite-scroll'
import { iconSortDefault, iconSortAsc, iconSortDesc } from '@/components/icons'
import { FILTER } from '@/data/strings'

// ─── Types ──────────────────────────────────────────────────────────

type SortDirection = 'asc' | 'desc' | 'none'

interface SortState {
  key: string
  direction: SortDirection
}

const SORT_ICON_FACTORIES: Record<SortDirection, (() => SVGSVGElement) | null> = {
  none: null,
  asc: iconSortAsc,
  desc: iconSortDesc
}

const PAGE_SIZE = 20
const CELL_PAD = '8px'
const CELL_PAD_COMPACT = '4px'

// ─── DataGrid class ─────────────────────────────────────────────────

export class DataGrid<T> extends Component<DataGridProps<T>> {
  private sortState!: SortState
  private currentData!: T[]
  private rowMap!: WeakMap<object, HTMLTableRowElement>
  private headerCells!: HTMLTableCellElement[]
  private tbody!: HTMLTableSectionElement
  private sentinel!: HTMLElement
  private scroll!: ReturnType<typeof useInfiniteScroll<T>>

  // ─── Lifecycle ──────────────────────────────────────────────────

  protected create(): HTMLElement {
    // Init fields here — field initializers run AFTER super(), but
    // create() runs DURING super(), so we must self-initialize.
    this.sortState = { key: '', direction: 'none' }
    this.rowMap = new WeakMap()
    this.headerCells = []
    this.currentData = [...this.props.data]

    const { columns } = this.props

    const wrapper = h('div', { className: cx.wrapper })
    const table = el('table', { className: cx.root })

    // Header
    const thead = el('thead')
    const headerRow = el('tr')

    this.headerCells = columns.map((col) => {
      const th = el('th', { className: cx.th })

      if (col.align === 'right') addClass(th, cx.thRight)
      else if (col.align === 'center') addClass(th, cx.thCenter)

      if (col.width) th.style.width = col.width
      th.style.padding = `${CELL_PAD_COMPACT} ${CELL_PAD}`

      if (col.tooltip) {
        th.textContent = col.label
        const tip = new Tooltip({ content: col.tooltip, html: true, ariaLabel: col.label + ' info' })
        th.appendChild(tip.el)
      } else {
        th.textContent = col.label
      }

      if (col.sortable !== false && col.label) {
        addClass(th, cx.thSortable)
        this.setSortIcon(th, col, 'hint')
        th.addEventListener('click', () => this.handleSort(col.key as string, th))
      }

      headerRow.appendChild(th)
      return th
    })

    thead.appendChild(headerRow)

    // Body & sentinel
    this.tbody = el('tbody')
    this.sentinel = h('div', { className: cx.sentinel })

    // Infinite scroll
    this.scroll = useInfiniteScroll<T>(PAGE_SIZE, (state) => {
      this.rebuildRows(state.visibleItems)
      this.sentinel.style.display = state.hasMore ? '' : 'none'
    })

    table.appendChild(thead)
    table.appendChild(this.tbody)
    wrapper.appendChild(table)
    wrapper.appendChild(this.sentinel)

    this.scroll.setItems(this.currentData)

    return wrapper
  }

  protected didMount(): void {
    requestAnimationFrame(() => this.scroll.observe(this.sentinel, this.el))
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Find the first item matching predicate, expand scroll, and focus it.
   */
  scrollToItem(predicate: (item: T) => boolean): boolean {
    const idx = this.currentData.findIndex(predicate)
    if (idx === -1) return false

    this.scroll.expandTo(idx)

    const item = this.currentData[idx]
    const tr = (typeof item === 'object' && item !== null)
      ? this.rowMap.get(item as object)
      : undefined

    if (!tr) return false

    this.el.scrollIntoView({ behavior: 'smooth', block: 'start' })

    setTimeout(() => {
      tr.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (!tr.hasAttribute('tabindex')) setAttrs(tr, { tabindex: '-1' })
      tr.focus({ preventScroll: true })
    }, 400)

    return true
  }

  // ─── Row rendering ─────────────────────────────────────────────

  private rebuildRows(items: T[]): void {
    clearChildren(this.tbody)

    if (items.length === 0) {
      const emptyCell = el('td', {
        className: cx.empty,
        colSpan: String(this.props.columns.length)
      })
      emptyCell.textContent = this.props.emptyText ?? FILTER.EMPTY_DEFAULT
      const emptyRow = el('tr')
      emptyRow.appendChild(emptyCell)
      this.tbody.appendChild(emptyRow)
      return
    }

    const frag = fragment()
    for (const item of items) {
      const tr = this.renderRow(item)
      if (typeof item === 'object' && item !== null) {
        this.rowMap.set(item as object, tr)
      }
      frag.appendChild(tr)
    }
    this.tbody.appendChild(frag)
  }

  private renderRow(row: T): HTMLTableRowElement {
    const { columns, onRowClick } = this.props
    const tr = el('tr', { className: cx.row })

    for (const col of columns) {
      const td = el('td', { className: cx.td })

      if (col.align === 'right') addClass(td, cx.tdRight)
      else if (col.align === 'center') addClass(td, cx.tdCenter)

      if (col.width) td.style.width = col.width
      td.style.padding = `${CELL_PAD_COMPACT} ${CELL_PAD}`

      if (col.render) {
        const rendered = col.render(row)
        if (typeof rendered === 'string') td.textContent = rendered
        else td.appendChild(rendered)
      } else {
        const key = col.key as keyof T
        td.textContent = String(row[key] ?? '')
      }

      tr.appendChild(td)
    }

    if (onRowClick) {
      addClass(tr, cx.rowClickable)
      setAttrs(tr, { tabindex: '0', role: 'button' })

      const id = (row as Record<string, unknown>).id
      if (id != null) tr.dataset.sightingId = String(id)

      tr.addEventListener('click', () => onRowClick(row, tr))
      tr.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRowClick(row, tr)
        }
      })
    }

    return tr
  }

  // ─── Sorting ───────────────────────────────────────────────────

  private handleSort(key: string, clickedTh: HTMLTableCellElement): void {
    let newDir: SortDirection = 'asc'
    if (this.sortState.key === key) {
      if (this.sortState.direction === 'asc') newDir = 'desc'
      else if (this.sortState.direction === 'desc') newDir = 'none'
    }

    this.sortState = { key, direction: newDir }

    const { columns } = this.props

    for (let i = 0; i < this.headerCells.length; i++) {
      const col = columns[i]
      const isSortable = col.sortable !== false && col.label
      removeClass(this.headerCells[i], cx.thSorted)

      if (isSortable) this.setSortIcon(this.headerCells[i], col, 'hint')
      else {
        clearChildren(this.headerCells[i])
        this.headerCells[i].textContent = col.label
      }
    }

    if (newDir !== 'none') {
      const idx = this.headerCells.indexOf(clickedTh)
      this.setSortIcon(clickedTh, columns[idx], newDir)
      addClass(clickedTh, cx.thSorted)
    }

    if (newDir === 'none') {
      this.currentData = [...this.props.data]
    } else {
      this.currentData = [...this.props.data].sort((a, b) => {
        const cmp = DataGrid.compareValues(a, b, key)
        return newDir === 'desc' ? -cmp : cmp
      })
    }

    this.scroll.setItems(this.currentData)
  }

  private setSortIcon(th: HTMLTableCellElement, col: { label: string; tooltip?: string }, direction: SortDirection | 'hint'): void {
    clearChildren(th)
    th.textContent = col.label

    if (col.tooltip) {
      const tip = new Tooltip({ content: col.tooltip, html: true, ariaLabel: col.label + ' info' })
      th.appendChild(tip.el)
    }

    if (direction === 'hint') {
      const icon = iconSortDefault()
      addClass(icon, cx.sortIcon, cx.sortIconHint)
      th.appendChild(icon)
    } else {
      const factory = SORT_ICON_FACTORIES[direction]
      if (factory) {
        const icon = factory()
        addClass(icon, cx.sortIcon)
        th.appendChild(icon)
      }
    }
  }

  private static compareValues<T>(a: T, b: T, key: string): number {
    const aVal = (a as Record<string, unknown>)[key]
    const bVal = (b as Record<string, unknown>)[key]

    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1

    if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal
    return String(aVal).localeCompare(String(bVal))
  }
}
