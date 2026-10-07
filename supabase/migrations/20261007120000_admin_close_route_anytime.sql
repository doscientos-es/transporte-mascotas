-- Let administrators close an itinerary independently of the route service date.
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
  select distinct on (lower(btrim(customer.email)))
    p_daily_route_id,
    lower(btrim(customer.email)),
    customer.customer_name
  from public.route_actions action
  join public.carriage_letters letter on letter.id = action.letter_id
  cross join lateral (
    values (
      case when action.action_type = 'recogida' then letter.sender_email else letter.recipient_email end,
      case when action.action_type = 'recogida' then letter.sender_name else letter.recipient_name end
    )
  ) as customer(email, customer_name)
  where action.daily_route_id = p_daily_route_id
    and btrim(customer.email) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  order by lower(btrim(customer.email)), customer.customer_name
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

notify pgrst, 'reload schema';