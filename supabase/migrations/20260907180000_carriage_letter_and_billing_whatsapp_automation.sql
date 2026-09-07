-- WhatsApp is an asynchronous delivery channel. Business operations only enqueue
-- notifications; workers deliver them later, so a provider outage never rolls
-- back a carriage letter, payment request, or issued invoice.

create or replace function public.is_whatsapp_phone(p_phone text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') ~ '^[1-9][0-9]{7,14}$';
$$;

alter table public.carriage_letters
  add constraint carriage_letters_sender_whatsapp_phone_check
    check (public.is_whatsapp_phone(sender_phone)) not valid,
  add constraint carriage_letters_recipient_whatsapp_phone_check
    check (public.is_whatsapp_phone(recipient_phone)) not valid;

create table public.carriage_letter_notifications (
  id uuid primary key default gen_random_uuid(),
  letter_id text not null references public.carriage_letters(id) on delete cascade,
  kind text not null check (kind in ('confirmacion', 'recordatorio_ruta')),
  recipient_role text not null check (recipient_role in ('remitente', 'destinatario')),
  recipient text not null check (public.is_whatsapp_phone(recipient)),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'procesando', 'enviada', 'fallida', 'fallida_final', 'cancelada')),
  scheduled_for timestamptz not null default now(),
  provider_message_id text,
  error_message text,
  attempts integer not null default 0 check (attempts >= 0),
  processing_started_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (letter_id, kind, recipient_role)
);

create index carriage_letter_notifications_due_idx
  on public.carriage_letter_notifications (scheduled_for, created_at)
  where status in ('pendiente', 'fallida');

alter table public.carriage_letter_notifications enable row level security;
revoke all on public.carriage_letter_notifications from public, anon, authenticated;

create trigger carriage_letter_notifications_updated_at
before update on public.carriage_letter_notifications
for each row execute function public.set_updated_at();

-- A manual letter is created with an assigned daily route and is therefore
-- operationally scheduled as soon as its transaction commits.
create or replace function public.schedule_manual_carriage_letter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entry_source = 'manual' and new.status = 'pendiente' then new.status := 'programada'; end if;
  return new;
end;
$$;

create trigger carriage_letters_schedule_manual_before_insert
before insert on public.carriage_letters
for each row execute function public.schedule_manual_carriage_letter();

create or replace function public.queue_carriage_letter_whatsapp_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reminder_at timestamptz;
begin
  if tg_op = 'UPDATE' and new.status = 'cancelada' and old.status <> 'cancelada' then
    update public.carriage_letter_notifications
    set status = 'cancelada', processing_started_at = null
    where letter_id = new.id and status in ('pendiente', 'procesando', 'fallida');
    return new;
  end if;

  if new.entry_source <> 'manual' or new.status <> 'programada' then return new; end if;
  v_reminder_at := greatest(
    ((new.service_date - 1)::timestamp + time '10:00') at time zone 'Europe/Madrid', now()
  );

  if tg_op = 'INSERT' or old.status <> 'programada' then
    insert into public.carriage_letter_notifications (letter_id, kind, recipient_role, recipient)
    values (new.id, 'confirmacion', 'remitente', new.sender_phone)
    on conflict do nothing;

    if new.service_date > (now() at time zone 'Europe/Madrid')::date then
      insert into public.carriage_letter_notifications (
        letter_id, kind, recipient_role, recipient, scheduled_for
      ) values (new.id, 'recordatorio_ruta', 'remitente', new.sender_phone, v_reminder_at)
      on conflict do nothing;
    end if;

    -- One person receives one WhatsApp even when they are both parties.
    if regexp_replace(new.sender_phone, '[^0-9]', '', 'g')
       <> regexp_replace(new.recipient_phone, '[^0-9]', '', 'g') then
      insert into public.carriage_letter_notifications (letter_id, kind, recipient_role, recipient)
      values (new.id, 'confirmacion', 'destinatario', new.recipient_phone)
      on conflict do nothing;
      if new.service_date > (now() at time zone 'Europe/Madrid')::date then
        insert into public.carriage_letter_notifications (
          letter_id, kind, recipient_role, recipient, scheduled_for
        ) values (new.id, 'recordatorio_ruta', 'destinatario', new.recipient_phone, v_reminder_at)
        on conflict do nothing;
      end if;
    end if;
  elsif new.service_date is distinct from old.service_date then
    update public.carriage_letter_notifications
    set scheduled_for = v_reminder_at
    where letter_id = new.id and kind = 'recordatorio_ruta' and status in ('pendiente', 'fallida');
  end if;
  return new;
