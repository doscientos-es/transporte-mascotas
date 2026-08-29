import { Button, Card, CardContent, Input } from '@doscientos/ui'
import { ArrowLeft, CheckCircle2, MessageCircleWarning, Send } from 'lucide-react'
import { useState } from 'react'

import { sendWhatsAppTest, type WhatsAppTestKind } from '../application/whatsapp'

type Props = { onBack: () => void }

const tests: Array<{ kind: WhatsAppTestKind; title: string; description: string }> = [
  {
    kind: 'confirmacion',
    title: 'Confirmación de pago y ruta',
    description: 'Envía el mensaje que se entrega al confirmar la solicitud pagada.',
  },
  {
    kind: 'recordatorio_ruta',
    title: 'Recordatorio de ruta',
    description: 'Envía el mensaje programado para el día anterior a la salida.',
  },
]

export function WhatsAppTestPage({ onBack }: Props) {
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState<WhatsAppTestKind | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(
    null,
  )

  async function send(kind: WhatsAppTestKind) {
    setSending(kind)
    setFeedback(null)
    try {
      await sendWhatsAppTest(phone, kind)
      setFeedback({ type: 'success', message: 'Mensaje de prueba enviado a WhatsApp.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se ha podido enviar la prueba.',
      })
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="whatsapp-test-page">
      <button className="settings-back-link" type="button" onClick={onBack}>
        <ArrowLeft size={16} /> Volver a Ajustes
      </button>
      <PageHeader />
      <Card className="whatsapp-test-card">
        <CardContent>
          <label htmlFor="whatsapp-test-phone">
            Número de WhatsApp para pruebas
            <Input
              type="tel"
              id="whatsapp-test-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Ej.: +34 600 000 000"
              autoComplete="tel"
            />
            <small>Se aceptan números españoles sin prefijo; se enviará un mensaje real.</small>
          </label>
          {feedback && (
            <p
              className={`whatsapp-test-feedback is-${feedback.type}`}
              role={feedback.type === 'error' ? 'alert' : 'status'}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} />
              ) : (
                <MessageCircleWarning size={16} />
              )}
              {feedback.message}
            </p>
          )}
          <div className="whatsapp-test-actions">
            {tests.map(({ kind, title, description }) => (
              <section key={kind}>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <Button
                  disabled={!phone.trim() || sending !== null}
                  onClick={() => void send(kind)}
                >
                  <Send size={16} /> {sending === kind ? 'Enviando…' : 'Enviar prueba'}
                </Button>
              </section>
            ))}
          </div>
        </CardContent>
      </Card>
      <p className="whatsapp-test-note">
        Requiere las plantillas de utilidad aprobadas en Meta y las credenciales configuradas como
        secretos de la Edge Function. Las pruebas no crean solicitudes ni modifican datos de
        clientes.
      </p>
    </div>
  )
}

function PageHeader() {
  return (
    <header className="whatsapp-test-heading">
      <span className="eyebrow">Integraciones</span>
      <h2>Pruebas de WhatsApp</h2>
      <p>Comprueba la conexión y las dos comunicaciones automatizadas antes de activarlas.</p>
    </header>
  )
}
