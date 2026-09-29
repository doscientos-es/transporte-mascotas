import { MessageCircle } from 'lucide-react'

import { whatsAppUrl } from '@/shared/application/whatsapp-phone'

type Props = { phone: string; message: string; label?: string; recipient?: string }

export function WhatsAppLink({ phone, message, label = 'WhatsApp', recipient }: Props) {
  const href = whatsAppUrl(phone, message)
  if (!href) return null
  return (
    <a
      className="whatsapp-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={recipient ? `Enviar WhatsApp a ${recipient}` : 'Enviar WhatsApp'}
    >
      <MessageCircle size={13} aria-hidden="true" /> {label}
    </a>
  )
}
