type RemoteError = { code?: unknown; message?: unknown }

function isRemoteError(error: unknown): error is RemoteError {
  return typeof error === 'object' && error !== null
}

/** Keeps deliberate API validation messages while hiding implementation details. */
export function requestErrorMessage(error: unknown, fallback: string) {
  if (!isRemoteError(error) || error.code !== 'P0001' || typeof error.message !== 'string')
    return fallback
  return error.message
}

export function throwRequestError(error: unknown, fallback: string): never {
  throw new Error(requestErrorMessage(error, fallback))
}
