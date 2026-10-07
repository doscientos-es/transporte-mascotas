import { Button, Input } from '@doscientos/ui'
import {
  CircleAlert,
  CircleDollarSign,
  CheckCircle2,
  MailPlus,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import {
  transportBoxCategories,
  transportBoxCategoryLabel,
  transportBoxDimensions,
  type TransportBoxCatalog,
  type TransportBoxCatalogItem,
  type TransportBoxCategory,
} from '@/shared/application/transport-boxes'
import { AUTH_PATHS } from '@/shared/constants/auth-paths'
import type { SavedMeetingPoint, StaffInvitation } from '@/shared/types'
import { PageIntro } from '@/shared/ui/page-intro'

import { sendEmailTest } from '../application/email-test'
import { MeetingPointsSettings } from './meeting-points-settings'

type Props = {
  invitations: StaffInvitation[]
  onInvite: (email: string) => Promise<void>
  onRevokeInvitation: (email: string) => Promise<void>
  boxCatalog: TransportBoxCatalog
  onSaveBoxCatalog: (catalog: TransportBoxCatalog) => Promise<void>
  meetingPoints: SavedMeetingPoint[]
  onSaveMeetingPoint: (point: SavedMeetingPoint | Omit<SavedMeetingPoint, 'id'>) => Promise<unknown>
  onDeleteMeetingPoint: (id: string) => Promise<void>
}

const sizeFields = [
  { key: 'maxLengthCm', label: 'Largo máx. (cm)' },
  { key: 'maxWidthCm', label: 'Ancho máx. (cm)' },
  { key: 'nextBoxFromKg', label: 'Peso máx. (kg)' },
  { key: 'maxHeightCm', label: 'Alto máx. (cm)' },
] as const

export function SettingsPage({
  invitations,
  onInvite,
  onRevokeInvitation,
  boxCatalog,
  onSaveBoxCatalog,
  meetingPoints,
  onSaveMeetingPoint,
  onDeleteMeetingPoint,
}: Props) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null)
  const [draftCatalog, setDraftCatalog] = useState(boxCatalog)
  const [savingPrices, setSavingPrices] = useState(false)
  const [priceError, setPriceError] = useState('')
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    type: 'error' | 'success'
    message: string
  } | null>(null)
  useEffect(() => setDraftCatalog(boxCatalog), [boxCatalog])

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInviting(true)
    setInviteError('')
    try {
      await onInvite(inviteEmail)
      setInviteEmail('')
    } catch (reason) {
      setInviteError(
        reason instanceof Error ? reason.message : 'No se ha podido crear la invitación.',
      )
    } finally {
      setInviting(false)
    }
  }

  async function revokeInvitation(email: string) {
    setRevokingEmail(email)
    try {
      await onRevokeInvitation(email)
    } catch {
      // The dashboard already reports the failure.
    } finally {
      setRevokingEmail(null)
    }
  }

  function updateDraftItem(
    category: TransportBoxCategory,
    patch: Partial<TransportBoxCatalogItem>,
  ) {
    setDraftCatalog((current) => ({ ...current, [category]: { ...current[category], ...patch } }))
  }

  async function savePrices() {
    if (
      transportBoxCategories.some(
        (category) =>
          sizeFields.some(({ key }) => {
            const value = draftCatalog[category][key]
            return value !== undefined && (!Number.isFinite(value) || value <= 0)
          }) ||
          !Number.isFinite(draftCatalog[category].amountCents) ||
          draftCatalog[category].amountCents <= 0 ||
          (draftCatalog[category].largeAmountCents !== undefined &&
            (!Number.isFinite(draftCatalog[category].largeAmountCents) ||
              draftCatalog[category].largeAmountCents <= 0)),
      )
    ) {
      setPriceError('Introduce importes, medidas y dimensiones válidos para cada box.')
      return
    }
    setSavingPrices(true)
    setPriceError('')
    try {
      await onSaveBoxCatalog(
        Object.fromEntries(
          transportBoxCategories.map((category) => [
            category,
            {
              ...draftCatalog[category],
              dimensions: transportBoxDimensions(draftCatalog, category),
            },
          ]),
        ) as TransportBoxCatalog,
      )
    } catch (reason) {
      setPriceError(
        reason instanceof Error ? reason.message : 'No se han podido guardar las tarifas.',
      )
    } finally {
      setSavingPrices(false)
    }
  }

  async function sendTestEmail() {
    setSendingTestEmail(true)
    setTestEmailFeedback(null)
    try {
      const { email } = await sendEmailTest()
      setTestEmailFeedback({ type: 'success', message: `Email de prueba enviado a ${email}.` })
    } catch (reason) {
      setTestEmailFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : 'No se ha podido enviar el email.',
      })
    } finally {
      setSendingTestEmail(false)
    }
  }

  return (
    <>
      <PageIntro text="Gestiona el acceso del equipo. Los administradores tienen acceso completo a operaciones.">
        <span className="settings-admin-badge">
          <ShieldCheck size={16} /> Solo administradores
        </span>
      </PageIntro>
      <section className="settings-support settings-invitations">
        <div>
          <h2>Invitar administrador</h2>
          <p>
            Solo los correos invitados obtienen acceso al equipo. Tras invitarle, la persona debe
            crear su cuenta en <strong>{AUTH_PATHS.staffAccess}</strong> y confirmar su correo.
          </p>
        </div>
        <form className="team-invite-form" onSubmit={(event) => void inviteMember(event)}>
          <Input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="correo@ejemplo.com"
            aria-label="Correo del administrador"
            autoComplete="off"
            required
            disabled={inviting}
          />
          <Button type="submit" disabled={inviting}>
            <MailPlus size={16} /> {inviting ? 'Invitando…' : 'Invitar'}
          </Button>
        </form>
        {inviteError && (
          <p className="form-error" role="alert">
            {inviteError}
          </p>
        )}
        {invitations.length > 0 && (
          <ul className="team-invitation-list" aria-label="Invitaciones pendientes">
            {invitations.map((invitation) => (
              <li key={invitation.email}>
                <span>{invitation.email}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revokingEmail === invitation.email}
                  onClick={() => void revokeInvitation(invitation.email)}
                  aria-label={`Retirar invitación de ${invitation.email}`}
                >
                  <X size={14} /> Retirar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="settings-support settings-pricing">
        <div className="settings-pricing-heading">
          <h2>Catálogo de boxes</h2>
          <p>El cliente puede elegir una categoría superior y el importe se calcula por mascota.</p>
        </div>
        <div className="settings-pricing-grid">
          {transportBoxCategories.map((category) => (
            <div className="settings-pricing-card" key={category}>
              <div className="settings-pricing-card-heading">
                <strong>{transportBoxCategoryLabel(category)}</strong>
              </div>
              <div className="settings-pricing-fields">
                <div className="settings-pricing-field">
                  Dimensiones mostradas
                  <p className="settings-pricing-readonly">
                    {transportBoxDimensions(draftCatalog, category)}
                  </p>
                </div>
                {sizeFields.map(({ key, label }) =>
                  draftCatalog[category][key] === undefined ? null : (
                    <label
                      className="settings-pricing-field"
                      htmlFor={`box-${category}-${key}`}
                      key={key}
                    >
                      {label}
                      <Input
                        id={`box-${category}-${key}`}
                        type="number"
                        min="1"
                        step="1"
                        value={draftCatalog[category][key]}
                        onChange={(event) =>
                          updateDraftItem(category, { [key]: Number(event.target.value) })
                        }
                        disabled={savingPrices}
                      />
                    </label>
                  ),
                )}
                <label className="settings-pricing-field" htmlFor={`box-${category}-base`}>
                  Tarifa base (€)
                  <Input
                    id={`box-${category}-base`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={draftCatalog[category].amountCents / 100}
                    onChange={(event) =>
                      setDraftCatalog((current) => ({
                        ...current,
                        [category]: {
                          ...current[category],
                          amountCents: Math.round(Number(event.target.value) * 100),
                        },
                      }))
                    }
                    disabled={savingPrices}
                  />
                </label>
                {draftCatalog[category].largeAmountCents !== undefined && (
                  <label className="settings-pricing-field" htmlFor={`box-${category}-large`}>
                    Tarifa superior (€)
                    <Input
                      id={`box-${category}-large`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draftCatalog[category].largeAmountCents / 100}
                      onChange={(event) =>
                        setDraftCatalog((current) => ({
                          ...current,
                          [category]: {
                            ...current[category],
                            largeAmountCents: Math.round(Number(event.target.value) * 100),
                          },
                        }))
                      }
                      disabled={savingPrices}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
        {priceError && (
          <p className="form-error" role="alert">
            {priceError}
          </p>
        )}
        <div className="settings-pricing-actions">
          <Button onClick={() => void savePrices()} disabled={savingPrices}>
            <CircleDollarSign size={16} /> {savingPrices ? 'Guardando…' : 'Guardar tarifas'}
          </Button>
        </div>
      </section>
      <MeetingPointsSettings
        meetingPoints={meetingPoints}
        onSave={onSaveMeetingPoint}
        onDelete={onDeleteMeetingPoint}
      />
      <section className="settings-support">
        <div>
          <h2>Prueba de email</h2>
          <p>
            Envía un correo real a la dirección de administrador, con el mismo proveedor y la
            configuración que los emails operativos.
          </p>
          {testEmailFeedback && (
            <p
              className={`email-test-feedback is-${testEmailFeedback.type}`}
              role={testEmailFeedback.type === 'error' ? 'alert' : 'status'}
            >
              {testEmailFeedback.type === 'success' ? (
                <CheckCircle2 size={16} />
              ) : (
                <CircleAlert size={16} />
              )}
              {testEmailFeedback.message}
            </p>
          )}
          <p className="email-test-note">
            Si no lo recibes, revisa la carpeta de spam y la configuración del remitente en Resend.
          </p>
        </div>
        <Button disabled={sendingTestEmail} onClick={() => void sendTestEmail()}>
          <Send size={16} /> {sendingTestEmail ? 'Enviando…' : 'Enviar prueba de email'}
        </Button>
      </section>
    </>
  )
}
