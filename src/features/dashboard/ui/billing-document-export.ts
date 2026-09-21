import type { ClientInvoice } from '@/shared/types'

const cell = (value: unknown) => {
  const text =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : ''
  return `"${text.replaceAll('"', '""')}"`
}

export function downloadInvoiceRegister(invoices: ClientInvoice[]) {
  const header = [
    'Número',
    'Estado',
    'Fecha',
    'Cliente',
    'NIF/CIF',
    'Carta de porte',
    'Concepto',
    'Base',
    'IVA',
    'Total',
  ]
  const rows = invoices.map((invoice) => {
    const fiscal = invoice.issuedInvoice?.fiscalSnapshot
    const client = fiscal?.client
    return [
      invoice.issuedInvoice?.number ?? '',
      invoice.status,
      invoice.issuedInvoice?.issuedAt ?? invoice.createdAt,
      client?.fullName ?? invoice.clientName ?? '',
      client?.nif ?? invoice.clientNif ?? '',
      invoice.letterId,
      fiscal?.concept ?? invoice.concept,
      fiscal?.net_amount ?? '',
      fiscal?.vat_amount ?? '',
      invoice.total,
    ]
  })
  const csv = [header, ...rows].map((row) => row.map(cell).join(';')).join('\n')
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `registro-facturacion-${today()}.csv`,
  )
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
