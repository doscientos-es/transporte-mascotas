import { Input, Label } from '@doscientos/ui'

import type { InvoiceClientInput } from '@/shared/types'

const fields: Array<{
  key: keyof InvoiceClientInput
  label: string
  type?: string
  fiscal?: boolean
}> = [
  { key: 'fullName', label: 'Nombre completo o razón social', fiscal: true },
  { key: 'nif', label: 'NIF/CIF', fiscal: true },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Teléfono', type: 'tel' },
  { key: 'address', label: 'Dirección', fiscal: true },
  { key: 'postalCode', label: 'Código postal', fiscal: true },
  { key: 'city', label: 'Ciudad', fiscal: true },
]

export function ClientFields({
  value,
  onChange,
  requireFiscal = false,
}: {
  value: InvoiceClientInput
  onChange: (field: keyof InvoiceClientInput, value: string) => void
  requireFiscal?: boolean
}) {
  return fields.map((field) => (
    <Label key={field.key} className={field.key === 'address' ? 'form-span' : undefined}>
      {field.label}
      <Input
        type={field.type ?? 'text'}
        value={value[field.key]}
        maxLength={300}
        required={field.key === 'fullName' || (requireFiscal && field.fiscal)}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    </Label>
  ))
}
