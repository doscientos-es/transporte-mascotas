import { useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import type { DashboardNavigation, NavSection } from '@/shared/types'

import {
  dashboardLocationForPath,
  dashboardPathFor,
  routePathFor,
  vanPathFor,
} from './dashboard-routes'

export function useDashboardNavigation(fallback: NavSection): DashboardNavigation {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { routeId } = useParams()
  const location = dashboardLocationForPath(pathname, fallback)
  const navigateTo = useCallback(
    (path: string, replace = false) => navigate(path, { replace }),
    [navigate],
  )

  return {
    ...location,
    routeId: routeId ?? location.routeId,
    hrefForSection: dashboardPathFor,
    navigateToSection: (section) => void navigateTo(dashboardPathFor(section)),
    navigateToRoute: (id) => void navigateTo(routePathFor(id)),
    navigateToVan: (id) => void navigateTo(vanPathFor(id)),
    replaceWithSection: (section) => void navigateTo(dashboardPathFor(section), true),
  }
}
