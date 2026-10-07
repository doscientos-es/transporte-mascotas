import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'

import { SettingsPage } from './settings-page'

describe('SettingsPage', () => {
  it('renders the email test action directly in settings', () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        invitations: [],
        onInvite: async () => {},
        onRevokeInvitation: async () => {},
        boxCatalog: defaultTransportBoxCatalog,
        onSaveBoxCatalog: async () => {},
        meetingPoints: [],
        onSaveMeetingPoint: async () => {},
        onDeleteMeetingPoint: async () => {},
      }),
    )

    expect(markup).toContain('Prueba de email')
    expect(markup).toContain('Enviar prueba de email')
    expect(markup).toContain('Puntos de encuentro')
    expect(markup).toContain('Añadir punto')
    expect(markup).not.toContain('href="/ajustes/email"')
  })
})
