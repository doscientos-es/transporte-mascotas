import { Button, Card, CardContent } from '@doscientos/ui'
import { ArrowLeft, CircleAlert, CheckCircle2, Send } from 'lucide-react'
import { useState } from 'react'

import { sendEmailTest } from '../application/email-test'

type Props = { onBack: () => void }

export function EmailTestPage({ onBack }: Props) {
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(
    null,
  )

  async function send() {
    setSending(true)
    setFeedback(null)
    try {
      const { email } = await sendEmailTest()
      setFeedback({ type: 'success', message: `Email de prueba enviado a ${email}.` })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se ha podido enviar el email.',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="email-test-page">
      <button className="settings-back-link" type="button" onClick={onBack}>
        <ArrowLeft size={16} /> Volver a Ajustes
      </button>
      <Card className="email-test-card">
        <CardContent>
          <p className="email-test-note">
            Envía un correo real a la dirección asociada a tu cuenta de administrador, usando el
            mismo proveedor y la configuración que los emails operativos.
          </p>
          {feedback && (
            <p
              className={`email-test-feedback is-${feedback.type}`}
              role={feedback.type === 'error' ? 'alert' : 'status'}
            >
              {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
              {feedback.message}
            </p>
          )}
          <Button disabled={sending} onClick={() => void send()}>
            <Send size={16} /> {sending ? 'Enviando…' : 'Enviar prueba de email'}
          </Button>
        </CardContent>
      </Card>
      <p className="email-test-note">
        Si no lo recibes, revisa la carpeta de spam y la configuración del remitente en Resend.
      </p>
    </div>
  )
}
