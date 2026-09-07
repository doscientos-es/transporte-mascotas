import type { DailyRoute, RouteTemplate } from '@/shared/types'

export type RouteSelectorGroup = {
  date: string
  routes: Array<{ route: DailyRoute; templateName: string }>
}

/** Groups daily routes chronologically and orders each day's routes by their template name. */
export function groupRoutesForSelector(
  routes: DailyRoute[],
  templates: RouteTemplate[],
): RouteSelectorGroup[] {
  const templateNames = new Map(templates.map((template) => [template.id, template.name]))
  const groups = new Map<string, RouteSelectorGroup>()

  routes
    .toSorted((left, right) => {
      const leftName = templateNames.get(left.templateId) ?? 'Ruta sin plantilla'
      const rightName = templateNames.get(right.templateId) ?? 'Ruta sin plantilla'
      return (
        left.date.localeCompare(right.date) ||
        leftName.localeCompare(rightName) ||
        left.id.localeCompare(right.id)
      )
    })
    .forEach((route) => {
      const group = groups.get(route.date) ?? { date: route.date, routes: [] }
      group.routes.push({
        route,
        templateName: templateNames.get(route.templateId) ?? 'Ruta sin plantilla',
      })
      groups.set(route.date, group)
    })

  return [...groups.values()]
}
