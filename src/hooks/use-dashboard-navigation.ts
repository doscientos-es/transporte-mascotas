import { useCallback, useEffect, useState } from 'react'
import { dashboardLocationForPath, dashboardPathFor, isDashboardPath, routePathFor } from '../lib/dashboard-navigation'
import type { NavSection } from '../lib/types'

export function useDashboardNavigation() {
  const [location, setLocation] = useState(() => dashboardLocationForPath(window.location.pathname))

  useEffect(() => {
    if (!isDashboardPath(window.location.pathname)) window.history.replaceState(null, '', dashboardPathFor('cartas'))
    const syncLocation = () => setLocation(dashboardLocationForPath(window.location.pathname))
    syncLocation()
    window.addEventListener('popstate', syncLocation)
    return () => window.removeEventListener('popstate', syncLocation)
  }, [])

  const setPath = useCallback((path: string, replace = false) => {
    if (window.location.pathname === path) return
    window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
    setLocation(dashboardLocationForPath(path))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return {
    ...location,
    navigateToSection: (section: NavSection) => setPath(dashboardPathFor(section)),
    navigateToRoute: (routeId: string) => setPath(routePathFor(routeId)),
    replaceWithSection: (section: NavSection) => setPath(dashboardPathFor(section), true),
  }
}