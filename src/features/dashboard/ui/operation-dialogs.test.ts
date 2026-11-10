import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'
import type { DailyRoute, Letter, RouteTemplate } from '@/shared/types'

import { actionsForLetter } from '../application/use-dashboard'
import { LetterForm } from './operation-dialogs'

const stops = ['Madrid', 'Zaragoza', 'Madrid', 'Barcelona'].map((locality, index) => ({
  id: `stop-${index + 1}`,
  locality,
  place: '',
  mapUrl: '',
  latitude: 40,
  longitude: -3,
  minutes: 0,
  kind: 'parada' as const,
  dwellMinutes: 15,
}))

const route: DailyRoute = {
  id: 'route-1',
  templateId: 'template-1',
  date: '2099-10-01',
  status: 'activa',
  actions: [
    {
      id: 'action-1',
      letterId: 'letter-1',
      animalId: 'animal-1',
      type: 'recogida',
      stop: 'Madrid',
      customer: 'Ana',
      phone: '600000000',
      status: 'pendiente',
      stopId: 'stop-1',
    },
  ],
  stops,
}

const template: RouteTemplate = {
  id: 'template-1',
  name: 'Ruta repetida',
  color: '#b51e27',
  stops,
}

const letter: Letter = {
  id: 'letter-1',
  sender: 'Ana',
  senderPhone: '600000000',
  senderEmail: 'ana@example.test',
  senderNif: '12345678Z',
  senderAddress: 'Calle Mayor 1',
  senderPostalCode: '28001',
  senderCity: 'Madrid',
  senderProvince: 'Madrid',
  recipient: 'Luis',
  recipientPhone: '611111111',
  recipientEmail: 'luis@example.test',
  recipientNif: '87654321X',
  recipientAddress: 'Avenida 2',
  recipientPostalCode: '46001',
  recipientCity: 'Barcelona',
  recipientProvince: 'Barcelona',
  origin: 'Madrid',
  destination: 'Barcelona',
  originPoint: '',
  destinationPoint: '',
  accompanyingDocuments: ['microchip'],
  billingPayer: 'remitente',
  billingClient: {
    fullName: 'Ana',
    nif: '12345678Z',
    email: 'ana@example.test',
    phone: '600000000',
    address: 'Calle Mayor 1',
    city: 'Madrid',
    postalCode: '28001',
  },
  route: 'Ruta repetida',
  serviceDate: '2099-10-01',
  status: 'pendiente',
  animals: [],
  importedAt: '',
}

describe('LetterForm saved clients', () => {
  it.each([
    ['admin creating', true, undefined, true],
    ['non-admin creating', false, undefined, false],
    ['admin editing', true, letter, false],
  ])('limits the optional lookup to %s', (_, canLookupClients, existingLetter, expected) => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        letter: existingLetter,
        fullPage: true,
        canLookupClients,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn(),
        onAddStop: vi.fn(),
      }),
    )
    expect(markup.includes('Buscar remitente existente (opcional)')).toBe(expected)
    expect(markup.includes('Buscar destinatario existente (opcional)')).toBe(expected)
    expect(markup).toContain('placeholder="Ej. María García López"')
    expect(markup).toContain('placeholder="Ej. Calle Mayor 12"')
  })
})

describe('LetterForm logo', () => {
  it.each([
    ['creation', undefined],
    ['editing', letter],
  ])('uses the current logo during %s', (_, existingLetter) => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        letter: existingLetter,
        routeId: route.id,
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn(),
        onAddStop: vi.fn(),
      }),
    )

    expect(markup).toMatch(/<img[^>]*src="\/logo\.png"[^>]*alt="Kache Envíos"/)
    expect(markup).not.toContain('/icon-512.png')
  })
})

describe('LetterForm contact addresses', () => {
  it.each([
    ['creation', undefined, 'off'],
    ['editing', letter, 'street-address'],
  ])('uses the expected address autocomplete setting during %s', (_, existingLetter, setting) => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        letter: existingLetter,
        routeId: route.id,
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn(),
        onAddStop: vi.fn(),
      }),
    )
    const addresses = markup.match(/<input[^>]*placeholder="Ej\. Calle Mayor 12"[^>]*>/g) ?? []

    expect(addresses).toHaveLength(2)
    expect(addresses.every((input) => input.includes(`autoComplete="${setting}"`))).toBe(true)
    expect(addresses.every((input) => input.includes('required=""'))).toBe(true)
    if (!existingLetter) {
      expect(markup).not.toContain('autoComplete="address-level2"')
      expect(markup).not.toContain('autoComplete="address-level1"')
      expect(markup).not.toContain('autoComplete="postal-code"')
    }
  })
})

