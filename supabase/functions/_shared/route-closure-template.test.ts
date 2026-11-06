import { describe, expect, it } from 'vitest'

import { routeClosureEmail } from './route-closure-template'

describe('route closure email', () => {
  it('does not assume closure happens the day before the route', () => {
    const message = routeClosureEmail({
      name: 'Ana',
      date: '10 de diciembre',
      routeName: 'Sur',
      stops: ['Madrid', 'Sevilla'],
      portalUrl: null,
    })
    expect(message.subject).toContain('10 de diciembre')
    expect(message.text).toContain('Madrid')
    expect(`${message.subject} ${message.text} ${message.html}`.toLowerCase()).not.toContain(
      'mañana',
    )
  })
})
