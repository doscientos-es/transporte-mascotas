-- Closure is a manual availability decision, not a restriction on admin editing.
drop trigger if exists daily_route_stops_prevent_closed_itinerary_changes on public.daily_route_stops;

-- Repair routes previously closed without updating the public availability status.
update public.daily_routes set status = 'cerrada' where closed_at is not null and status = 'activa';

-- Serialize new client requests with closing the route, including requests that
-- started before the administrator clicked close. Admin operations remain allowed.
create or replace function public.check_transport_request_route_open()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status public.daily_route_status;
begin
  if new.daily_route_id is null or public.is_admin() then return new; end if;
  select status into v_status from public.daily_routes where id = new.daily_route_id for share;
  if v_status is distinct from 'activa'::public.daily_route_status then
    raise exception 'La salida seleccionada ya no está disponible';
  end if;
  return new;
end;
$$;

drop trigger if exists transport_requests_check_route_open on public.transport_requests;
create trigger transport_requests_check_route_open before insert on public.transport_requests
for each row execute function public.check_transport_request_route_open();

create or replace function public.close_daily_route(p_daily_route_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_route public.daily_routes;
  v_notifications_queued integer := 0;
  v_missing jsonb;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cerrar rutas'; end if;
  select * into v_route from public.daily_routes where id = p_daily_route_id for update;
  if not found then raise exception 'No se ha encontrado la ruta'; end if;

  if v_route.closed_at is null then
    update public.daily_routes set status = 'cerrada', closed_at = now(), closed_by = auth.uid()
    where id = p_daily_route_id returning * into v_route;
    insert into public.daily_route_closure_notifications (daily_route_id, recipient, recipient_name)
    select distinct on (lower(btrim(customer.email)))
      p_daily_route_id, lower(btrim(customer.email)), coalesce(customer.name, '')
    from public.route_actions action
    join public.carriage_letters letter on letter.id = action.letter_id
    cross join lateral (values
      (case when action.action_type = 'recogida' then letter.sender_email else letter.recipient_email end,
       case when action.action_type = 'recogida' then letter.sender_name else letter.recipient_name end)
    ) customer(email, name)
    where action.daily_route_id = p_daily_route_id
      and btrim(customer.email) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    order by lower(btrim(customer.email)), coalesce(customer.name, '')
    on conflict (daily_route_id, kind, recipient) do nothing;
    get diagnostics v_notifications_queued = row_count;
    insert into public.audit_logs (actor_id, event_type, entity_type, entity_id, data)
    values (auth.uid(), 'daily_route_closed', 'daily_route', p_daily_route_id::text,
      jsonb_build_object('notifications_queued', v_notifications_queued));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', contacts.name, 'phone', contacts.phone)
    order by contacts.name, contacts.phone), '[]'::jsonb) into v_missing
  from (
    select distinct coalesce(customer.name, '') as name, coalesce(customer.phone, '') as phone
    from public.route_actions action
    join public.carriage_letters letter on letter.id = action.letter_id
    cross join lateral (values
      (case when action.action_type = 'recogida' then letter.sender_email else letter.recipient_email end,
       case when action.action_type = 'recogida' then letter.sender_name else letter.recipient_name end,
       case when action.action_type = 'recogida' then letter.sender_phone else letter.recipient_phone end)
    ) customer(email, name, phone)
    where action.daily_route_id = p_daily_route_id
      and coalesce(btrim(customer.email), '') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ) contacts;
  return jsonb_build_object('closedAt', v_route.closed_at, 'notificationsQueued', v_notifications_queued,
    'missingEmails', v_missing);
end;
$$;

revoke all on function public.close_daily_route(uuid) from public, anon;
grant execute on function public.close_daily_route(uuid) to authenticated;
notify pgrst, 'reload schema';