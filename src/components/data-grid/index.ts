import type { DataGridProps } from '@/types'
import { h, addClass } from '@/utils/dom'

export function renderDataGrid<T>(props: DataGridProps<T>): HTMLElement {
  const { columns, data, onRowClick, emptyText } = props

  const headerCells = columns.map((col) =>
    h('th', { className: `data-grid__th data-grid__th--${col.align ?? 'left'}` }, col.label),
  )
  const thead = h('thead', null, h('tr', null, ...headerCells))
  const tbody = h('tbody')

  if (data.length === 0) {
    const emptyCell = h('td', {
      className: 'data-grid__empty',
      colspan: String(columns.length),
    }, emptyText ?? 'No data')
    tbody.appendChild(h('tr', null, emptyCell))
  } else {
    for (const row of data) {
      const cells = columns.map((col) => {
        const td = h('td', { className: `data-grid__td data-grid__td--${col.align ?? 'left'}` })
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
        return td
      })

      const tr = h('tr', { className: 'data-grid__row' }, ...cells)
      if (onRowClick) {
        addClass(tr, 'data-grid__row--clickable')
        tr.addEventListener('click', () => onRowClick(row))
      }
      tbody.appendChild(tr)
    }
  }

  return h('table', { className: 'data-grid' }, thead, tbody)
}
