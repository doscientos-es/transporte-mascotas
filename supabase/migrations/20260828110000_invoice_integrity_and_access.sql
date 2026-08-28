-- Fiscal amounts are stored explicitly so the payable total always equals base + VAT.
alter table public.invoice_drafts
  add column if not exists vat_amount_fixed numeric(12,2) not null default 0,
  add column if not exists total_amount_fixed numeric(12,2) not null default 0;

update public.invoice_drafts
set vat_amount_fixed = vat_amount,
    total_amount_fixed = total_amount;

alter table public.invoice_drafts
  drop column vat_amount,
  drop column total_amount;

alter table public.invoice_drafts
  rename column vat_amount_fixed to vat_amount;

alter table public.invoice_drafts
  rename column total_amount_fixed to total_amount;

alter table public.invoice_drafts
  add constraint invoice_drafts_amounts_consistent
  check (total_amount = round(net_amount + vat_amount, 2));

alter table public.invoice_payments drop constraint if exists invoice_payments_provider_check;
alter table public.invoice_payments
  add constraint invoice_payments_provider_check
  check (provider in ('caixabank_cyberpac', 'manual'));
create unique index if not exists invoice_payments_one_manual_per_invoice_idx
  on public.invoice_payments(invoice_id) where provider = 'manual';

-- Issued invoices can be read by administrators to generate a document from the immutable snapshot.
create policy "issued invoices admin read" on public.issued_invoices
  for select to authenticated using (public.is_admin());

create index if not exists invoice_drafts_status_created_at_idx
  on public.invoice_drafts(status, created_at desc);
create index if not exists issued_invoices_issued_at_idx
  on public.issued_invoices(issued_at desc);

create table public.invoice_events (
  id bigint generated always as identity primary key,
  invoice_draft_id uuid not null references public.invoice_drafts(id) on delete restrict,
  issued_invoice_id uuid references public.issued_invoices(id) on delete restrict,
  event_type text not null check (event_type in ('payment_request_created', 'invoice_issued')),
  data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
alter table public.invoice_events enable row level security;
create policy "invoice events admin read" on public.invoice_events
  for select to authenticated using (public.is_admin());
revoke all on public.invoice_events from public, anon, authenticated;
grant select on public.invoice_events to authenticated;

create function public.audit_invoice_draft_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.invoice_events(invoice_draft_id, event_type, data)
  values (new.id, 'payment_request_created', jsonb_build_object('status', new.status, 'total_amount', new.total_amount));
  insert into public.audit_logs(actor_id, event_type, entity_type, entity_id, data)
  values (new.created_by, 'invoice_payment_request_created', 'invoice_draft', new.id::text, jsonb_build_object('total_amount', new.total_amount));
  return new;
end;
$$;

create trigger invoice_drafts_audit_created
after insert on public.invoice_drafts for each row execute function public.audit_invoice_draft_created();

create function public.audit_issued_invoice_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.invoice_events(invoice_draft_id, issued_invoice_id, event_type, data)
  values (new.invoice_draft_id, new.id, 'invoice_issued', jsonb_build_object('number', new.fiscal_snapshot ->> 'number', 'issued_at', new.issued_at));
  insert into public.audit_logs(event_type, entity_type, entity_id, data)
  values ('invoice_issued', 'issued_invoice', new.id::text, jsonb_build_object('invoice_draft_id', new.invoice_draft_id, 'number', new.fiscal_snapshot ->> 'number'));
  return new;
end;
$$;

create trigger issued_invoices_audit_created
after insert on public.issued_invoices for each row execute function public.audit_issued_invoice_created();

create function public.prevent_issued_invoice_draft_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.status = 'emitida' then
    raise exception 'Una factura emitida no se puede eliminar; emite una rectificativa o anulación.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'emitida' then
    raise exception 'Una factura emitida es inmutable; emite una rectificativa o anulación.';
  end if;
  if tg_op = 'UPDATE' and new.status = 'emitida' and current_setting('app.confirming_invoice_payment', true) is distinct from 'true' then
    raise exception 'La emisión debe realizarse desde la confirmación de cobro.';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.invoice_payments where invoice_id = old.id) and (
    new.client_id is distinct from old.client_id or new.payer is distinct from old.payer or new.client_snapshot is distinct from old.client_snapshot or
    new.concept is distinct from old.concept or new.net_amount is distinct from old.net_amount or new.vat_rate is distinct from old.vat_rate or
    new.vat_amount is distinct from old.vat_amount or new.total_amount is distinct from old.total_amount
  ) then
    raise exception 'No se pueden modificar datos fiscales después de iniciar el cobro.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger invoice_drafts_prevent_issued_mutation
