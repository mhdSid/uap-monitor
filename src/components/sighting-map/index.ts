import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { colors } from '@/styles/palette'
import { CheckboxGroup } from '@/components/checkbox'
import type { Sighting, Fireball } from '@/types'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { MAP_INFO } from '@/data/strings'
import { MAP_LAYERS } from '@/data/strings'

// ─── Types ──────────────────────────────────────────────────────────

export interface SightingMapProps {
  onCountrySelect?: (country: string | undefined) => void
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void
  onSightingSelect?: (sightingId: string) => void
}

// ─── Constants ──────────────────────────────────────────────────────

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'

const MARKER_COLORS: Record<string, string> = {
  NUFORC: colors.sourceNuforc,
  HATCH_UDB: colors.sourceHatch,
  CHRONOLOGY: colors.sourceChronology,
  EXPERIENCER: colors.sourceExperiencer,
  NASA_CNEOS: colors.sourceFireball
}

const DEFAULT_CENTER: L.LatLngExpression = [30, 0]
const DEFAULT_ZOOM = 2
const MIN_ZOOM = 2
const MAX_ZOOM = 14

// ─── Component ──────────────────────────────────────────────────────

export class SightingMap extends Component<SightingMapProps> {
  private map!: L.Map
  private tileLayer!: L.TileLayer
  private clusterGroup!: L.MarkerClusterGroup
  private fireballLayer!: L.LayerGroup
  private wrapper!: HTMLElement
  private loaderEl!: HTMLElement
  private resizeObserver!: ResizeObserver
  private isVisible = false

