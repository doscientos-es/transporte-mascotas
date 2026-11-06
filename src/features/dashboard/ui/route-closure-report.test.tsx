import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RouteClosureReport } from './route-closure-report'

describe('route closure report', () => {
  it('lists missing emails with WhatsApp links and failed deliveries', () => {
    const markup = renderToStaticMarkup(
      createElement(RouteClosureReport, {
        result: {
          closedAt: 'now',
          sent: 1,
          missingEmails: [
            { name: 'Ana', phone: '600 123 456' },
            { name: 'Luis', phone: '' },
          ],
          failedRecipients: [{ name: 'Carmen', email: 'carmen@example.com' }],
        },
      }),
    )
    expect(markup).toContain('Ana')
    expect(markup).toContain('https://wa.me/34600123456')
    expect(markup).toContain('Luis')
    expect(markup).toContain('No hay un teléfono válido')
    expect(markup).toContain('carmen@example.com')
    expect(markup).toContain('Reintenta')
  })

  it('does not claim delivery when the email service could not be reached', () => {
    const markup = renderToStaticMarkup(
      createElement(RouteClosureReport, {
        result: {
          closedAt: 'now',
          sent: null,
          missingEmails: [],
          failedRecipients: [],
        },
      }),
    )
    expect(markup).toContain('No se ha podido confirmar el envío')
  })
})