describe('LetterForm route stops', () => {
  it('shows the selected destination with a warning when it is not after the origin', () => {
    const pickup = route.actions[0]
    if (!pickup) throw new Error('Missing pickup action')
    const invalidRoute = {
      ...route,
      actions: [
        { ...pickup, stopId: 'stop-3' },
        { ...pickup, id: 'delivery', type: 'entrega' as const, stopId: 'stop-2' },
      ],
    }
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [invalidRoute],
        templates: [template],
        letter,
        routeId: route.id,
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn(),
        onAddStop: vi.fn(),
      }),
    )
    expect(markup).toMatch(
      /<option[^>]*value="stop-2"[^>]*disabled=""[^>]*selected=""[^>]*>Zaragoza · fuera del tramo<\/option>/,
    )
    expect(markup).toContain('El destino debe estar después del origen.')
  })

  it('keeps the selected destination visible when no origin is selected', () => {
    const pickup = route.actions[0]
    if (!pickup) throw new Error('Missing pickup action')
    const noOriginRoute = {
      ...route,
      actions: [{ ...pickup, type: 'entrega' as const, stopId: 'stop-2' }],
    }
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [noOriginRoute],
        templates: [template],
        letter,
        routeId: route.id,
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn(),
        onAddStop: vi.fn(),
      }),
    )
    expect(markup).toMatch(
      /<option[^>]*value="stop-2"[^>]*disabled=""[^>]*selected=""[^>]*>Zaragoza<\/option>/,
    )
    expect(markup).not.toContain('El destino debe estar después del origen.')
  })
})

describe('LetterForm assigned box', () => {
  it.each([
    [17, 'value="17"'],
    [undefined, 'value=""'],
  ])('shows the route assignment (%s) when editing', (box, expectedValue) => {
    const assignedRoute = { ...route, actions: route.actions.map((action) => ({ ...action, box })) }
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [assignedRoute],
        templates: [template],
        letter,
        routeId: route.id,
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn(),
        onAddStop: vi.fn(),
      }),
    )
    const boxInput = markup.match(/<input[^>]*aria-describedby="letter-box-hint"[^>]*>/)?.[0]

    expect(boxInput).toContain(expectedValue)
    expect(boxInput).not.toContain('readOnly')
    expect(boxInput).toContain('max="72"')
    expect(markup).toContain('Vacío: se asigna un box libre automáticamente.')
  })

  it('warns when the selected box is also assigned to another letter', () => {
    const pickup = route.actions[0]
    if (!pickup) throw new Error('Missing pickup action')
    const assignedRoute = {
      ...route,
      actions: [
        { ...pickup, box: 17 },
        { ...pickup, letterId: 'letter-2', box: 17 },
      ],
    }
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [assignedRoute],
        templates: [template],
        letter,
        routeId: route.id,
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn(),
        onAddStop: vi.fn(),
      }),
    )
    expect(markup).toContain('Este box ya está asignado a otra carta')
  })

  it('preserves the assigned box in rebuilt pickup and delivery actions', () => {
    const animal = {
      id: 'animal-1',
      species: 'Gato',
      breed: 'Común',
      birthDate: '',
      weightKg: 2,
      lengthCm: 20,
      heightCm: 20,
      widthCm: 20,
      size: 'pequeno' as const,
    }
    const assignedRoute = {
      ...route,
      actions: route.actions.map((action) => ({ ...action, box: 17 })),
    }
    const actions = actionsForLetter(
      assignedRoute,
      template,
      { ...letter, animals: [animal] },
      defaultTransportBoxCatalog,
      'stop-1',
      'stop-4',
      17,
    )

    expect(actions).toHaveLength(2)
    expect(actions.map((action) => action.box)).toEqual([17, 17])
  })

  it('accepts a manually selected box even when its size is incompatible', () => {
    const animal = {
      id: 'animal-1',
      species: 'Perro',
      breed: 'Labrador',
      birthDate: '',
      weightKg: 40,
      lengthCm: 90,
      heightCm: 60,
      widthCm: 60,
      size: 'grande' as const,
    }
    const actions = actionsForLetter(
      route,
      template,
      { ...letter, animals: [animal] },
      defaultTransportBoxCatalog,
      'stop-1',
      'stop-4',
      17,
    )
    expect(actions.map((action) => action.box)).toEqual([17, 17])
  })

  it.each([0, 73, 1.5])('rejects an invalid box number (%s)', (box) => {
    const animal = { id: 'animal-1', size: 'pequeno' } as Letter['animals'][number]
    expect(() =>
      actionsForLetter(
        route,
        template,
        { ...letter, animals: [animal] },
        defaultTransportBoxCatalog,
        'stop-1',
        'stop-4',
        box,
      ),
    ).toThrow('El número de box debe estar entre 1 y 72')
  })

  it('does not create actions without a compatible box', () => {
    const occupied = [1, 2, 3, 4, 37, 38, 39, 40].map((box) => ({
      ...route.actions[0],
      box,
    }))
    const animal = {
      id: 'animal-1',
      species: 'Perro',
      breed: 'Mestizo',
      birthDate: '',
      weightKg: 70,
      lengthCm: 0,
      heightCm: 0,
      widthCm: 0,
      size: 'grande' as const,
    }
    expect(() =>
      actionsForLetter(
        { ...route, actions: occupied },
        template,
        { ...letter, animals: [animal] },
        defaultTransportBoxCatalog,
        'stop-1',
        'stop-4',
      ),
    ).toThrow('No queda ningún box compatible disponible')
  })
})

