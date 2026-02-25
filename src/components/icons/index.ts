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
