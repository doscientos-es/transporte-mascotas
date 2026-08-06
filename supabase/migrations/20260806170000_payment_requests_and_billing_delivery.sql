alter type public.invoice_draft_status add value if not exists 'solicitud_pago';
alter type public.invoice_draft_status add value if not exists 'emitida';

alter table public.invoice_drafts
  add column if not exists delivery_channel text not null default 'email' check (delivery_channel in ('email', 'whatsapp', 'both')),
  add column if not exists delivery_email text not null default '',
  add column if not exists delivery_phone text not null default '';

create table public.issued_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_draft_id uuid not null unique references public.invoice_drafts(id) on delete restrict,
  series text not null default 'F',
  fiscal_year integer not null check (fiscal_year between 2020 and 2100),
  sequence_number integer not null check (sequence_number > 0),
  issued_at timestamptz not null,
  public_token uuid not null unique default gen_random_uuid(),
  document_expires_at timestamptz not null default now() + interval '30 days',
  fiscal_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (series, fiscal_year, sequence_number)
);

create table public.invoice_series_counters (
  series text not null,
  fiscal_year integer not null check (fiscal_year between 2020 and 2100),
  last_number integer not null default 0 check (last_number >= 0),
  primary key (series, fiscal_year)
);

create table public.billing_notifications (
  id uuid primary key default gen_random_uuid(),
  invoice_draft_id uuid not null references public.invoice_drafts(id) on delete cascade,
  issued_invoice_id uuid references public.issued_invoices(id) on delete cascade,
  kind text not null check (kind in ('solicitud_pago', 'factura_emitida')),
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'procesando', 'enviada', 'fallida')),
  provider_message_id text,
  error_message text,
  attempts integer not null default 0 check (attempts >= 0),
  processing_started_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (invoice_draft_id, issued_invoice_id, kind, channel)
);

create index billing_notifications_pending_idx on public.billing_notifications(status, created_at) where status = 'pendiente';

create trigger billing_notifications_updated_at
before update on public.billing_notifications for each row execute function public.set_updated_at();

create function public.queue_payment_request_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'solicitud_pago' then return new; end if;
  if new.delivery_channel in ('email', 'both') and btrim(new.delivery_email) <> '' then
    insert into public.billing_notifications(invoice_draft_id, kind, channel, recipient)
    values (new.id, 'solicitud_pago', 'email', new.delivery_email)
    on conflict do nothing;
  end if;
  if new.delivery_channel in ('whatsapp', 'both') and btrim(new.delivery_phone) <> '' then
    insert into public.billing_notifications(invoice_draft_id, kind, channel, recipient)
    values (new.id, 'solicitud_pago', 'whatsapp', new.delivery_phone)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger invoice_drafts_queue_payment_request
after insert on public.invoice_drafts for each row execute function public.queue_payment_request_notifications();

create function public.confirm_invoice_payment(p_payment_id uuid, p_paid_at timestamptz, p_gateway_response jsonb, p_issuer_snapshot jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  payment public.invoice_payments;
  draft public.invoice_drafts;
  issued_id uuid;
  next_number integer;
  issued_year integer := extract(year from p_paid_at at time zone 'Europe/Madrid');
begin
  select * into payment from public.invoice_payments where id = p_payment_id for update;
  if payment.id is null then raise exception 'Pago no encontrado'; end if;
  select * into draft from public.invoice_drafts where id = payment.invoice_id for update;
  if draft.id is null then raise exception 'Solicitud de pago no encontrada'; end if;

  select id into issued_id from public.issued_invoices where invoice_draft_id = draft.id;
  if issued_id is not null then
    update public.invoice_payments set status = 'pagado', paid_at = coalesce(paid_at, p_paid_at), gateway_response = p_gateway_response where id = payment.id;
    return issued_id;
  end if;

  insert into public.invoice_series_counters(series, fiscal_year, last_number)
  values ('F', issued_year, 1)
  on conflict (series, fiscal_year) do update set last_number = public.invoice_series_counters.last_number + 1
  returning last_number into next_number;

  insert into public.issued_invoices(invoice_draft_id, fiscal_year, sequence_number, issued_at, fiscal_snapshot)
  values (draft.id, issued_year, next_number, p_paid_at, jsonb_build_object(
    'issuer', p_issuer_snapshot, 'number', concat('F-', issued_year::text, '-', lpad(next_number::text, 6, '0')),
    'client', draft.client_snapshot, 'concept', draft.concept, 'net_amount', draft.net_amount,
    'vat_rate', draft.vat_rate, 'vat_amount', draft.vat_amount, 'total_amount', draft.total_amount,
    'payment_method', 'Bizum', 'payment_date', p_paid_at
  )) returning id into issued_id;

  update public.invoice_payments set status = 'pagado', paid_at = p_paid_at, gateway_response = p_gateway_response where id = payment.id;
  update public.invoice_drafts set status = 'emitida' where id = draft.id;

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

revoke all on function public.confirm_invoice_payment(uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;

create function public.claim_billing_notifications(p_invoice_draft_id uuid, p_kind text)
returns setof public.billing_notifications language plpgsql security definer set search_path = '' as $$
begin
  return query
  with candidates as (
    select id from public.billing_notifications
    where invoice_draft_id = p_invoice_draft_id
      and kind = p_kind
      and (status in ('pendiente', 'fallida') or (status = 'procesando' and processing_started_at < now() - interval '10 minutes'))
    order by created_at
    for update skip locked
  )
  update public.billing_notifications notification
  set status = 'procesando', attempts = notification.attempts + 1, processing_started_at = now(), error_message = null
  from candidates
  where notification.id = candidates.id
  returning notification.*;
end;
$$;

revoke all on function public.claim_billing_notifications(uuid, text) from public, anon, authenticated;
alter table public.issued_invoices enable row level security;
alter table public.invoice_series_counters enable row level security;
alter table public.billing_notifications enable row level security;
revoke all on public.issued_invoices, public.invoice_series_counters, public.billing_notifications from public, anon, authenticated;