describe('LetterForm route stop options', () => {
  it('shows repeated stops as distinct origin and destination options', () => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        letter,
        routeId: route.id,
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(undefined),
        onAddStop: vi.fn().mockResolvedValue(stops[0]),
      }),
    )

    expect(markup).toContain('value="stop-1"')
    expect(markup).toContain('value="stop-3"')
    expect(markup).toContain('Madrid · parada 1')
    expect(markup).toContain('Madrid · parada 3')
  })
})

describe('LetterForm contact emails', () => {
  it.each([
    ['creating a letter', undefined, 2],
    ['editing a letter with another payer', { ...letter, billingPayer: 'manual' as const }, 3],
  ])(
    'allows empty emails when %s while validating any supplied address',
    (_, existingLetter, count) => {
      const markup = renderToStaticMarkup(
        createElement(LetterForm, {
          routes: [route],
          templates: [template],
          letter: existingLetter,
          routeId: route.id,
          fullPage: true,
          boxCatalog: defaultTransportBoxCatalog,
          onClose: vi.fn(),
          onCreate: vi.fn().mockResolvedValue(undefined),
          onAddStop: vi.fn().mockResolvedValue(stops[0]),
        }),
      )
      const emailInputs = markup.match(/<input[^>]*type="email"[^>]*>/g) ?? []

      expect(markup).toContain('Email (opcional)')
      expect(emailInputs).toHaveLength(count)
      expect(emailInputs.every((input) => !input.includes('required=""'))).toBe(true)
    },
  )
})

describe('LetterForm paid manual letter creation', () => {
  it('offers a paid creation action and a payment method for new letters', () => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(undefined),
        onAddStop: vi.fn().mockResolvedValue(stops[0]),
      }),
    )

    expect(markup).toContain('Crear y marcar como pagada')
    expect(markup).toContain('Servicio gratuito o propio: pagada sin factura')
    expect(markup).toContain('No se generará factura, solicitud de pago ni ingresos.')
    expect(markup).toContain('Si ya está pagada, método de cobro')
    expect(markup).toContain('<option>Bizum</option>')
    const amountInput = markup.match(/<input[^>]*name="billingTotal"[^>]*>/)?.[0]
    expect(amountInput).toBeDefined()
    expect(amountInput).toContain('type="number"')
    expect(amountInput).toContain('step="0.01"')
    expect(amountInput).toContain('required=""')
    expect(amountInput).not.toMatch(/\s(?:readonly|disabled|max)=/i)
    expect(markup).toContain('Puedes cobrar más o menos.')
  })

  it('does not offer billing fields or change the free option when editing a complimentary letter', () => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        letter: { ...letter, complimentary: true },
        routeId: route.id,
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn(),
        onAddStop: vi.fn(),
      }),
    )
    expect(markup).not.toContain('¿Quién paga el servicio?')
    expect(markup).not.toContain('Servicio gratuito o propio: pagada sin factura')
  })
})

describe('LetterForm animal breed', () => {
  it('requires a breed when creating a letter', () => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(undefined),
        onAddStop: vi.fn().mockResolvedValue(stops[0]),
      }),
    )
    const breedInput = markup.match(/<input[^>]*placeholder="Ej\. Labrador, Mestizo…"[^>]*>/)?.[0]

    expect(breedInput).toContain('required=""')
  })

  it('keeps breed optional when editing an existing letter', () => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        letter: {
          ...letter,
          animals: [
            {
              id: 'animal-1',
              species: 'Canina',
              breed: '',
              birthDate: '2020-01-01',
              weightKg: 10,
              lengthCm: 0,
              heightCm: 0,
              widthCm: 0,
              size: 'pequeno',
            },
          ],
        },
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(undefined),
        onAddStop: vi.fn().mockResolvedValue(stops[0]),
      }),
    )
    const breedInput = markup.match(
      /<input[^>]*placeholder="Opcional · Ej\. Labrador, Mestizo…"[^>]*>/,
    )?.[0]

    expect(breedInput).toBeDefined()
    expect(breedInput).not.toContain('required=""')
  })
})

describe('LetterForm saved transport-box category', () => {
  it('keeps the configured category when editing a letter', () => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        letter: {
          ...letter,
          animals: [
            {
              id: 'animal-1',
              species: 'Gato',
              breed: 'Común',
              birthDate: '2020-01-01',
              weightKg: 2,
              lengthCm: 30,
              heightCm: 20,
              widthCm: 25,
              size: 'pequeno',
              boxCategory: 'mediano',
            },
          ],
        },
        routeId: route.id,
        fullPage: true,
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(undefined),
        onAddStop: vi.fn().mockResolvedValue(stops[0]),
      }),
    )

    expect(markup.match(/<option value="mediano"[^>]*>/)?.[0]).toContain('selected=""')
  })
})
