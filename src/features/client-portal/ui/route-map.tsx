import L from 'leaflet'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

import type { RouteStop } from '@/shared/types'

type Props = {
  stops: Pick<RouteStop, 'latitude' | 'longitude' | 'locality'>[]
  label: string
  /** Numbered, clickable markers. Reports the clicked stop index. */
  onStopClick?: (index: number) => void
  /** Popup content per stop (same order as `stops`), read when a popup opens. */
  details?: StopDetail[]
}

export type StopDetail = {
  lines: string[]
  /** Animals picked up (boarding) and delivered (leaving) at this stop. */
  pickups?: string[]
  deliveries?: string[]
  /** Animals on the van after this stop. */
  onboard?: number
}

function stopPopup(index: number, locality: string, detail?: StopDetail) {
  const element = document.createElement('div')
  element.className = 'route-map-popup'
  const add = (tag: string, text: string, className?: string) => {
    const node = document.createElement(tag)
    node.textContent = text
    if (className) node.className = className
    element.append(node)
  }
  add('strong', `${index + 1}. ${locality}`)
  for (const line of detail?.lines ?? []) add('span', line)
  for (const animal of detail?.pickups ?? []) add('span', `+ ${animal}`, 'is-in')
  for (const animal of detail?.deliveries ?? []) add('span', `− ${animal}`, 'is-out')
  if (detail?.onboard !== undefined) {
    add('span', `En la furgoneta tras la parada: ${detail.onboard}`, 'is-onboard')
  }
  return element
}

function stopMarkerHtml(index: number, edge: boolean, detail?: StopDetail) {
  const pickups = detail?.pickups?.length ?? 0
  const deliveries = detail?.deliveries?.length ?? 0
  const badges =
    (pickups ? `<em class="is-in">+${pickups}</em>` : '') +
    (deliveries ? `<em class="is-out">−${deliveries}</em>` : '')
  return `<span class="${edge ? 'is-edge' : ''}">${index + 1}</span>${badges ? `<div class="route-map-badges">${badges}</div>` : ''}`
}

const RED = '#cf1f2a'
const BLACK = '#111'
const ARROW_SPACING = 70

/** Interactive map (OpenStreetMap tiles, no API key) with the route drawn over it. */
export default function RouteMap({ stops, label, onStopClick: onClick, details: lines }: Props) {
  const container = useRef<HTMLDivElement>(null)
  // Latest values are read through refs so editing times does not rebuild the map.
  const interactive = useRef(Boolean(onClick))
  const onStopClick = useRef(onClick)
  const details = useRef(lines ?? [])
  interactive.current = Boolean(onClick)
  onStopClick.current = onClick
  details.current = lines ?? []

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
      if (interactive.current) {
        const marker = L.marker(point, {
          icon: L.divIcon({
            className: 'route-map-stop',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            html: stopMarkerHtml(index, edge, details.current[index]),
          }),
        })
          .bindTooltip(stops[index].locality)
          .bindPopup(() => stopPopup(index, stops[index].locality, details.current[index]))
          .addTo(map)
        marker.on('click', () => onStopClick.current?.(index))
        return
      }
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
