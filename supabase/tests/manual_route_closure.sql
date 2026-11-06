-- Run on a disposable database after migrations; all fixtures are rolled back.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'closure@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.profiles (id, display_name, role, active)
values ('00000000-0000-4000-8000-0000000000e1', 'Test', 'admin', true)
on conflict (id) do update set role = 'admin', active = true;
insert into public.route_templates (id, name) values ('10000000-0000-4000-8000-0000000000e1', 'Closure test');
insert into public.daily_routes (id, route_template_id, service_date)
values ('20000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', current_date + 10);
insert into public.daily_route_stops (id, daily_route_id, sequence, locality) values
  ('30000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e1', 1, 'Origen'),
  ('30000000-0000-4000-8000-0000000000e2', '20000000-0000-4000-8000-0000000000e1', 2, 'Destino');
do $$
declare
  sender jsonb := '{"name":"Remitente","nif":"TEST","email":"sender@example.invalid","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}';
  recipient jsonb := '{"name":"Destinatario","nif":"TEST","email":"","phone":"611111111","address":"Test","postalCode":"00000","city":"Test"}';
  payer jsonb := '{"fullName":"Test","nif":"TEST","email":"sender@example.invalid","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}';
  animals jsonb := '[{"id":"40000000-0000-4000-8000-0000000000e1","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1,"box_category":"pequeno"}]';
  actions jsonb := '[{"id":"50000000-0000-4000-8000-0000000000e1","animal_id":"40000000-0000-4000-8000-0000000000e1","stop_id":"30000000-0000-4000-8000-0000000000e1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000e2","animal_id":"40000000-0000-4000-8000-0000000000e1","stop_id":"30000000-0000-4000-8000-0000000000e2","type":"entrega"}]';
  result jsonb;
begin
  perform public.create_manual_carriage_letter('20000000-0000-4000-8000-0000000000e1', 'CLOSURE-TEST', sender, recipient,
    'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente', payer, 121, true, animals, actions, 13, null);
  result := public.close_daily_route('20000000-0000-4000-8000-0000000000e1');
  if (result ->> 'notificationsQueued')::integer <> 1 or jsonb_array_length(result -> 'missingEmails') <> 1
    or result -> 'missingEmails' -> 0 ->> 'phone' <> '611111111' then raise exception 'Incorrect closure contacts'; end if;
  if exists (select 1 from public.list_public_transport_routes() where id = '20000000-0000-4000-8000-0000000000e1')
    or not exists (select 1 from public.daily_routes where id = '20000000-0000-4000-8000-0000000000e1' and status = 'cerrada' and closed_at is not null)
    then raise exception 'Route remains publicly available'; end if;
  result := public.close_daily_route('20000000-0000-4000-8000-0000000000e1');
  if (result ->> 'notificationsQueued')::integer <> 0 then raise exception 'Closure must be idempotent'; end if;
  update public.daily_route_stops set locality = 'Origen editado' where id = '30000000-0000-4000-8000-0000000000e1';
  update public.profiles set role = 'user' where id = auth.uid();
  begin
    perform public.close_daily_route('20000000-0000-4000-8000-0000000000e1');
    raise exception 'Client must not close route';
  exception when others then
    if sqlerrm <> 'Solo administración puede cerrar rutas' then raise; end if;
  end;
  begin
    insert into public.transport_requests (requester_id, origin_text, destination_text, desired_date, daily_route_id)
    values (auth.uid(), 'Origen', 'Destino', current_date + 10, '20000000-0000-4000-8000-0000000000e1');
    raise exception 'Client request should fail';
  exception when others then
    if sqlerrm <> 'La salida seleccionada ya no está disponible' then raise; end if;
  end;
  update public.profiles set role = 'admin' where id = auth.uid();
  perform public.create_manual_carriage_letter('20000000-0000-4000-8000-0000000000e1', 'CLOSURE-TEST-2', sender, recipient,
    'Origen editado', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente', payer, 121, true,
    replace(animals::text, '0000000000e1', '0000000000e3')::jsonb,
    replace(replace(replace(actions::text, '40000000-0000-4000-8000-0000000000e1', '40000000-0000-4000-8000-0000000000e3'),
      '50000000-0000-4000-8000-0000000000e1', '50000000-0000-4000-8000-0000000000e3'),
      '50000000-0000-4000-8000-0000000000e2', '50000000-0000-4000-8000-0000000000e4')::jsonb, 14, null);
end;
$$;
rollback;