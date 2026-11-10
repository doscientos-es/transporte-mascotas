import type { DailyRoute, DailyRouteStop, Letter, ServiceAction } from '@/shared/types'

export type ServiceGroup = { key: string; actions: ServiceAction[]; animalLabels: string[] }

/** Keeps each transport/box together, independently of the database response order. */
export function groupedServices(route: DailyRoute, stops: DailyRouteStop[], letters: Letter[]) {
  const groupsByStop = new Map<string, ServiceGroup[]>()
  const stopsById = new Map(stops.map((stop) => [stop.id, stop]))
  const ranksByStop = new Map(
    stops.map((stop) => [stop.id, new Map(stop.actionOrder?.map((id, index) => [id, index]))]),
  )
  const rank = (group: ServiceGroup, stopId: string) =>
    Math.min(...group.actions.map((action) => ranksByStop.get(stopId)?.get(action.id) ?? Infinity))

  route.actions
    .toSorted((left, right) => left.id.localeCompare(right.id))
    .forEach((action) => {
      const stopId = action.stopId ?? stops.find((stop) => stop.locality === action.stop)?.id
      if (!stopId || !stopsById.has(stopId)) return
      const groups = groupsByStop.get(stopId) ?? []
      const key = [action.type, action.letterId, action.box ?? 'sin-box', stopId].join(':')
      const group = groups.find((item) => item.key === key) ?? {
        key,
        actions: [],
        animalLabels: [],
      }
      if (!groups.includes(group)) groups.push(group)
      group.actions.push({ ...action, stopId })
      const animal =
        action.animalLabel ??
        letters
          .find((letter) => letter.id === action.letterId)
          ?.animals.find((candidate) => candidate.id === action.animalId)
      const label =
        typeof animal === 'string'
          ? animal
          : animal
            ? [animal.breed, animal.species].filter(Boolean).join(' · ')
            : 'Mascota sin identificar'
      if (!group.animalLabels.includes(label)) group.animalLabels.push(label)
      groupsByStop.set(stopId, groups)
    })

  for (const [stopId, groups] of groupsByStop) {
    groups.sort((left, right) => {
      const leftRank = rank(left, stopId)
      const rightRank = rank(right, stopId)
      return (
        (leftRank === rightRank ? 0 : leftRank < rightRank ? -1 : 1) ||
        left.key.localeCompare(right.key)
      )
    })
  }
  return groupsByStop
}

export function serviceGroupLabel(group: ServiceGroup) {
  const action = group.actions[0]
  const type = action.type === 'recogida' ? 'Recogida' : 'Entrega'
  return `${type} · ${action.customer}${action.box === undefined ? '' : ` · Box ${action.box}`}`
}