  protected create(): HTMLElement {
    this.wrapper = h('div', { className: cx.sightingMap })
    const mapEl = h('div', { className: cx.sightingMapCanvas })
    this.loaderEl = h('div', { className: cx.sightingMapLoader })
    this.loaderEl.style.display = 'none'

    const controls = new CheckboxGroup({
      items: [
        {
          label: MAP_LAYERS.SIGHTINGS,
          color: colors.sourceNuforc,
          checked: true,
          onChange: (on) => this.toggleSightings(on)
        },
        {
          label: MAP_LAYERS.FIREBALLS,
          color: colors.sourceFireball,
          checked: true,
          onChange: (on) => this.toggleFireballs(on)
        }
      ]
    })

    const controlsEl = h('div', { className: cx.mapControls }, controls.el)

    this.wrapper.appendChild(mapEl)
    this.wrapper.appendChild(controlsEl)
    this.wrapper.appendChild(this.loaderEl)

    const details = h('details', { className: cx.mapDetails })
    const summary = h('summary', { className: cx.mapSummary }, MAP_INFO.TITLE)
    const content = h('p', { className: cx.mapDetailsContent }, MAP_INFO.CONTENT)
    details.appendChild(summary)
    details.appendChild(content)

    const outer = h('div', { className: cx.sightingMapOuter },
      this.wrapper,
      details
    )

    // Defer map init — double RAF ensures layout is fully resolved
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.initMap(mapEl)
      })
    })

    return outer
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

    this.tileLayer = L.tileLayer(DARK_TILES, {
      attribution: TILE_ATTR,
      maxZoom: MAX_ZOOM
    }).addTo(this.map)

    this.clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 10,
      spiderfyDistanceMultiplier: 2,
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        let sizeClass: string, radius: number
        if (count < 20) { sizeClass = cx.mapClusterSm; radius = 36 }
        else if (count < 100) { sizeClass = cx.mapClusterMd; radius = 44 }
        else if (count < 500) { sizeClass = cx.mapClusterLg; radius = 52 }
        else { sizeClass = cx.mapClusterXl; radius = 60 }

        return L.divIcon({
          html: `<div class="${cx.mapCluster} ${sizeClass}">${count.toLocaleString()}</div>`,
          className: cx.mapClusterWrapper,
          iconSize: L.point(radius, radius)
        })
      }
    })

    this.map.addLayer(this.clusterGroup)

    this.fireballLayer = L.layerGroup()
    this.map.addLayer(this.fireballLayer)

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

  setSightings(sightings: Sighting[], fitBounds = false): void {
    if (!this.clusterGroup) return

    this.clusterGroup.clearLayers()

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const markerRadius = isTouchDevice ? 10 : 6

    const markers: L.CircleMarker[] = []
    for (const s of sightings) {
      if (!s.coordinates) continue
      const color = MARKER_COLORS[s.source] || colors.sourceChronology
      const marker = L.circleMarker([s.coordinates.lat, s.coordinates.lng], {
        radius: markerRadius,
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
        minWidth: isTouchDevice ? 220 : 200,
        closeButton: true,
        autoPan: true,
        autoPanPadding: L.point(40, 40)
      })

      // On touch: prevent cluster zoom-through — stop propagation and force popup
      if (isTouchDevice) {
        marker.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent?.stopPropagation()
          e.originalEvent?.preventDefault()
          if (!marker.isPopupOpen()) {
            marker.openPopup()
          }
        })
      } else {
        marker.on('click', () => {
          if (!marker.isPopupOpen()) marker.openPopup()
        })
      }

      markers.push(marker)
    }

    this.clusterGroup.addLayers(markers)

    if (fitBounds && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => m.getLatLng()))
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }

    // Force cluster recalculation — ensures visual update after chunkedLoading
    requestAnimationFrame(() => {
      if (this.map) this.map.fire('zoomend')
    })
  }

  setFireballs(fireballs: Fireball[]): void {
    if (!this.fireballLayer) return

    this.fireballLayer.clearLayers()
    const color = colors.sourceFireball
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const fireballRadius = isTouchDevice ? 12 : 8

    for (const fb of fireballs) {
      if (fb.lat == null || fb.lng == null) continue

      const marker = L.circleMarker([fb.lat, fb.lng], {
        radius: fireballRadius,
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2,
        opacity: 1,
        interactive: true,
        bubblingMouseEvents: false
      })

      const date = fb.date?.slice(0, 10) ?? '—'
      const parts = [
        fb.energy != null ? `Energy: ${fb.energy} J×10¹⁰` : '',
        fb.impactEnergy != null ? `Impact: ${fb.impactEnergy} kt` : '',
        fb.altitude != null ? `Alt: ${fb.altitude} km` : '',
        fb.velocity != null ? `Vel: ${fb.velocity} km/s` : ''
      ].filter(Boolean)

      marker.bindPopup(() =>
        h('div', { className: cx.mapPopup },
          h('div', { className: cx.mapPopupDate }, date),
          h('div', { className: cx.mapPopupLocation }, `${fb.lat!.toFixed(2)}°, ${fb.lng!.toFixed(2)}°`),
          h('div', { className: cx.mapPopupMeta }, parts.join(' · ')),
          h('div', { className: cx.mapPopupMeta }, 'NASA CNEOS Fireball')
        ), { maxWidth: 280, closeButton: true }
      )

      this.fireballLayer.addLayer(marker)
    }
  }

  fitToData(): void {
    if (!this.map || !this.clusterGroup) return
    const bounds = this.clusterGroup.getBounds()
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 })
    }
  }

  setTheme(theme: 'dark' | 'light'): void {
    if (!this.map || !this.tileLayer) return
    const url = theme === 'light' ? LIGHT_TILES : DARK_TILES
    this.tileLayer.setUrl(url)
  }

  invalidateSize(): void {
    if (this.map) this.map.invalidateSize()
  }

  // ─── Layer toggles ─────────────────────────────────────────────

  private toggleSightings(visible: boolean): void {
    if (!this.map || !this.clusterGroup) return
    if (visible) this.map.addLayer(this.clusterGroup)
    else this.map.removeLayer(this.clusterGroup)
  }

  private toggleFireballs(visible: boolean): void {
    if (!this.map || !this.fireballLayer) return
    if (visible) this.map.addLayer(this.fireballLayer)
    else this.map.removeLayer(this.fireballLayer)
  }

  // ─── Popup ────────────────────────────────────────────────────

  private createPopup(s: Sighting): HTMLElement {
    const year = s.occurredAt ? s.occurredAt.slice(0, 10) : '—'
    const src = s.subSource || s.source

    const action = h('button', {
      className: cx.mapPopupAction,
      type: 'button'
    }, '↳ View in list')

    const popup = h('div', { className: cx.mapPopup },
      h('div', { className: cx.mapPopupDate }, year),
      h('div', { className: cx.mapPopupLocation }, s.location || s.region || '—'),
      h('div', { className: cx.mapPopupSummary }, (s.summary || '').slice(0, 150) + (s.summary?.length > 150 ? '…' : '')),
      h('div', { className: cx.mapPopupMeta }, `${src} · ${s.shape} · Cred: ${s.credibility}`),
      action
    )

    action.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (this.props.onSightingSelect) {
        this.props.onSightingSelect(s.id)
        // Close popup after scroll is initiated, not before
        requestAnimationFrame(() => this.map.closePopup())
      }
    })

    return popup
  }
}
