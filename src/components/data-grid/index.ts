import type { DataGridProps, DataGridColumn } from '@/types'
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
  desc: iconSortDesc,
}

const PAGE_SIZE = 20

// ─── Cell padding constant (shared by th and td) ────────────────────

const CELL_PAD = '8px'
const CELL_PAD_COMPACT = '4px'

// ─── Sort icon helpers ──────────────────────────────────────────────

/** Replace the sort icon inside a header cell (DOM-based, no innerHTML). */
function setSortIcon(th: HTMLTableCellElement, label: string, direction: SortDirection | 'hint'): void {
  th.textContent = label
  if (direction === 'hint') {
    const icon = iconSortDefault()
    addClass(icon, 'data-grid__sort-icon', 'data-grid__sort-icon--hint')
    th.appendChild(icon)
  } else {
    const factory = SORT_ICON_FACTORIES[direction]
    if (factory) {
      const icon = factory()
      addClass(icon, 'data-grid__sort-icon')
      th.appendChild(icon)
    }
  }
}

// ─── Row rendering ──────────────────────────────────────────────────

function renderRow<T>(
  row: T,
  columns: DataGridColumn<T>[],
  onRowClick?: (row: T, trigger: HTMLElement) => void,
): HTMLTableRowElement {
  const tr = el('tr', { className: 'data-grid__row' })

  for (const col of columns) {
    const td = el('td', { className: 'data-grid__td' })

    if (col.align === 'right') addClass(td, 'data-grid__td--right')
    else if (col.align === 'center') addClass(td, 'data-grid__td--center')

    if (col.width) td.style.width = col.width

    // Consistent padding: first cell gets left pad, all get right pad
    td.style.padding = `${CELL_PAD_COMPACT} ${CELL_PAD}`

    if (col.render) {
      const rendered = col.render(row)
      if (typeof rendered === 'string') {
        td.textContent = rendered
      } else {
        td.appendChild(rendered)
      }
    } else {
      const key = col.key as keyof T
      td.textContent = String(row[key] ?? '')
    }
    tr.appendChild(td)
  }

  if (onRowClick) {
    addClass(tr, 'data-grid__row--clickable')
    setAttrs(tr, { tabindex: '0', role: 'button' })

    // Store ID for focus return after modal close
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

// ─── Sort logic ─────────────────────────────────────────────────────

function compareValues<T>(a: T, b: T, key: string): number {
  const aVal = (a as Record<string, unknown>)[key]
  const bVal = (b as Record<string, unknown>)[key]

  if (aVal == null && bVal == null) return 0
  if (aVal == null) return 1
  if (bVal == null) return -1

  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return aVal - bVal
  }

  return String(aVal).localeCompare(String(bVal))
}

// ─── Main component ─────────────────────────────────────────────────

import type { DataGridHandle } from '@/types'

export function renderDataGrid<T>(props: DataGridProps<T>): DataGridHandle<T> {
  const { columns, data, onRowClick, emptyText } = props

  let sortState: SortState = { key: '', direction: 'none' }
  let currentData = [...data]

  // Map from data item to its rendered <tr> element
  const rowMap = new WeakMap<object, HTMLTableRowElement>()

  // Scrollable wrapper
  const wrapper = h('div', { className: 'data-grid__wrapper' })

  const table = el('table', { className: 'data-grid' })

  // ─ Header ─
  const thead = el('thead')
  const headerRow = el('tr')

  const headerCells: HTMLTableCellElement[] = columns.map((col) => {
    const th = el('th', { className: 'data-grid__th' })

    if (col.align === 'right') addClass(th, 'data-grid__th--right')
    else if (col.align === 'center') addClass(th, 'data-grid__th--center')

    if (col.width) th.style.width = col.width

    // Match td padding exactly
    th.style.padding = `${CELL_PAD_COMPACT} ${CELL_PAD}`

    th.textContent = col.label

    if (col.sortable !== false && col.label) {
      addClass(th, 'data-grid__th--sortable')
      setSortIcon(th, col.label, 'hint')
      th.addEventListener('click', () => handleSort(col.key as string, th))
    }

    headerRow.appendChild(th)
    return th
  })

  thead.appendChild(headerRow)

  // ─ Body ─
  const tbody = el('tbody')

  // ─ Sentinel for infinite scroll ─
  const sentinel = h('div', { className: 'data-grid__sentinel' })

  // ─ Infinite scroll ─
  const scroll = useInfiniteScroll<T>(PAGE_SIZE, (state) => {
    rebuildRows(state.visibleItems)
    sentinel.style.display = state.hasMore ? '' : 'none'
  })

  function rebuildRows(items: T[]): void {
    clearChildren(tbody)

    if (items.length === 0) {
      const emptyCell = el('td', { className: 'data-grid__empty', colSpan: String(columns.length) })
      emptyCell.textContent = emptyText ?? FILTER.EMPTY_DEFAULT
      const emptyRow = el('tr')
      emptyRow.appendChild(emptyCell)
      tbody.appendChild(emptyRow)
      return
    }

    // Synchronous render so rows are immediately available for scrollToItem
    const frag = fragment()
    for (const item of items) {
      const tr = renderRow(item, columns, onRowClick)
      if (typeof item === 'object' && item !== null) {
        rowMap.set(item as object, tr)
      }
      frag.appendChild(tr)
    }
    tbody.appendChild(frag)
  }

  function handleSort(key: string, clickedTh: HTMLTableCellElement): void {
    let newDir: SortDirection = 'asc'
    if (sortState.key === key) {
      if (sortState.direction === 'asc') newDir = 'desc'
      else if (sortState.direction === 'desc') newDir = 'none'
    }

    sortState = { key, direction: newDir }

    // Update header indicators
    for (let i = 0; i < headerCells.length; i++) {
      const label = columns[i].label
      const isSortable = columns[i].sortable !== false && label
      removeClass(headerCells[i], 'data-grid__th--sorted')

      if (isSortable) {
        setSortIcon(headerCells[i], label, 'hint')
      } else {
        headerCells[i].textContent = label
      }
    }

    if (newDir !== 'none') {
      const idx = headerCells.indexOf(clickedTh)
      setSortIcon(clickedTh, columns[idx].label, newDir)
      addClass(clickedTh, 'data-grid__th--sorted')
    }

    // Apply sort
    if (newDir === 'none') {
      currentData = [...data]
    } else {
      currentData = [...data].sort((a, b) => {
        const cmp = compareValues(a, b, key)
        return newDir === 'desc' ? -cmp : cmp
      })
    }

    scroll.setItems(currentData)
  }

  /**
   * Find the first item matching the predicate, expand infinite scroll
   * if needed, scroll it into view, and focus it.
   */
  function scrollToItem(predicate: (item: T) => boolean): boolean {
    const idx = currentData.findIndex(predicate)
    if (idx === -1) return false

    // Expand infinite scroll to include this item
    scroll.expandTo(idx)

    // The row should now be rendered — find its <tr>
    const item = currentData[idx]
    const tr = (typeof item === 'object' && item !== null)
      ? rowMap.get(item as object)
      : undefined

    if (!tr) return false

    // Scroll the section container into viewport first
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' })

    // After the page scroll settles, scroll the row within the grid and focus it
    setTimeout(() => {
      tr.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Focus the row — the :focus style provides the persistent green accent
      // tabIndex ensures focusability even if not a clickable row
      if (!tr.hasAttribute('tabindex')) {
        setAttrs(tr, { tabindex: '-1' })
      }
      tr.focus({ preventScroll: true })
    }, 400)

    return true
  }

  // ─ Assemble ─
  table.appendChild(thead)
  table.appendChild(tbody)
  wrapper.appendChild(table)
  wrapper.appendChild(sentinel)

  // Initialize data
  scroll.setItems(currentData)

  // Observe sentinel with the wrapper as scroll root
  requestAnimationFrame(() => scroll.observe(sentinel, wrapper))

  return { el: wrapper, scrollToItem }
}
