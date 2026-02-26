function createSvg(innerHTML: string, size = 16): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
  svg.setAttribute('fill', 'none')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = innerHTML
  return svg
}

export function iconRadar(size = 16): SVGSVGElement {
  return createSvg(`
    <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1" opacity="0.3"/>
    <circle cx="8" cy="8" r="4" stroke="currentColor" stroke-width="1" opacity="0.5"/>
    <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
    <line x1="8" y1="8" x2="13" y2="3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
  `, size)
}

export function iconClose(size = 16): SVGSVGElement {
  return createSvg(`
    <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `, size)
}

export function iconChevron(size = 16): SVGSVGElement {
  return createSvg(`
    <polyline points="6,3 11,8 6,13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  `, size)
}

export function iconDot(size = 6): SVGSVGElement {
  return createSvg(`
    <circle cx="3" cy="3" r="3" fill="currentColor"/>
  `, size)
}

export function iconExternal(size = 12): SVGSVGElement {
  return createSvg(`
    <path d="M5 1H1v10h10V7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M7 1h4v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="11" y1="1" x2="5" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  `, size)
}

export function iconGithub(size = 16): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'currentColor')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = `<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>`
  return svg
}

/** Sort unsorted indicator: up/down chevrons. */
export function iconSortDefault(size = 10): SVGSVGElement {
  return createSvg(`
    <path d="M3 4L5 1.5L7 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M3 6L5 8.5L7 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  `, size)
}

/** Sort ascending indicator: up chevron. */
export function iconSortAsc(size = 10): SVGSVGElement {
  return createSvg(`
    <path d="M2.5 6.5L5 3L7.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  `, size)
}

/** Sort descending indicator: down chevron. */
export function iconSortDesc(size = 10): SVGSVGElement {
  return createSvg(`
    <path d="M2.5 3.5L5 7L7.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  `, size)
}
