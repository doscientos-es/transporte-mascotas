import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'

import { SettingsPage } from './settings-page'

describe('SettingsPage', () => {
  it('renders the email test action directly in settings', () => {
    const meetingPoint = {
      id: 'meeting-point-1',
      name: 'Gasolinera',
      locality: 'Murcia',
      place: 'Junto a IKEA',
      street: '',
      streetNumber: '',
      floor: '',
      postalCode: '',
      province: '',
      country: 'España',
      latitude: 37.9922,
      longitude: -1.1307,
    }
    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        invitations: [],
        onInvite: async () => {},
        onRevokeInvitation: async () => {},
        boxCatalog: defaultTransportBoxCatalog,
        onSaveBoxCatalog: async () => {},
        meetingPoints: [meetingPoint],
        onSaveMeetingPoint: async () => {},
        onDeleteMeetingPoint: async () => {},
      }),
    )

    expect(markup).toContain('Prueba de email')
    expect(markup).toContain('Enviar prueba de email')
    expect(markup).toContain('Puntos de encuentro')
    expect(markup).toContain('Añadir punto')
    expect(markup).toContain('Gasolinera · Murcia')
    expect(markup).toContain('Junto a IKEA')
    expect(markup).not.toContain('href="/ajustes/email"')
  })
})
