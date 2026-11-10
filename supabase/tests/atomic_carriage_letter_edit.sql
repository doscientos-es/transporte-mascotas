-- Run on a disposable database after migrations; all fixtures are rolled back.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000f1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', 'atomic-edit@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.profiles (id, display_name, role, active)
values ('00000000-0000-4000-8000-0000000000f1', 'Atomic edit test', 'admin', true)
on conflict (id) do update set role = 'admin', active = true;
insert into public.route_templates (id, name) values ('10000000-0000-4000-8000-0000000000f1', 'Atomic edit test');
insert into public.daily_routes (id, route_template_id, service_date)
values ('20000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-0000000000f1', current_date + 2);
insert into public.daily_route_stops (id, daily_route_id, sequence, locality) values
  ('30000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-0000000000f1', 1, 'Origen'),
  ('30000000-0000-4000-8000-0000000000f2', '20000000-0000-4000-8000-0000000000f1', 2, 'Destino');

do $$
declare
  route_id uuid := '20000000-0000-4000-8000-0000000000f1';
  contact jsonb := '{"name":"Test","nif":"TEST","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}';
  payer jsonb := '{"fullName":"Test","nif":"TEST","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}';
  animal jsonb := '[{"id":"40000000-0000-4000-8000-0000000000f1","ordinal":1,"species":"perro","breed":"mestizo","birth_date":"2020-01-01","size":"pequeno","weight_kg":1,"length_cm":0,"height_cm":0,"width_cm":0,"box_category":"pequeno"}]';
  actions jsonb := '[{"id":"50000000-0000-4000-8000-0000000000f1","animal_id":"40000000-0000-4000-8000-0000000000f1","stop_id":"30000000-0000-4000-8000-0000000000f1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000f2","animal_id":"40000000-0000-4000-8000-0000000000f1","stop_id":"30000000-0000-4000-8000-0000000000f2","type":"entrega"}]';
  v_letter_id text;
  other_id text;
  letter jsonb;
begin
  v_letter_id := public.create_manual_carriage_letter(route_id, 'ATOMIC-EDIT-TEST', contact, contact,
    'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente', payer, 121, true,
    '[{"id":"40000000-0000-4000-8000-0000000000f1","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1,"box_category":"pequeno"}]', actions, 13, null);
  other_id := public.create_manual_carriage_letter(route_id, 'ATOMIC-OTHER-TEST', contact, contact,
    'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente', payer, 121, true,
    '[{"id":"40000000-0000-4000-8000-0000000000f2","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1,"box_category":"pequeno"}]',
    '[{"id":"50000000-0000-4000-8000-0000000000f3","animal_id":"40000000-0000-4000-8000-0000000000f2","stop_id":"30000000-0000-4000-8000-0000000000f1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000f4","animal_id":"40000000-0000-4000-8000-0000000000f2","stop_id":"30000000-0000-4000-8000-0000000000f2","type":"entrega"}]', 14, null);
  update public.route_actions set status = 'incidencia', incident_note = 'Conservar incidencia'
    where route_actions.letter_id = v_letter_id and action_type = 'recogida';
  select to_jsonb(row) into letter from public.carriage_letters row where row.id = v_letter_id;

  perform public.update_carriage_letter_atomically(v_letter_id, route_id, letter, animal, actions, 13, false, false);
  if exists (select 1 from public.animals where animals.letter_id = v_letter_id and (height_cm is not null or length_cm is not null or width_cm is not null))
    or not exists (select 1 from public.van_assignments where van_assignments.letter_id = v_letter_id and box_number = 13)
    or not exists (select 1 from public.route_actions where route_actions.letter_id = v_letter_id and status = 'incidencia' and incident_note = 'Conservar incidencia')
    then raise exception 'Edit must normalize measurements and preserve the box and operational state'; end if;

  perform public.update_carriage_letter_atomically(v_letter_id, route_id, letter,
    jsonb_set(jsonb_set(jsonb_set(animal, '{0,weight_kg}', '40'), '{0,size}', '"grande"'),
      '{0,box_category}', '"grande"'), actions, 17, false, false);
  if not exists (select 1 from public.animals where animals.letter_id = v_letter_id and weight_kg = 40)
    or not exists (select 1 from public.van_assignments where van_assignments.letter_id = v_letter_id and box_number = 17)
    or (select count(*) from public.route_actions where route_actions.letter_id = v_letter_id) <> 2
    then raise exception 'Manual box and changed weight must persist together even when sizes differ'; end if;
  perform public.update_carriage_letter_atomically(v_letter_id, route_id, letter, animal, actions, 13, false, false);

  begin
    perform public.update_carriage_letter_atomically(v_letter_id, route_id, jsonb_set(letter, '{sender_name}', '"Alterado"'), animal, actions, 14, false, false);
    raise exception 'Occupied box should be rejected';
  exception when others then
    if sqlerrm <> 'El box está ocupado en este tramo' then raise; end if;
  end;
  if (select sender_name from public.carriage_letters where id = v_letter_id) <> 'Test'
    or (select count(*) from public.route_actions where route_actions.letter_id = v_letter_id) <> 2
    or not exists (select 1 from public.van_assignments where van_assignments.letter_id = v_letter_id and box_number = 13)
    then raise exception 'A failed box assignment must roll back the complete edit'; end if;

  begin
    perform public.update_carriage_letter_atomically(v_letter_id, route_id, letter,
      jsonb_set(animal, '{0,height_cm}', '-1'), actions, 13, false, false);
    raise exception 'Negative height should be rejected';
  exception when check_violation then null;
  end;
  if (select count(*) from public.route_actions where route_actions.letter_id = v_letter_id) <> 2
    or not exists (select 1 from public.van_assignments where van_assignments.letter_id = v_letter_id and box_number = 13)
    then raise exception 'An animal validation error must retain the actions and box'; end if;

  begin
    perform public.update_carriage_letter_atomically(v_letter_id, route_id, letter, animal, actions, null, false, false);
    raise exception 'Missing box should be rejected';
  exception when others then
    if sqlerrm <> 'La carta debe tener animales y un box asignado' then raise; end if;
  end;

  perform public.update_carriage_letter_atomically(v_letter_id, route_id, letter, animal, actions, 14, false, true);
  if (select count(*) from public.van_assignments where daily_route_id = route_id and box_number = 14) <> 2
    then raise exception 'The selected box may be shared explicitly with another letter'; end if;
  perform public.update_carriage_letter_atomically(v_letter_id, route_id, letter, animal, actions, 13, false, false);
  perform public.assign_shared_van_box(route_id, other_id, '40000000-0000-4000-8000-0000000000f2', 13, 1, 2);
  perform public.update_carriage_letter_atomically(v_letter_id, route_id, letter, animal, actions, 13, false, true);
  if (select count(*) from public.van_assignments where daily_route_id = route_id and box_number = 13) <> 2
    then raise exception 'Existing shared assignments must be preserved'; end if;

  update public.profiles set role = 'user' where id = auth.uid();
  begin
    perform public.update_carriage_letter_atomically(v_letter_id, route_id, letter, animal, actions, 13, false, true);
    raise exception 'A non-admin must not edit a letter';
  exception when others then
    if sqlerrm <> 'Solo administración puede editar cartas de porte' then raise; end if;
  end;
end;
$$;
rollback;