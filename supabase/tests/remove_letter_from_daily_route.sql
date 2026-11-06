-- Run on a disposable database after migrations; every fixture is rolled back.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000d1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'route-removal@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.profiles (id, display_name, role, active)
values ('00000000-0000-4000-8000-0000000000d1', 'Route removal test', 'admin', true)
on conflict (id) do update set role = 'admin', active = true;
insert into public.route_templates (id, name) values ('10000000-0000-4000-8000-0000000000d1', 'Route removal test');
insert into public.daily_routes (id, route_template_id, service_date)
values ('20000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-0000000000d1', current_date + 2);
insert into public.daily_route_stops (id, daily_route_id, sequence, locality) values
  ('30000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000d1', 1, 'Origen'),
  ('30000000-0000-4000-8000-0000000000d2', '20000000-0000-4000-8000-0000000000d1', 2, 'Destino');

do $$
declare
  contact jsonb := '{"name":"Test","nif":"TEST","email":"test@example.invalid","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}';
  payer jsonb := '{"fullName":"Test","nif":"TEST","email":"test@example.invalid","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}';
  animals jsonb := '[{"id":"40000000-0000-4000-8000-0000000000d1","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1,"box_category":"pequeno"},{"id":"40000000-0000-4000-8000-0000000000d2","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1,"box_category":"pequeno"}]';
  actions jsonb := '[{"id":"50000000-0000-4000-8000-0000000000d1","animal_id":"40000000-0000-4000-8000-0000000000d1","stop_id":"30000000-0000-4000-8000-0000000000d1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000d2","animal_id":"40000000-0000-4000-8000-0000000000d1","stop_id":"30000000-0000-4000-8000-0000000000d2","type":"entrega"},{"id":"50000000-0000-4000-8000-0000000000d3","animal_id":"40000000-0000-4000-8000-0000000000d2","stop_id":"30000000-0000-4000-8000-0000000000d1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000d4","animal_id":"40000000-0000-4000-8000-0000000000d2","stop_id":"30000000-0000-4000-8000-0000000000d2","type":"entrega"}]';
  result jsonb;
  v_letter_id text;
  other_letter_id text;
  invoice_id uuid;
begin
  result := public.create_paid_manual_carriage_letter('20000000-0000-4000-8000-0000000000d1', 'REMOVE-TEST', contact, contact,
    'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente', payer, 121, true, animals, actions, 13,
    'Transferencia', '{"name":"Test issuer","taxId":"TEST","address":"Test"}', null);
  v_letter_id := result ->> 'letterId';
  invoice_id := (result ->> 'invoiceDraftId')::uuid;
  if (select count(*) from public.route_actions where route_actions.letter_id = v_letter_id) <> 4 then raise exception 'Fixture must have four actions'; end if;
  if not exists (select 1 from public.issued_invoices where invoice_draft_id = invoice_id) then raise exception 'Fixture must have an issued invoice'; end if;
  other_letter_id := public.create_manual_carriage_letter('20000000-0000-4000-8000-0000000000d1', 'OTHER-TEST', contact, contact,
    'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente', payer, 121, true,
    '[{"id":"40000000-0000-4000-8000-0000000000d3","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1,"box_category":"pequeno"}]',
    '[{"id":"50000000-0000-4000-8000-0000000000d5","animal_id":"40000000-0000-4000-8000-0000000000d3","stop_id":"30000000-0000-4000-8000-0000000000d1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000d6","animal_id":"40000000-0000-4000-8000-0000000000d3","stop_id":"30000000-0000-4000-8000-0000000000d2","type":"entrega"}]', 14, null);
  perform public.assign_shared_van_box('20000000-0000-4000-8000-0000000000d1', other_letter_id,
    '40000000-0000-4000-8000-0000000000d3', 13, 1, 2);

  update public.profiles set role = 'user' where id = auth.uid();
  begin
    perform public.remove_letter_from_daily_route('20000000-0000-4000-8000-0000000000d1', v_letter_id);
    raise exception 'Non-admin removed a letter';
  exception when others then
    if sqlerrm <> 'Solo administración puede quitar cartas de una ruta' then raise; end if;
  end;
  update public.profiles set role = 'admin' where id = auth.uid();
  perform public.remove_letter_from_daily_route('20000000-0000-4000-8000-0000000000d1', v_letter_id);
  if exists (select 1 from public.route_actions where route_actions.letter_id = v_letter_id)
    or exists (select 1 from public.van_assignments where van_assignments.letter_id = v_letter_id)
    or not exists (select 1 from public.carriage_letters where id = v_letter_id and default_route_template_id is null and status = 'pendiente')
    or (select count(*) from public.animals where animals.letter_id = v_letter_id) <> 2
    or not exists (select 1 from public.invoice_drafts where id = invoice_id)
    or not exists (select 1 from public.issued_invoices where invoice_draft_id = invoice_id)
    or (select count(*) from public.route_actions where letter_id = other_letter_id) <> 2
    or not exists (select 1 from public.van_assignments where letter_id = other_letter_id and box_number = 13)
    or exists (select 1 from public.carriage_letter_notifications where carriage_letter_notifications.letter_id = v_letter_id and status in ('pendiente', 'procesando', 'fallida'))
  then raise exception 'Removal must preserve letter, animals and invoice without a route, box or queued notices'; end if;
  perform public.sync_carriage_letter_status(v_letter_id);
  if not exists (select 1 from public.carriage_letters where id = v_letter_id and status = 'pendiente') then raise exception 'Unassigned paid letter was rescheduled'; end if;
end;
$$;
rollback;