alter table public.transport_requests
  add column payment_attempt_status text not null default 'not_started'
    check (payment_attempt_status in (
      'not_started', 'started', 'confirmation_pending', 'review_required', 'failed', 'confirmed'
    )),
  add column payment_attempt_started_at timestamptz;

update public.transport_requests
set payment_attempt_status = case
  when status in ('confirmada', 'en_ruta', 'entregada') then 'confirmed'
  when paid_at is not null then 'confirmation_pending'
  when payment_gateway_response <> '{}'::jsonb then 'review_required'
  else 'not_started'
end;

create table public.payment_transaction_events (
  id uuid primary key default gen_random_uuid(),
  event_source text not null check (event_source in ('checkout_prepared', 'gateway_notification')),
  payment_kind text not null check (payment_kind in ('transport', 'invoice', 'unmatched')),
  merchant_order text not null,
  payment_record_id uuid,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  expected_amount_cents integer check (expected_amount_cents is null or expected_amount_cents >= 0),
  currency text,
  response_code text,
  authorisation_code text,
  gateway_date text,
  gateway_hour text,
  signature_verified boolean not null default false,
  processing_stage text not null,
  outcome text not null check (outcome in (
    'started', 'received', 'confirmation_pending', 'confirmed', 'declined',
    'review_required', 'retryable_error', 'ignored'
  )),
  error_message text not null default '',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index payment_transaction_events_order_created_idx
  on public.payment_transaction_events (merchant_order, created_at desc);
create index payment_transaction_events_record_created_idx
  on public.payment_transaction_events (payment_kind, payment_record_id, created_at desc);

alter table public.payment_transaction_events enable row level security;
revoke all on public.payment_transaction_events from public, anon;
grant select on public.payment_transaction_events to authenticated;
grant all on public.payment_transaction_events to service_role;
create policy "admins can inspect payment transaction events"
  on public.payment_transaction_events for select to authenticated
  using (public.is_admin());

drop function public.prepare_transport_payment(uuid, uuid);
create function public.prepare_transport_payment(p_request_id uuid, p_requester_id uuid)
returns table (
  public_token uuid,
  merchant_order text,
  expires_at timestamptz,
  reused_existing_attempt boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  request public.transport_requests;
  next_order text;
begin
  select * into request from public.transport_requests
  where id = p_request_id and requester_id = p_requester_id for update;
  if request.id is null then raise exception 'Solicitud no encontrada'; end if;
  if request.status <> 'pago_pendiente' then raise exception 'Esta solicitud ya no admite pagos'; end if;
  if request.paid_at is not null then raise exception 'El pago está en revisión; no vuelvas a pagar'; end if;
  if request.amount_cents <= 0 then raise exception 'El importe de la solicitud no es válido'; end if;

  if request.payment_attempt_status in ('started', 'confirmation_pending', 'review_required') then
    return query select request.payment_public_token, request.payment_merchant_order,
      request.payment_expires_at, true;
    return;
  end if;

  loop
    next_order := lpad(floor(random() * 10000)::integer::text, 4, '0')
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update public.transport_requests
      set payment_merchant_order = next_order,
          payment_merchant_orders = array_append(payment_merchant_orders, next_order),
          payment_attempt_status = 'started',
          payment_attempt_started_at = now(),
          payment_reference = '',
          payment_gateway_response = '{}'::jsonb
      where id = request.id
      returning * into request;
      exit;
    exception when unique_violation then
      -- Retry the unlikely merchant-order collision.
    end;
  end loop;

  insert into public.payment_transaction_events (
    event_source, payment_kind, merchant_order, payment_record_id, amount_cents,
    processing_stage, outcome
  ) values (
    'checkout_prepared', 'transport', request.payment_merchant_order, request.id,
    request.amount_cents, 'prepare_transport_payment', 'started'
  );
  return query select request.payment_public_token, request.payment_merchant_order,
    request.payment_expires_at, false;
end;
$$;

revoke all on function public.prepare_transport_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_transport_payment(uuid, uuid) to service_role;

notify pgrst, 'reload schema';