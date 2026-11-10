-- Persist event order on the stop without changing route geometry, times or action statuses.
alter table public.daily_route_stops
  add column action_order uuid[] not null default '{}';

create or replace function public.reorder_daily_route_stop_actions(
  p_daily_route_id uuid, p_stop_id uuid, p_action_ids uuid[]
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_action_ids uuid[];
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Solo administración puede reordenar los servicios' using errcode = '42501';
  end if;
  perform 1 from public.daily_route_stops
    where id = p_stop_id and daily_route_id = p_daily_route_id for update;
  if not found then
    raise exception 'La parada no pertenece a esta ruta';
  end if;

  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_action_ids
    from public.route_actions
    where daily_route_id = p_daily_route_id and daily_route_stop_id = p_stop_id;
  -- Exact membership also rejects duplicates, nulls and stale/partial lists.
  if p_action_ids is null or
    (select coalesce(array_agg(id order by id), '{}'::uuid[]) from unnest(p_action_ids) id)
      is distinct from v_action_ids then
    raise exception 'Los servicios han cambiado. Recarga la ruta antes de reordenarlos';
  end if;

  update public.daily_route_stops set action_order = p_action_ids
    where id = p_stop_id and daily_route_id = p_daily_route_id;
end;
$$;

revoke all on function public.reorder_daily_route_stop_actions(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.reorder_daily_route_stop_actions(uuid, uuid, uuid[]) to authenticated;