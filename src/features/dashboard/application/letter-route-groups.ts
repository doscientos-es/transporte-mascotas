import type { Letter } from '@/shared/types'

export type LetterRouteGroup = {
  key: string
  routeName: string
  templateColor?: string
  serviceDate: string
  letters: Letter[]
}

/** Groups letters by route template and service date, the route identity available on Letter. */
export function groupLettersByRoute(letters: Letter[]): LetterRouteGroup[] {
  const groups = new Map<string, LetterRouteGroup>()

  letters.forEach((letter) => {
    const routeName = letter.route.trim() || 'Sin ruta'
    const key = JSON.stringify([routeName, letter.serviceDate])
    const group = groups.get(key) ?? {
      key,
      routeName,
      templateColor: letter.routeTemplateColor,
      serviceDate: letter.serviceDate,
      letters: [],
    }
    group.letters.push(letter)
    groups.set(key, group)
  })

  return [...groups.values()].toSorted(
    (left, right) =>
      right.serviceDate.localeCompare(left.serviceDate) ||
      left.routeName.localeCompare(right.routeName, 'es'),
  )
}
