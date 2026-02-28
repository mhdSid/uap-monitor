declare module 'leaflet.markercluster' {
  // Side-effect import — extends L namespace
}

declare namespace L {
  interface MarkerClusterGroupOptions {
    maxClusterRadius?: number
    spiderfyOnMaxZoom?: boolean
    showCoverageOnHover?: boolean
    zoomToBoundsOnClick?: boolean
    disableClusteringAtZoom?: number
    spiderfyDistanceMultiplier?: number
    chunkedLoading?: boolean
    chunkInterval?: number
    chunkDelay?: number
    iconCreateFunction?: (cluster: MarkerCluster) => L.DivIcon
  }

  interface MarkerCluster {
    getChildCount(): number
    getAllChildMarkers(): L.Marker[]
  }

  interface MarkerClusterGroup extends L.FeatureGroup {
    addLayers(layers: L.Layer[]): this
    removeLayers(layers: L.Layer[]): this
    clearLayers(): this
    getBounds(): L.LatLngBounds
  }

  function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup
}
