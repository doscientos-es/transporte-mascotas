import { useLocation } from 'react-router-dom'

import { PasswordRecoveryPage } from '@/features/auth'

export function Component() {
  const { search } = useLocation()
  const audience = new URLSearchParams(search).get('audience') === 'staff' ? 'staff' : 'client'
  return <PasswordRecoveryPage audience={audience} />
}
