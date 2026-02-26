import type { DataGridProps, DataGridColumn } from '@/types'
import { h, addClass, removeClass, clearChildren } from '@/utils/dom'
import { useInfiniteScroll } from '@/composables/use-infinite-scroll'
import { iconSortDefault, iconSortAsc, iconSortDesc } from '@/components/icons'

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

const PAGE_SIZE = 100
const BATCH_SIZE = 50

// ─── Cell padding constant (shared by th and td) ────────────────────

const CELL_PAD = '8px'
const CELL_PAD_COMPACT = '4px'

// ─── Sort icon helpers ──────────────────────────────────────────────

/** Replace the sort icon inside a header cell (DOM-based, no innerHTML). */
function setSortIcon(th: HTMLTableCellElement, label: string, direction: SortDirection | 'hint'): void {
  th.textContent = label
  if (direction === 'hint') {
    const icon = iconSortDefault()
    icon.classList.add('data-grid__sort-icon', 'data-grid__sort-icon--hint')
    th.appendChild(icon)
  } else {
    const factory = SORT_ICON_FACTORIES[direction]
    if (factory) {
      const icon = factory()
      icon.classList.add('data-grid__sort-icon')
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
  const tr = document.createElement('tr')
  tr.className = 'data-grid__row'

  for (const col of columns) {
    const td = document.createElement('td')
    td.className = 'data-grid__td'

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
    tr.tabIndex = 0
    tr.setAttribute('role', 'button')

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

// ─── Non-blocking batch append ──────────────────────────────────────

function batchAppendRows<T>(
  tbody: HTMLTableSectionElement,
  rows: T[],
  columns: DataGridColumn<T>[],
  onRowClick?: (row: T, trigger: HTMLElement) => void,
): void {
  let index = 0

  function renderBatch(): void {
    const frag = document.createDocumentFragment()
    const end = Math.min(index + BATCH_SIZE, rows.length)

    for (let i = index; i < end; i++) {
      frag.appendChild(renderRow(rows[i], columns, onRowClick))
    }

    tbody.appendChild(frag)
    index = end

    if (index < rows.length) {
      requestAnimationFrame(renderBatch)
    }
  }

  requestAnimationFrame(renderBatch)
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

export function renderDataGrid<T>(props: DataGridProps<T>): HTMLElement {
  const { columns, data, onRowClick, emptyText } = props

  let sortState: SortState = { key: '', direction: 'none' }
  let currentData = [...data]

  // Scrollable wrapper
  const wrapper = h('div', { className: 'data-grid__wrapper' })

  const table = document.createElement('table')
  table.className = 'data-grid'

  // ─ Header ─
  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')

  const headerCells: HTMLTableCellElement[] = columns.map((col) => {
    const th = document.createElement('th')
    th.className = 'data-grid__th'

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
  const tbody = document.createElement('tbody')

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
      const emptyCell = document.createElement('td')
      emptyCell.className = 'data-grid__empty'
      emptyCell.colSpan = columns.length
      emptyCell.textContent = emptyText ?? 'No data'
      const emptyRow = document.createElement('tr')
      emptyRow.appendChild(emptyCell)
      tbody.appendChild(emptyRow)
      return
    }

    batchAppendRows(tbody, items, columns, onRowClick)
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

  // ─ Assemble ─
  table.appendChild(thead)
  table.appendChild(tbody)
  wrapper.appendChild(table)
  wrapper.appendChild(sentinel)

  // Initialize data
  scroll.setItems(currentData)

  // Observe sentinel with the wrapper as scroll root
  requestAnimationFrame(() => scroll.observe(sentinel, wrapper))

  return wrapper
}
