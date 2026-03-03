import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { colors } from '@/styles/palette'
import type { Sighting } from '@/types'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'

// ─── Types ──────────────────────────────────────────────────────────

export interface SightingMapProps {
  onCountrySelect?: (country: string | undefined) => void
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void
  onSightingSelect?: (sightingId: string) => void
}

// ─── Constants ──────────────────────────────────────────────────────

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'

const MARKER_COLORS: Record<string, string> = {
  NUFORC: colors.sourceNuforc,
  HATCH_UDB: colors.sourceHatch,
  CHRONOLOGY: colors.sourceChronology
}

const DEFAULT_CENTER: L.LatLngExpression = [30, 0]
const DEFAULT_ZOOM = 2
const MIN_ZOOM = 2
const MAX_ZOOM = 14

// ─── Component ──────────────────────────────────────────────────────

export class SightingMap extends Component<SightingMapProps> {
  private map!: L.Map
  private clusterGroup!: L.MarkerClusterGroup
  private wrapper!: HTMLElement
  private loaderEl!: HTMLElement
  private resizeObserver!: ResizeObserver
  private isVisible = false

  protected create(): HTMLElement {
    this.wrapper = h('div', { className: cx.sightingMap })
    const mapEl = h('div', { className: cx.sightingMapCanvas })
    this.loaderEl = h('div', { className: cx.sightingMapLoader })
    this.loaderEl.style.display = 'none'
    this.wrapper.appendChild(mapEl)
    this.wrapper.appendChild(this.loaderEl)

    // Defer map init — double RAF ensures layout is fully resolved
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.initMap(mapEl)
      })
    })

    return this.wrapper
  }

  private initMap(container: HTMLElement): void {
    this.map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      worldCopyJump: true
    })

    L.tileLayer(DARK_TILES, {
      attribution: TILE_ATTR,
      maxZoom: MAX_ZOOM
    }).addTo(this.map)

    this.clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 12,
      spiderfyDistanceMultiplier: 1.5,
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        let sizeClass: string, radius: number
        if (count < 20) { sizeClass = cx.mapClusterSm; radius = 28 }
        else if (count < 100) { sizeClass = cx.mapClusterMd; radius = 36 }
        else if (count < 500) { sizeClass = cx.mapClusterLg; radius = 44 }
        else { sizeClass = cx.mapClusterXl; radius = 52 }

        return L.divIcon({
          html: `<div class="${cx.mapCluster} ${sizeClass}">${count.toLocaleString()}</div>`,
          className: cx.mapClusterWrapper,
          iconSize: L.point(radius, radius)
        })
      }
    })

    this.map.addLayer(this.clusterGroup)

    // Emit bounds change on move/zoom
    if (this.props.onBoundsChange) {
      this.map.on('moveend', () => {
        const b = this.map.getBounds()
        this.props.onBoundsChange!({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest()
        })
      })
    }

    // Handle resize
    this.resizeObserver = new ResizeObserver(() => {
      if (this.isVisible) this.map.invalidateSize()
    })
    this.resizeObserver.observe(this.wrapper)
    this.isVisible = true
  }

  // ─── Loading overlay ─────────────────────────────────────────────

  showLoader(el?: HTMLElement): void {
    this.loaderEl.textContent = ''
    if (el) this.loaderEl.appendChild(el)
    this.loaderEl.style.display = ''
  }

  hideLoader(): void {
    this.loaderEl.style.display = 'none'
    if (this.map) {
      setTimeout(() => this.map.invalidateSize({ animate: false }), 50)
    }
  }

  // ─── Public API ─────────────────────────────────────────────────

  setSightings(sightings: Sighting[]): void {
    if (!this.clusterGroup) return

    this.clusterGroup.clearLayers()

    const markers: L.CircleMarker[] = []
    for (const s of sightings) {
      if (!s.coordinates) continue
      const color = MARKER_COLORS[s.source] || colors.sourceChronology
      const marker = L.circleMarker([s.coordinates.lat, s.coordinates.lng], {
        radius: 6,
        color,
        fillColor: color,
        fillOpacity: 0.7,
        weight: 1,
        opacity: 0.9,
        interactive: true,
        bubblingMouseEvents: false
      })

      marker.bindPopup(() => this.createPopup(s), {
        maxWidth: 280,
        closeButton: true,
        autoPan: true
      })

      // Explicit click handler as fallback — ensures popup opens even if
      // Leaflet's default bindPopup click is intercepted by markercluster
      marker.on('click', () => {
        if (!marker.isPopupOpen()) marker.openPopup()
      })

      markers.push(marker)
    }

    this.clusterGroup.addLayers(markers)
  }

  fitToData(): void {
    if (!this.map || !this.clusterGroup) return
    const bounds = this.clusterGroup.getBounds()
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 })
    }
  }

  invalidateSize(): void {
    if (this.map) this.map.invalidateSize()
  }

  // ─── Popup ────────────────────────────────────────────────────

  private createPopup(s: Sighting): HTMLElement {
    const year = s.occurredAt ? s.occurredAt.slice(0, 10) : '—'
    const src = s.subSource || s.source
    const popup = h('div', { className: cx.mapPopup },
      h('div', { className: cx.mapPopupDate }, year),
      h('div', { className: cx.mapPopupLocation }, s.location || s.region || '—'),
      h('div', { className: cx.mapPopupSummary }, (s.summary || '').slice(0, 150) + (s.summary?.length > 150 ? '…' : '')),
      h('div', { className: cx.mapPopupMeta }, `${src} · ${s.shape} · Cred: ${s.credibility}`),
      h('div', { className: cx.mapPopupAction }, '↳ View in list')
    )

    popup.addEventListener('click', () => {
      if (this.props.onSightingSelect) {
        this.map.closePopup()
        this.props.onSightingSelect(s.id)
      }
    })

    return popup
  }
}
