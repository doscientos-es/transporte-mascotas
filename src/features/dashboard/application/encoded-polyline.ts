/** Decodes a Google encoded polyline (precision 5) into `[latitude, longitude]` pairs. */
export function decodePolyline(encoded: string): Array<[latitude: number, longitude: number]> {
  const points: Array<[number, number]> = []
  let index = 0
  let latitude = 0
  let longitude = 0

  const readValue = () => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      if (index >= encoded.length) throw new Error('Trazado de Google incompleto.')
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    latitude += readValue()
    longitude += readValue()
    points.push([latitude / 1e5, longitude / 1e5])
  }
  return points
}
