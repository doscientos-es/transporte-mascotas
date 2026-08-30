export type AuthFailure = {
  code?: string | null
  message?: string | null
  status?: number
}

export type AuthFeedback = {
  action?: 'login'
  message: string
  tone: 'error' | 'info' | 'success'
}

export function getAuthFeedback(error: AuthFailure, mode: 'login' | 'signup'): AuthFeedback {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''

  if (code === 'user_already_exists' || /user already registered|already exists/.test(message)) {
    return {
      tone: 'info',
      message: 'Esta cuenta ya está registrada. Inicia sesión para continuar.',
      action: 'login',
    }
  }

  if (/rate limit|too many requests|over_.*rate_limit/.test(`${code} ${message}`)) {
    return {
      tone: 'error',
      message:
        'Hemos recibido demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
    }
  }

  if (code === 'email_not_confirmed' || /email not confirmed/.test(message)) {
    return {
      tone: 'info',
      message: 'Confirma el correo que te enviamos antes de iniciar sesión.',
    }
  }

  if (code === 'invalid_credentials' || /invalid login credentials/.test(message)) {
    return { tone: 'error', message: 'El correo o la contraseña no son correctos.' }
  }

  if (/password.*(weak|short|least|breached)|weak password/.test(message)) {
    return {
      tone: 'error',
      message: 'La contraseña no cumple los requisitos de seguridad. Prueba con otra distinta.',
    }
  }

  if (code === 'email_address_invalid' || /invalid email|email address.*invalid/.test(message)) {
    return { tone: 'error', message: 'Escribe un correo electrónico válido.' }
  }

  if (/signup.*disabled|signups.*not allowed/.test(message)) {
    return {
      tone: 'error',
      message: 'El registro no está disponible ahora. Si necesitas acceso, contacta con el equipo.',
    }
  }

  if (/captcha/.test(`${code} ${message}`)) {
    return {
      tone: 'error',
      message:
        'No hemos podido validar la comprobación de seguridad. Actualiza la página e inténtalo de nuevo.',
    }
  }

  if (error.status !== undefined && error.status >= 500) {
    return {
      tone: 'error',
      message:
        'El servicio de acceso no está disponible temporalmente. Prueba de nuevo en unos minutos.',
    }
  }

  return mode === 'login'
    ? {
        tone: 'error',
        message: 'No hemos podido iniciar sesión. Revisa tus datos e inténtalo de nuevo.',
      }
    : {
        tone: 'error',
        message: 'No hemos podido crear la cuenta. Revisa los datos e inténtalo de nuevo.',
      }
}
