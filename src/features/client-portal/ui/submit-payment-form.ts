import type { TransportPaymentForm } from '../application/transport-requests'

export function submitPaymentForm(payment: TransportPaymentForm) {
  const form = document.createElement('form')
  form.method = 'post'
  form.action = payment.endpoint
  form.hidden = true
  for (const [name, value] of Object.entries(payment.fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.append(input)
  }
  document.body.append(form)
  form.submit()
}
