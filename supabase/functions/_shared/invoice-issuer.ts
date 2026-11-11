const ISSUER_NAME = 'Kache Envíos'

export function invoiceIssuerSnapshot() {
  const taxId = Deno.env.get('INVOICE_ISSUER_TAX_ID')
  const address = Deno.env.get('INVOICE_ISSUER_ADDRESS')
  if (!taxId || !address) return null
  return { name: ISSUER_NAME, taxId, address }
}

export function requireInvoiceIssuerSnapshot() {
  const issuer = invoiceIssuerSnapshot()
  if (!issuer) throw new Error('Faltan los datos fiscales del emisor.')
  return issuer
}