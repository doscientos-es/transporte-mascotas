import L from 'leaflet'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

import type { RouteStop } from '@/shared/types'

type Props = {
  stops: Pick<RouteStop, 'latitude' | 'longitude' | 'locality'>[]
  label: string
}

const RED = '#cf1f2a'
const BLACK = '#111'
const ARROW_SPACING = 70

/** Interactive map (OpenStreetMap tiles, no API key) with the route drawn over it. */
export default function RouteMap({ stops, label }: Props) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = container.current
    if (!element || stops.length < 2) return

    const map = L.map(element, {
      attributionControl: true,
      dragging: !L.Browser.mobile,
      scrollWheelZoom: false,
      zoomControl: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map)

    const points = stops.map((stop) => L.latLng(stop.latitude, stop.longitude))
    L.polyline(points, { color: RED, weight: 3, opacity: 0.85 }).addTo(map)
    points.forEach((point, index) => {
      const edge = index === 0 || index === points.length - 1
      L.circleMarker(point, {
        radius: edge ? 7 : 3.5,
        color: '#fff',
        weight: edge ? 2 : 1,
        fillColor: index === 0 ? BLACK : RED,
        fillOpacity: 1,
      })
        .bindTooltip(stops[index].locality)
        .addTo(map)
    })
    map.fitBounds(L.latLngBounds(points), { padding: [20, 20] })

    // Subtle direction arrows at the middle of each leg; redrawn on zoom because the
    // on-screen angle and the space available per leg change with the zoom level.
    const arrows = L.layerGroup().addTo(map)
    const drawArrows = () => {
      arrows.clearLayers()
      // Walk the whole line and drop an arrow every ARROW_SPACING screen pixels, so
      // routes with many short legs still show the direction.
      let travelled = ARROW_SPACING / 2
      for (let index = 0; index < points.length - 1; index += 1) {
        const from = map.latLngToLayerPoint(points[index])
        const to = map.latLngToLayerPoint(points[index + 1])
        const length = from.distanceTo(to)
        if (length === 0) continue
        const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
        let at = ARROW_SPACING - travelled
        while (at <= length) {
          const position = from.add(to.subtract(from).multiplyBy(at / length))
          L.marker(map.layerPointToLatLng(position), {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: 'route-map-arrow',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
              html: `<svg viewBox="0 0 20 20" width="20" height="20" style="transform:rotate(${angle}deg)" aria-hidden="true"><path d="M4 3l13 7-13 7 3.5-7z" fill="${BLACK}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
            }),
          }).addTo(arrows)
          at += ARROW_SPACING
        }
        travelled = length - (at - ARROW_SPACING)
      }
    }
    drawArrows()
    map.on('zoomend', drawArrows)

    // Wheel zoom only after the user clicks the map, so the page keeps scrolling normally.
    const enableWheel = () => map.scrollWheelZoom.enable()
    const disableWheel = () => map.scrollWheelZoom.disable()
    map.on('focus', enableWheel)
    map.on('blur', disableWheel)

    return () => {
      map.remove()
    }
  }, [stops])

  return <section ref={container} className="route-map" aria-label={label} />
}
