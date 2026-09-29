import {
  Button,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
} from '@doscientos/ui'
import { UserPlus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import {
  upgradeAnonymousClientAccount,
  validateOptionalClientAccountPassword,
} from '../application/anonymous-client-account'

type Props = {
  displayName: string
  email: string
  phone: string
  title: string
  description: string
  skipLabel?: string
  onSkip?: () => void
  onCreated?: (result: 'created' | 'confirmation_pending') => void
  children?: ReactNode
}

export function OptionalClientAccountCard({
  displayName,
  email,
  phone,
  title,
  description,
  skipLabel,
  onSkip,
  onCreated,
  children,
}: Props) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateOptionalClientAccountPassword(password, confirmation)
    if (validationError) return setError(validationError)
    setSending(true)
    setError('')
    try {
      const result = await upgradeAnonymousClientAccount({ displayName, email, password, phone })
      setPassword('')
      setConfirmation('')
      onCreated?.(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido crear la cuenta.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="table-card client-request-card">
      <CardContent>
        <form className="payment-recovery" onSubmit={(event) => void submit(event)} noValidate>
          <div className="text-accent [&_p]:text-muted-foreground mb-3.75 flex items-start gap-2.25 [&_h2]:m-0 [&_h2]:text-lg [&_p]:mt-1 [&_p]:text-[13px] [&_p]:leading-5">
            <UserPlus size={17} />
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          </div>
          {children}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel>Correo de la cuenta</FieldLabel>
              <Input value={email} readOnly className="min-h-11" />
              <FieldDescription>Usaremos el correo de contacto de la solicitud.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Contraseña</FieldLabel>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Al menos 8 caracteres"
                className="min-h-11"
              />
            </Field>
            <Field>
              <FieldLabel>Repite la contraseña</FieldLabel>
              <Input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                className="min-h-11"
              />
            </Field>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="request-form-actions">
            {onSkip && (
              <Button type="button" variant="outline" onClick={onSkip} disabled={sending}>
                {skipLabel ?? 'Ahora no'}
              </Button>
            )}
            <Button type="submit" disabled={sending}>
              <UserPlus size={16} /> {sending ? 'Creando cuenta…' : 'Crear mi cuenta'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
