import { whatsAppUrl } from '@/shared/application/whatsapp-phone'
import { WhatsAppLink } from '@/shared/ui/whatsapp-link'

import type { RouteClosureResult } from '../application/route-closure'

export function RouteClosureReport({ result }: { result: RouteClosureResult }) {
  return (
    <div>
      <p>
        {result.sent === null
          ? 'No se ha podido confirmar el envío de emails. Reintenta los avisos desde la ruta.'
          : `Emails enviados en este intento: ${result.sent}.`}
      </p>
      {result.failedRecipients.length > 0 && (
        <div role="alert">
          <p>No se han enviado estos emails. Reintenta los avisos desde la ruta:</p>
          <ul>
            {result.failedRecipients.map((person) => (
              <li key={person.email}>
                {person.name || 'Sin nombre'} · {person.email}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.missingEmails.length > 0 && (
        <div>
          <p>Sin email válido; contacta por WhatsApp:</p>
          <ul>
            {result.missingEmails.map((person, index) => (
              <li key={`${person.name}-${person.phone}-${index}`}>
                {person.name || 'Sin nombre'} · {person.phone || 'Sin teléfono'}{' '}
                <WhatsAppLink
                  phone={person.phone}
                  recipient={person.name}
                  message="Hola, hemos cerrado las solicitudes para la ruta de tu transporte. Te informaremos de la hora de recogida o entrega."
                />
                {!whatsAppUrl(person.phone) && 'No hay un teléfono válido para WhatsApp.'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
