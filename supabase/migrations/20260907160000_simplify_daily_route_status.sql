-- Routes are available to clients while active. Closing the itinerary removes it
-- from the client portal and prevents further changes to its stops.
alter table public.daily_routes
  alter column status drop default;

create type public.daily_route_status_next as enum ('activa', 'cerrada');

alter table public.daily_routes
  alter column status type public.daily_route_status_next
  using (
    case
      when service_date < current_date
        or closed_at is not null
        or status::text in ('completada', 'cancelada') then 'cerrada'
      else 'activa'
    end
  )::public.daily_route_status_next;

drop type public.daily_route_status;
alter type public.daily_route_status_next rename to daily_route_status;

alter table public.daily_routes
  alter column status set default 'activa';

update public.daily_routes
set closed_at = coalesce(closed_at, now())
where status = 'cerrada'
  and closed_at is null;

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
  if v_route.status = 'cerrada' then
    return jsonb_build_object('closedAt', v_route.closed_at, 'notificationsQueued', 0);
  end if;
  if v_route.service_date <> ((now() at time zone 'Europe/Madrid')::date + 1) then
    raise exception 'La ruta solo se puede cerrar el día anterior a su realización';
  end if;

  update public.daily_routes
  set status = 'cerrada', closed_at = now(), closed_by = auth.uid()
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