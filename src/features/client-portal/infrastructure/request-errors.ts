type RemoteError = { code?: unknown; message?: unknown }

function isRemoteError(error: unknown): error is RemoteError {
  return typeof error === 'object' && error !== null
}

/** Keeps deliberate API validation messages while hiding implementation details. */
export function requestErrorMessage(error: unknown, fallback: string) {
  if (!isRemoteError(error) || typeof error.message !== 'string') return fallback
  const code = typeof error.code === 'string' ? error.code : ''
  if (code === 'P0001' || code === '23514' || code === '22023') return error.message
  if (code === '42883' || code === 'PGRST202')
    return 'El servicio de solicitudes necesita actualizarse. Contacta con Kache Envíos.'
  return fallback
}

export function throwRequestError(error: unknown, fallback: string): never {
  throw new Error(requestErrorMessage(error, fallback))
}
