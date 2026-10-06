import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'

import { SettingsPage } from './settings-page'

describe('SettingsPage', () => {
  it('renders the email test action directly in settings', () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        onPromote: async () => {},
        invitations: [],
        onInvite: async () => {},
        onRevokeInvitation: async () => {},
        boxCatalog: defaultTransportBoxCatalog,
        onSaveBoxCatalog: async () => {},
      }),
    )

    expect(markup).toContain('Prueba de email')
    expect(markup).toContain('Enviar prueba de email')
    expect(markup).not.toContain('href="/ajustes/email"')
  })
})
