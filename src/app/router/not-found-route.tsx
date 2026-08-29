import { NotFoundPage } from '@/pages/not-found'

import { APP_PATHS } from './dashboard-routes'

export function Component() {
  return <NotFoundPage homeHref={APP_PATHS.home} />
}
