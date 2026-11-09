import type { InvoiceClientInput, ManualInvoiceInput } from '@/shared/types'

export function fiscalClient(client: InvoiceClientInput): InvoiceClientInput {
  const normalized = Object.fromEntries(
    Object.entries(client).map(([key, value]) => [key, value.trim()]),
  ) as InvoiceClientInput
  const required = [
    ['nombre o razón social', normalized.fullName],
    ['NIF/CIF', normalized.nif],
    ['dirección', normalized.address],
    ['código postal', normalized.postalCode],
    ['ciudad', normalized.city],
  ]
  const missing = required.filter(([, value]) => !value).map(([label]) => label)
  if (missing.length) throw new Error(`Completa los datos fiscales: ${missing.join(', ')}.`)
  return normalized
}

export function invoiceAmounts(total: number, vatRate = 21) {
  const totalCents = Math.round(total * 100)
  if (
    !Number.isFinite(total) ||
    totalCents <= 0 ||
    totalCents > 99_999_999 ||
    Math.abs(total * 100 - totalCents) > 0.000001
  )
    throw new Error('El total debe ser un importe positivo con un máximo de dos decimales.')
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100 || Math.abs(vatRate * 100 - Math.round(vatRate * 100)) > 0.000001)
    throw new Error('El tipo de IVA de la factura no es válido.')
  const netCents = Math.round((totalCents * 10000) / (10000 + Math.round(vatRate * 100)))
  return {
    netAmount: netCents / 100,
    vatAmount: (totalCents - netCents) / 100,
    totalAmount: totalCents / 100,
  }
}

export function validateManualInvoice(input: ManualInvoiceInput): ManualInvoiceInput {
  const client = fiscalClient(input.client)
  const concept = input.concept.trim()
  if (!concept || concept.length > 500)
    throw new Error('Indica un concepto de hasta 500 caracteres.')
  invoiceAmounts(input.total)
  const date = new Date(`${input.operationDate}T12:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.operationDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.operationDate ||
    input.operationDate >
      new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())
  )
    throw new Error('Indica una fecha de operación válida que no sea futura.')
  if (!['Transferencia', 'Bizum', 'Tarjeta'].includes(input.paymentMethod))
    throw new Error('Selecciona un método de cobro válido.')
  return { ...input, client, concept }
}
