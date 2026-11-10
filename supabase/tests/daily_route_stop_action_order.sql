-- Run on a disposable database after migrations. All fixtures are rolled back.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'event-order@example.invalid', '{}', '{}', now(), now());
insert into public.profiles (id, display_name, role, active)
values ('00000000-0000-4000-8000-0000000000e1', 'Event order test', 'admin', true)
on conflict (id) do update set role = 'admin', active = true;
insert into public.route_templates (id, name)
values ('10000000-0000-4000-8000-0000000000e1', 'Event order test');
insert into public.daily_routes (id, route_template_id, service_date)
values ('20000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', current_date + 2);
insert into public.daily_route_stops (id, daily_route_id, sequence, locality) values
  ('30000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e1', 1, 'Origen'),
  ('30000000-0000-4000-8000-0000000000e2', '20000000-0000-4000-8000-0000000000e1', 2, 'Destino');

select public.create_manual_carriage_letter(
  '20000000-0000-4000-8000-0000000000e1', 'EVENT-ORDER-TEST',
  '{"name":"Test","nif":"TEST","email":"test@example.invalid","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}',
  '{"name":"Test","nif":"TEST","email":"test@example.invalid","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}',
  'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente',
  '{"fullName":"Test","nif":"TEST","email":"test@example.invalid","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}',
  121, true,
  '[{"id":"40000000-0000-4000-8000-0000000000e1","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1,"box_category":"pequeno"},{"id":"40000000-0000-4000-8000-0000000000e2","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1,"box_category":"pequeno"}]',
  '[{"id":"50000000-0000-4000-8000-0000000000e1","animal_id":"40000000-0000-4000-8000-0000000000e1","stop_id":"30000000-0000-4000-8000-0000000000e1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000e2","animal_id":"40000000-0000-4000-8000-0000000000e1","stop_id":"30000000-0000-4000-8000-0000000000e2","type":"entrega"},{"id":"50000000-0000-4000-8000-0000000000e3","animal_id":"40000000-0000-4000-8000-0000000000e2","stop_id":"30000000-0000-4000-8000-0000000000e1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000e4","animal_id":"40000000-0000-4000-8000-0000000000e2","stop_id":"30000000-0000-4000-8000-0000000000e2","type":"entrega"}]',
  13, null
);

set local role authenticated;
do $$
declare
  route_id uuid := '20000000-0000-4000-8000-0000000000e1';
  stop_id uuid := '30000000-0000-4000-8000-0000000000e1';
  a uuid := '50000000-0000-4000-8000-0000000000e1';
  b uuid := '50000000-0000-4000-8000-0000000000e3';
  foreign_action uuid := '50000000-0000-4000-8000-0000000000e2';
  invalid uuid[];
  actions_before jsonb;
  stops_before jsonb;
begin
  select jsonb_agg(to_jsonb(action) order by id) into actions_before from public.route_actions action where daily_route_id = route_id;
  select jsonb_agg(to_jsonb(stop) - 'action_order' order by id) into stops_before from public.daily_route_stops stop where daily_route_id = route_id;
  perform public.reorder_daily_route_stop_actions(route_id, stop_id, array[b, a]);
  if (select action_order from public.daily_route_stops where id = stop_id) <> array[b, a]
    or (select action_order from public.daily_route_stops where id = '30000000-0000-4000-8000-0000000000e2') <> '{}'::uuid[]
    or (select jsonb_agg(to_jsonb(action) order by id) from public.route_actions action where daily_route_id = route_id) is distinct from actions_before
    or (select jsonb_agg(to_jsonb(stop) - 'action_order' order by id) from public.daily_route_stops stop where daily_route_id = route_id) is distinct from stops_before
  then raise exception 'Reordering did not persist or changed another stop, route times or actions'; end if;

  foreach invalid slice 1 in array array[array[a,a], array[a,foreign_action], array[a,null::uuid]] loop
    begin
      perform public.reorder_daily_route_stop_actions(route_id, stop_id, invalid);
      raise exception 'Invalid action list was accepted';
    exception when raise_exception then
      if sqlerrm <> 'Los servicios han cambiado. Recarga la ruta antes de reordenarlos' then raise; end if;
    end;
  end loop;
  begin
    perform public.reorder_daily_route_stop_actions(route_id, stop_id, array[a]);
    raise exception 'Partial list was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Los servicios han cambiado. Recarga la ruta antes de reordenarlos' then raise; end if;
  end;
  begin
    perform public.reorder_daily_route_stop_actions('20000000-0000-4000-8000-0000000000e2', stop_id, array[a,b]);
    raise exception 'Wrong route was accepted';
  exception when raise_exception then
    if sqlerrm <> 'La parada no pertenece a esta ruta' then raise; end if;
  end;
end;
$$;

reset role;
update public.profiles set role = 'user' where id = auth.uid();
set local role authenticated;
do $$
begin
  begin
    perform public.reorder_daily_route_stop_actions(
      '20000000-0000-4000-8000-0000000000e1', '30000000-0000-4000-8000-0000000000e1', '{}');
    raise exception 'Non-admin reordered services';
  exception when insufficient_privilege then null;
  end;
  update public.daily_route_stops set action_order = '{}'
    where id = '30000000-0000-4000-8000-0000000000e1';
  if found then raise exception 'Non-admin bypassed the RPC via direct update'; end if;
end;
$$;
reset role;
rollback;