end;
$$;

create trigger carriage_letters_queue_whatsapp_after_change
after insert or update of status, service_date on public.carriage_letters
for each row execute function public.queue_carriage_letter_whatsapp_notifications();

-- The older request queue must not duplicate the notification created from the
-- definitive carriage letter after a request is confirmed.
create or replace function public.suppress_legacy_transport_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind in ('confirmacion', 'recordatorio_ruta') and exists (
    select 1
    from public.transport_requests request
    join public.carriage_letter_notifications notification on notification.letter_id = request.letter_id
    where request.id = new.request_id
  ) then return null; end if;
  return new;
end;
$$;

create trigger transport_request_notifications_suppress_legacy_before_insert
before insert on public.transport_request_notifications
for each row execute function public.suppress_legacy_transport_notification();

create or replace function public.claim_carriage_letter_notifications(p_letter_id text default null)
returns setof public.carriage_letter_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select notification.id
    from public.carriage_letter_notifications notification
    where notification.scheduled_for <= now()
      and (p_letter_id is null or notification.letter_id = p_letter_id)
      and notification.attempts < 5
      and (notification.status in ('pendiente', 'fallida') or (
        notification.status = 'procesando'
        and notification.processing_started_at < now() - interval '10 minutes'
      ))
    order by notification.scheduled_for, notification.created_at
    for update skip locked
  )
  update public.carriage_letter_notifications notification
  set status = 'procesando', attempts = notification.attempts + 1,
      processing_started_at = now(), error_message = null
  from candidates where notification.id = candidates.id
  returning notification.*;
end;
$$;

revoke all on function public.claim_carriage_letter_notifications(text) from public, anon, authenticated;

alter table public.billing_notifications
  add column if not exists scheduled_for timestamptz not null default now();

alter table public.billing_notifications
  drop constraint if exists billing_notifications_status_check;
alter table public.billing_notifications
  add constraint billing_notifications_status_check
  check (status in ('pendiente', 'procesando', 'enviada', 'fallida', 'fallida_final', 'cancelada'));

create index if not exists billing_notifications_due_idx
  on public.billing_notifications (scheduled_for, created_at)
  where status in ('pendiente', 'fallida');

drop function if exists public.claim_billing_notifications(uuid, text);
create function public.claim_billing_notifications(
  p_invoice_draft_id uuid default null, p_kind text default null
)
returns setof public.billing_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select notification.id
    from public.billing_notifications notification
    where notification.channel = 'whatsapp' and notification.scheduled_for <= now()
      and (p_invoice_draft_id is null or notification.invoice_draft_id = p_invoice_draft_id)
      and (p_kind is null or notification.kind = p_kind)
      and notification.attempts < 5
      and (notification.status in ('pendiente', 'fallida') or (
        notification.status = 'procesando'
        and notification.processing_started_at < now() - interval '10 minutes'
      ))
    order by notification.scheduled_for, notification.created_at
    for update skip locked
  )
  update public.billing_notifications notification
  set status = 'procesando', attempts = notification.attempts + 1,
      processing_started_at = now(), error_message = null
  from candidates where notification.id = candidates.id
  returning notification.*;
end;
$$;

revoke all on function public.claim_billing_notifications(uuid, text) from public, anon, authenticated;
notify pgrst, 'reload schema';