before update or delete on public.invoice_drafts for each row execute function public.prevent_issued_invoice_draft_mutation();

create or replace function public.confirm_invoice_payment(p_payment_id uuid, p_paid_at timestamptz, p_gateway_response jsonb, p_issuer_snapshot jsonb)
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
  if payment.status not in ('pendiente', 'pagado') or p_paid_at is null then raise exception 'El pago no se puede confirmar.'; end if;
  select * into draft from public.invoice_drafts where id = payment.invoice_id for update;
  if draft.id is null then raise exception 'Solicitud de pago no encontrada'; end if;
  if payment.amount_cents <> round(draft.total_amount * 100)::integer then raise exception 'El importe del pago no coincide con la solicitud.'; end if;
  if coalesce(btrim(draft.client_snapshot ->> 'fullName'), '') = '' or coalesce(btrim(draft.client_snapshot ->> 'nif'), '') = '' or coalesce(btrim(draft.client_snapshot ->> 'address'), '') = '' or coalesce(btrim(draft.client_snapshot ->> 'postalCode'), '') = '' or coalesce(btrim(draft.client_snapshot ->> 'city'), '') = '' then
    raise exception 'Faltan datos fiscales del destinatario; no se puede emitir la factura.';
  end if;
  if coalesce(btrim(p_issuer_snapshot ->> 'name'), '') = '' or coalesce(btrim(p_issuer_snapshot ->> 'taxId'), '') = '' or coalesce(btrim(p_issuer_snapshot ->> 'address'), '') = '' then raise exception 'Faltan datos fiscales del emisor.'; end if;

  select id into issued_id from public.issued_invoices where invoice_draft_id = draft.id;
  if issued_id is not null then
    update public.invoice_payments set status = 'pagado', paid_at = coalesce(paid_at, p_paid_at), gateway_response = p_gateway_response where id = payment.id;
    return issued_id;
  end if;

  select service_date into operation_date from public.carriage_letters where id = draft.letter_id;
  if operation_date is null then raise exception 'No se ha encontrado la fecha de operación.'; end if;
  payment_method := case when payment.provider = 'manual' then coalesce(nullif(p_gateway_response ->> 'paymentMethod', ''), 'Cobro manual') else 'Bizum' end;
  perform set_config('app.confirming_invoice_payment', 'true', true);
  insert into public.invoice_series_counters(series, fiscal_year, last_number)
  values ('F', issued_year, 1)
  on conflict (series, fiscal_year) do update set last_number = public.invoice_series_counters.last_number + 1
  returning last_number into next_number;

  update public.invoice_drafts set status = 'emitida' where id = draft.id;
  insert into public.issued_invoices(invoice_draft_id, fiscal_year, sequence_number, issued_at, fiscal_snapshot)
  values (draft.id, issued_year, next_number, p_paid_at, jsonb_build_object(
    'issuer', p_issuer_snapshot, 'number', concat('F-', issued_year::text, '-', lpad(next_number::text, 6, '0')),
    'client', draft.client_snapshot, 'concept', draft.concept, 'net_amount', draft.net_amount,
    'vat_rate', draft.vat_rate, 'vat_amount', draft.vat_amount, 'total_amount', draft.total_amount,
    'payment_method', payment_method, 'payment_date', p_paid_at, 'operation_date', operation_date
  )) returning id into issued_id;

  update public.invoice_payments set status = 'pagado', paid_at = p_paid_at, gateway_response = p_gateway_response where id = payment.id;
  if draft.delivery_channel in ('email', 'both') and btrim(draft.delivery_email) <> '' then
    insert into public.billing_notifications(invoice_draft_id, issued_invoice_id, kind, channel, recipient) values (draft.id, issued_id, 'factura_emitida', 'email', draft.delivery_email) on conflict do nothing;
  end if;
  if draft.delivery_channel in ('whatsapp', 'both') and btrim(draft.delivery_phone) <> '' then
    insert into public.billing_notifications(invoice_draft_id, issued_invoice_id, kind, channel, recipient) values (draft.id, issued_id, 'factura_emitida', 'whatsapp', draft.delivery_phone) on conflict do nothing;
  end if;
  return issued_id;
end;
$$;

revoke all on function public.confirm_invoice_payment(uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;
