-- The Redsys migration replaced the invoice confirmation function without
-- setting the guard required to issue an invoice draft.
create or replace function public.confirm_invoice_payment(
  p_payment_id uuid,
  p_paid_at timestamptz,
  p_gateway_response jsonb,
  p_issuer_snapshot jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  payment public.invoice_payments;
  draft public.invoice_drafts;
  issued_id uuid;
  next_number integer;
  issued_year integer := extract(year from p_paid_at at time zone 'Europe/Madrid');
  operation_date date;
  payment_method text;
begin
  select * into payment from public.invoice_payments where id = p_payment_id for update;
  if payment.id is null then raise exception 'Pago no encontrado'; end if;
  if payment.status not in ('pendiente', 'pagado') or p_paid_at is null then
    raise exception 'El pago no se puede confirmar.';
  end if;

  select * into draft from public.invoice_drafts where id = payment.invoice_id for update;
  if draft.id is null then raise exception 'Solicitud de pago no encontrada'; end if;
  if payment.amount_cents <> round(draft.total_amount * 100)::integer then
    raise exception 'El importe del pago no coincide con la solicitud.';
  end if;
  if coalesce(btrim(draft.client_snapshot ->> 'fullName'), '') = ''
    or coalesce(btrim(draft.client_snapshot ->> 'nif'), '') = ''
    or coalesce(btrim(draft.client_snapshot ->> 'address'), '') = ''
    or coalesce(btrim(draft.client_snapshot ->> 'postalCode'), '') = ''
    or coalesce(btrim(draft.client_snapshot ->> 'city'), '') = '' then
    raise exception 'Faltan datos fiscales del destinatario; no se puede emitir la factura.';
  end if;
  if coalesce(btrim(p_issuer_snapshot ->> 'name'), '') = ''
    or coalesce(btrim(p_issuer_snapshot ->> 'taxId'), '') = ''
    or coalesce(btrim(p_issuer_snapshot ->> 'address'), '') = '' then
    raise exception 'Faltan datos fiscales del emisor.';
  end if;

  select id into issued_id from public.issued_invoices where invoice_draft_id = draft.id;
  if issued_id is not null then
    update public.invoice_payments
    set status = 'pagado', paid_at = coalesce(paid_at, p_paid_at), gateway_response = p_gateway_response
    where id = payment.id;
    return issued_id;
  end if;

  select service_date into operation_date from public.carriage_letters where id = draft.letter_id;
  if operation_date is null then raise exception 'No se ha encontrado la fecha de operación.'; end if;
  payment_method := case
    when payment.provider = 'manual' then coalesce(nullif(p_gateway_response ->> 'paymentMethod', ''), 'Cobro manual')
    else 'Bizum'
  end;

  insert into public.invoice_series_counters(series, fiscal_year, last_number)
  values ('F', issued_year, 1)
  on conflict (series, fiscal_year) do update
  set last_number = public.invoice_series_counters.last_number + 1
  returning last_number into next_number;

  perform set_config('app.confirming_invoice_payment', 'true', true);
  update public.invoice_drafts set status = 'emitida' where id = draft.id;
  insert into public.issued_invoices(invoice_draft_id, fiscal_year, sequence_number, issued_at, fiscal_snapshot)
  values (draft.id, issued_year, next_number, p_paid_at, jsonb_build_object(
    'issuer', p_issuer_snapshot,
    'number', concat('F-', issued_year::text, '-', lpad(next_number::text, 6, '0')),
    'client', draft.client_snapshot,
    'concept', draft.concept,
    'net_amount', draft.net_amount,
    'vat_rate', draft.vat_rate,
    'vat_amount', draft.vat_amount,
    'total_amount', draft.total_amount,
    'payment_method', payment_method,
    'payment_date', p_paid_at,
    'operation_date', operation_date
  )) returning id into issued_id;

  update public.invoice_payments
  set status = 'pagado', paid_at = p_paid_at, gateway_response = p_gateway_response
  where id = payment.id;
  if draft.delivery_channel in ('email', 'both') and btrim(draft.delivery_email) <> '' then
    insert into public.billing_notifications(invoice_draft_id, issued_invoice_id, kind, channel, recipient)
    values (draft.id, issued_id, 'factura_emitida', 'email', draft.delivery_email)
    on conflict do nothing;
  end if;
  if draft.delivery_channel in ('whatsapp', 'both') and btrim(draft.delivery_phone) <> '' then
    insert into public.billing_notifications(invoice_draft_id, issued_invoice_id, kind, channel, recipient)
    values (draft.id, issued_id, 'factura_emitida', 'whatsapp', draft.delivery_phone)
    on conflict do nothing;
  end if;
  return issued_id;
end;
$$;

notify pgrst, 'reload schema';