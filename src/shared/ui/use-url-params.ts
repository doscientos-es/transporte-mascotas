import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

import { type SearchParamUpdates, updateSearchParams } from '@/shared/lib/search-params'

export function useUrlParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const updateParams = useCallback(
    (updates: SearchParamUpdates, replace = true) => {
      setSearchParams(updateSearchParams(searchParams, updates), { replace })
    },
    [searchParams, setSearchParams],
  )

  return { searchParams, updateParams }
}
