-- A free invoice has no transport document, but must have its own operation date.
alter table public.invoice_drafts
  alter column letter_id drop not null,
  add column operation_date date,
  add constraint invoice_drafts_operation_source_check
    check (letter_id is not null or operation_date is not null);

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

  if draft.letter_id is null then
    operation_date := draft.operation_date;
  else
    select service_date into operation_date from public.carriage_letters where id = draft.letter_id;
  end if;
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

-- Only the authenticated admin Edge Function may supply the issuer snapshot.
-- Creation, payment, numbering and issuance are one transaction. A stable UUID
-- serializes retries, including two concurrent submissions after a lost response.
create function public.create_paid_manual_invoice(
  p_invoice_id uuid,
  p_actor_id uuid,
  p_client jsonb,
  p_concept text,
  p_total numeric,
  p_operation_date date,
  p_payment_method text,
  p_issuer_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_client jsonb;
  v_client_id uuid;
  v_payment_id uuid;
  v_issued_id uuid;
  v_net numeric(12,2);
  v_existing public.invoice_drafts;
  v_key text;
begin
  if auth.role() is distinct from 'service_role' or not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'admin' and active
  ) then
    raise exception 'Solo administración puede crear facturas libres.' using errcode = '42501';
  end if;
  if p_invoice_id is null or p_total is null or p_total::text in ('NaN', 'Infinity', '-Infinity')
    or p_total <= 0 or p_total > 999999.99 or p_total <> round(p_total, 2) then
    raise exception 'El total debe ser positivo y tener un máximo de dos decimales.';
  end if;
  if p_operation_date is null or p_operation_date > (now() at time zone 'Europe/Madrid')::date
    or coalesce(length(btrim(p_concept)), 0) not between 1 and 500
    or p_payment_method is null or p_payment_method not in ('Transferencia', 'Bizum', 'Tarjeta') then
    raise exception 'Revisa el concepto, la fecha de operación y el método de cobro.';
  end if;
  if jsonb_typeof(p_client) is distinct from 'object' then
    raise exception 'Datos fiscales no válidos.';
  end if;
  v_client := '{}'::jsonb;
  foreach v_key in array array['fullName', 'nif', 'address', 'postalCode', 'city', 'email', 'phone'] loop
    if (p_client ? v_key and jsonb_typeof(p_client -> v_key) is distinct from 'string')
      or length(coalesce(p_client ->> v_key, '')) > 300 then
      raise exception 'Datos fiscales no válidos.';
    end if;
    v_client := v_client || jsonb_build_object(v_key, btrim(coalesce(p_client ->> v_key, '')));
    if v_key not in ('email', 'phone') and v_client ->> v_key = '' then
      raise exception 'Completa los datos fiscales del cliente.';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(p_invoice_id::text, 0));
  select * into v_existing from public.invoice_drafts where id = p_invoice_id;
  if found then
    if v_existing.letter_id is not null or v_existing.created_by is distinct from p_actor_id
      or v_existing.client_snapshot is distinct from v_client
      or v_existing.concept is distinct from btrim(p_concept)
      or v_existing.total_amount is distinct from p_total
      or v_existing.operation_date is distinct from p_operation_date then
      raise exception 'La solicitud ya se utilizó con otros datos. Abre una nueva factura.';
    end if;
    select id into v_issued_id from public.issued_invoices
    where invoice_draft_id = p_invoice_id and fiscal_snapshot ->> 'payment_method' = p_payment_method;
    if v_issued_id is null then raise exception 'La factura no coincide con el cobro solicitado.'; end if;
    return jsonb_build_object('invoiceDraftId', p_invoice_id, 'issuedInvoiceId', v_issued_id);
  end if;

  v_client_id := public.upsert_client_from_party(
    v_client ->> 'fullName', v_client ->> 'nif', v_client ->> 'email', v_client ->> 'phone',
    v_client ->> 'address', v_client ->> 'city', v_client ->> 'postalCode'
  );
  v_net := round(p_total / 1.21, 2);
  insert into public.invoice_drafts (
    id, letter_id, client_id, payer, client_snapshot, concept, net_amount, vat_rate,
    vat_amount, total_amount, status, delivery_channel, created_by, operation_date
  ) values (
    p_invoice_id, null, v_client_id, 'manual', v_client, btrim(p_concept), v_net, 21,
    p_total - v_net, p_total, 'solicitud_pago', 'manual', p_actor_id, p_operation_date
  );
  insert into public.invoice_payments (invoice_id, provider, merchant_order, amount_cents)
  values (p_invoice_id, 'manual', 'M' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 11), (p_total * 100)::integer)
  returning id into v_payment_id;
  v_issued_id := public.confirm_invoice_payment(
    v_payment_id, now(), jsonb_build_object('paymentMethod', p_payment_method, 'registeredBy', p_actor_id), p_issuer_snapshot
  );
  return jsonb_build_object('invoiceDraftId', p_invoice_id, 'issuedInvoiceId', v_issued_id);
end;
$$;

revoke all on function public.create_paid_manual_invoice(uuid, uuid, jsonb, text, numeric, date, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_paid_manual_invoice(uuid, uuid, jsonb, text, numeric, date, text, jsonb)
  to service_role;

notify pgrst, 'reload schema';