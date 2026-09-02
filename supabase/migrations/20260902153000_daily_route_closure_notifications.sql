alter table public.daily_routes
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null;

create table if not exists public.daily_route_closure_notifications (
  id uuid primary key default gen_random_uuid(),
  daily_route_id uuid not null references public.daily_routes(id) on delete cascade,
  kind text not null default 'cierre_ruta' check (kind = 'cierre_ruta'),
  recipient text not null check (btrim(recipient) <> ''),
  recipient_name text not null default '',
  status text not null default 'pendiente' check (status in ('pendiente', 'procesando', 'enviada', 'fallida')),
  provider_message_id text,
  attempts integer not null default 0 check (attempts >= 0),
  error_message text,
  processing_started_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_route_id, kind, recipient)
);

create index if not exists daily_route_closure_notifications_due_idx
  on public.daily_route_closure_notifications (created_at)
  where status in ('pendiente', 'fallida');

alter table public.daily_route_closure_notifications enable row level security;

create trigger daily_route_closure_notifications_updated_at
before update on public.daily_route_closure_notifications
for each row execute function public.set_updated_at();

create or replace function public.prevent_closed_daily_route_itinerary_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route_id uuid;
begin
  v_route_id := case when tg_op = 'DELETE' then old.daily_route_id else new.daily_route_id end;
  if exists (select 1 from public.daily_routes where id = v_route_id and closed_at is not null) then
    raise exception 'El itinerario está cerrado y ya no se puede modificar';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists daily_route_stops_prevent_closed_itinerary_changes on public.daily_route_stops;
create trigger daily_route_stops_prevent_closed_itinerary_changes
before insert or update or delete on public.daily_route_stops
for each row execute function public.prevent_closed_daily_route_itinerary_changes();

create or replace function public.close_daily_route(p_daily_route_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route public.daily_routes;
  v_closed_at timestamptz;
  v_notifications_queued integer;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cerrar rutas'; end if;

  select * into v_route from public.daily_routes where id = p_daily_route_id for update;
  if v_route.id is null then raise exception 'No se ha encontrado la ruta'; end if;
  if v_route.closed_at is not null then
    return jsonb_build_object('closedAt', v_route.closed_at, 'notificationsQueued', 0);
  end if;
  if v_route.service_date <> ((now() at time zone 'Europe/Madrid')::date + 1) then
    raise exception 'La ruta solo se puede cerrar el día anterior a su realización';
  end if;
  if v_route.status in ('completada', 'cancelada') then
    raise exception 'No se puede cerrar una ruta completada o cancelada';
  end if;

  update public.daily_routes
  set closed_at = now(), closed_by = auth.uid()
  where id = p_daily_route_id
  returning closed_at into v_closed_at;

  insert into public.daily_route_closure_notifications (
    daily_route_id, recipient, recipient_name
  )
  select distinct on (phone)
    p_daily_route_id,
    phone,
    customer_name
  from public.route_actions action
  join public.carriage_letters letter on letter.id = action.letter_id
  cross join lateral (
    values (
      case when action.action_type = 'recogida' then letter.sender_phone else letter.recipient_phone end,
      case when action.action_type = 'recogida' then letter.sender_name else letter.recipient_name end
    )
  ) as customer(phone, customer_name)
  where nullif(btrim(phone), '') is not null
  order by phone, customer_name
  on conflict (daily_route_id, kind, recipient) do nothing;

  get diagnostics v_notifications_queued = row_count;
  insert into public.audit_logs (actor_id, event_type, entity_type, entity_id, data)
  values (
    auth.uid(),
    'daily_route_closed',
    'daily_route',
    p_daily_route_id::text,
    jsonb_build_object('notifications_queued', v_notifications_queued)
  );
  return jsonb_build_object('closedAt', v_closed_at, 'notificationsQueued', v_notifications_queued);
end;
$$;

revoke all on function public.close_daily_route(uuid) from public, anon;
grant execute on function public.close_daily_route(uuid) to authenticated;

create or replace function public.claim_daily_route_closure_notifications(p_daily_route_id uuid default null)
returns setof public.daily_route_closure_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select notification.id
    from public.daily_route_closure_notifications notification
    where (p_daily_route_id is null or notification.daily_route_id = p_daily_route_id)
      and (
        notification.status in ('pendiente', 'fallida')
        or (notification.status = 'procesando' and notification.processing_started_at < now() - interval '10 minutes')
      )
    order by notification.created_at
    for update skip locked
  )
  update public.daily_route_closure_notifications notification
  set status = 'procesando',
      attempts = notification.attempts + 1,
      processing_started_at = now(),
      error_message = null
  from candidates
  where notification.id = candidates.id
  returning notification.*;
end;
$$;

revoke all on function public.claim_daily_route_closure_notifications(uuid) from public, anon, authenticated;