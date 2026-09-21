type RemoteError = { code?: unknown; message?: unknown }

function isRemoteError(error: unknown): error is RemoteError {
  return typeof error === 'object' && error !== null
}

/** Keeps deliberate API validation messages while hiding implementation details. */
export function requestErrorMessage(error: unknown, fallback: string) {
  if (!isRemoteError(error) || typeof error.message !== 'string') return fallback
  const code = typeof error.code === 'string' ? error.code : ''
  if (code === 'P0001') return error.message
  if (code === '22P02' || code === '23502' || code === '23503' || code === '23514')
    return 'Revisa el peso, las medidas y los datos obligatorios de cada mascota.'
  if (code === '22023') return 'Los datos enviados no son válidos. Revisa la solicitud.'
  if (code === '42501') return 'Tu sesión ha caducado. Cierra sesión y vuelve a entrar.'
  if (
    code === '42P01' ||
    code === '42703' ||
    code === '42883' ||
    code === 'PGRST202' ||
    code === 'PGRST203'
  )
    return 'El servicio de solicitudes necesita actualizarse. Contacta con Kache Envíos.'
  return fallback
}

export function throwRequestError(error: unknown, fallback: string): never {
  throw new Error(requestErrorMessage(error, fallback))
}
