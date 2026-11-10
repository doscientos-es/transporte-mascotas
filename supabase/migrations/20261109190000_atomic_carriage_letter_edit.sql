-- A failed edit must never leave a letter without its route actions or box.
create function public.update_carriage_letter_atomically(
  p_letter_id text, p_daily_route_id uuid, p_letter jsonb, p_animals jsonb,
  p_actions jsonb, p_box_number integer, p_signature_confirmed boolean, p_share_box boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_route public.daily_routes%rowtype;
  v_old_actions jsonb;
  v_first_animal uuid;
  v_pickup_sequence integer;
  v_delivery_sequence integer;
begin
  if not public.is_admin() then raise exception 'Solo administración puede editar cartas de porte'; end if;
  perform 1 from public.carriage_letters where id = p_letter_id for update;
  if not found then raise exception 'La carta de porte no existe'; end if;
  select * into v_route from public.daily_routes where id = p_daily_route_id for update;
  if not found or v_route.route_template_id is null then raise exception 'La ruta diaria no existe o no tiene plantilla'; end if;
  if jsonb_typeof(p_letter) is distinct from 'object'
    or jsonb_typeof(p_animals) is distinct from 'array'
    or jsonb_typeof(p_actions) is distinct from 'array' then
    raise exception 'Los datos de la carta no son válidos';
  end if;
  if jsonb_array_length(p_animals) = 0 or p_box_number is null then
    raise exception 'La carta debe tener animales y un box asignado';
  end if;
  if p_box_number not between 1 and 72 then
    raise exception 'El número de box debe estar entre 1 y 72';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) item
    left join public.animals existing on existing.id = (item.value ->> 'id')::uuid
    where item.value ->> 'id' is null or (existing.id is not null and existing.letter_id <> p_letter_id)
  ) or (select count(distinct item.value ->> 'id') from jsonb_array_elements(p_animals) item) <> jsonb_array_length(p_animals) then
    raise exception 'Los animales de la carta no son válidos';
  end if;
  if jsonb_array_length(p_actions) <> 2 * jsonb_array_length(p_animals) or exists (
    select 1 from jsonb_array_elements(p_actions) action
    left join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid
      and stop.daily_route_id = p_daily_route_id
    where stop.id is null or action.value ->> 'id' is null
      or coalesce(action.value ->> 'type', '') not in ('recogida', 'entrega')
      or not exists (select 1 from jsonb_array_elements(p_animals) animal
        where animal.value ->> 'id' = action.value ->> 'animal_id')
  ) or exists (
    select 1 from jsonb_array_elements(p_animals) animal
    where (select count(*) from jsonb_array_elements(p_actions) action
      where action.value ->> 'animal_id' = animal.value ->> 'id' and action.value ->> 'type' = 'recogida') <> 1
      or (select count(*) from jsonb_array_elements(p_actions) action
        where action.value ->> 'animal_id' = animal.value ->> 'id' and action.value ->> 'type' = 'entrega') <> 1
  ) then raise exception 'La carta debe tener una recogida y una entrega por animal en la ruta'; end if;

  select (pickup.value ->> 'animal_id')::uuid, pickup_stop.sequence, delivery_stop.sequence
    into v_first_animal, v_pickup_sequence, v_delivery_sequence
  from jsonb_array_elements(p_actions) pickup
  join jsonb_array_elements(p_actions) delivery on delivery.value ->> 'animal_id' = pickup.value ->> 'animal_id'
    and delivery.value ->> 'type' = 'entrega'
  join public.daily_route_stops pickup_stop on pickup_stop.id = (pickup.value ->> 'stop_id')::uuid
  join public.daily_route_stops delivery_stop on delivery_stop.id = (delivery.value ->> 'stop_id')::uuid
  where pickup.value ->> 'type' = 'recogida' limit 1;
  if v_pickup_sequence >= v_delivery_sequence or exists (
    select 1 from jsonb_array_elements(p_actions) action
    join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid
    where (action.value ->> 'type' = 'recogida' and stop.sequence <> v_pickup_sequence)
      or (action.value ->> 'type' = 'entrega' and stop.sequence <> v_delivery_sequence)
  ) then raise exception 'Las paradas de recogida y entrega no son válidas'; end if;

  -- A manually selected box can be shared, but never silently on stale route data.
  if not coalesce(p_share_box, false) and exists (
    select 1 from public.van_assignments assignment
    where assignment.daily_route_id = p_daily_route_id and assignment.letter_id <> p_letter_id
      and assignment.box_number = p_box_number
      and int4range(assignment.pickup_sequence, assignment.delivery_sequence, '[]')
        && int4range(v_pickup_sequence, v_delivery_sequence, '[]')
  ) then raise exception 'El box está ocupado en este tramo'; end if;

  select coalesce(jsonb_agg(to_jsonb(action)), '[]'::jsonb) into v_old_actions
    from public.route_actions action where action.letter_id = p_letter_id;
  update public.carriage_letters set
    service_date = v_route.service_date, default_route_template_id = v_route.route_template_id,
    sender_name = p_letter ->> 'sender_name', sender_nif = p_letter ->> 'sender_nif',
    sender_email = p_letter ->> 'sender_email', sender_address = p_letter ->> 'sender_address',
    sender_postal_code = p_letter ->> 'sender_postal_code', sender_city = p_letter ->> 'sender_city',
    sender_province = p_letter ->> 'sender_province', sender_phone = p_letter ->> 'sender_phone',
    recipient_name = p_letter ->> 'recipient_name', recipient_nif = p_letter ->> 'recipient_nif',
    recipient_email = p_letter ->> 'recipient_email', recipient_address = p_letter ->> 'recipient_address',
    recipient_postal_code = p_letter ->> 'recipient_postal_code', recipient_city = p_letter ->> 'recipient_city',
    recipient_province = p_letter ->> 'recipient_province', recipient_phone = p_letter ->> 'recipient_phone',
    origin_text = p_letter ->> 'origin_text', destination_text = p_letter ->> 'destination_text',
    origin_point = p_letter ->> 'origin_point', destination_point = p_letter ->> 'destination_point',
    accompanying_documents = array(select jsonb_array_elements_text(p_letter -> 'accompanying_documents')),
    ates_number = coalesce(p_letter ->> 'ates_number', ates_number),
    billing_payer = (p_letter ->> 'billing_payer')::public.payer_type,
    billing_client = p_letter -> 'billing_client',
    signed_at = case when p_signature_confirmed then now() else signed_at end
  where id = p_letter_id;

  delete from public.van_assignments where letter_id = p_letter_id;
  delete from public.route_actions where letter_id = p_letter_id;
  delete from public.animals animal where animal.letter_id = p_letter_id
    and not exists (select 1 from jsonb_array_elements(p_animals) item where item.value ->> 'id' = animal.id::text);
  insert into public.animals (id, letter_id, ordinal, species, breed, birth_date, size,
    weight_kg, length_cm, height_cm, width_cm, box_category)
  select (item.value ->> 'id')::uuid, p_letter_id, (item.value ->> 'ordinal')::integer,
    item.value ->> 'species', item.value ->> 'breed', nullif(item.value ->> 'birth_date', '')::date,
    (item.value ->> 'size')::public.animal_size, nullif((item.value ->> 'weight_kg')::numeric, 0),
    nullif((item.value ->> 'length_cm')::numeric, 0), nullif((item.value ->> 'height_cm')::numeric, 0),
    nullif((item.value ->> 'width_cm')::numeric, 0), nullif(item.value ->> 'box_category', '')
  from jsonb_array_elements(p_animals) item
  on conflict (id) do update set ordinal = excluded.ordinal, species = excluded.species,
    breed = excluded.breed, birth_date = excluded.birth_date, size = excluded.size,
    weight_kg = excluded.weight_kg, length_cm = excluded.length_cm, height_cm = excluded.height_cm,
    width_cm = excluded.width_cm, box_category = excluded.box_category;

  insert into public.route_actions (id, daily_route_id, daily_route_stop_id, letter_id, animal_id,
    action_type, status, completed_at, completed_by, incident_note, dwell_minutes)
  select (item.value ->> 'id')::uuid, p_daily_route_id, (item.value ->> 'stop_id')::uuid,
    p_letter_id, (item.value ->> 'animal_id')::uuid, (item.value ->> 'type')::public.service_type,
    coalesce((old.value ->> 'status')::public.service_action_status, 'pendiente'),
    (old.value ->> 'completed_at')::timestamptz, (old.value ->> 'completed_by')::uuid,
    coalesce(old.value ->> 'incident_note', ''), coalesce((old.value ->> 'dwell_minutes')::integer, 15)
  from jsonb_array_elements(p_actions) item
  left join lateral (select previous.value from jsonb_array_elements(v_old_actions) previous
    where previous.value ->> 'animal_id' = item.value ->> 'animal_id'
      and previous.value ->> 'action_type' = item.value ->> 'type'
    order by (previous.value ->> 'daily_route_id' = p_daily_route_id::text) desc limit 1) old on true;

  -- Administrators may override size compatibility while editing the letter.
  insert into public.van_assignments (daily_route_id, letter_id, animal_id, box_number,
    pickup_sequence, delivery_sequence)
  values (p_daily_route_id, p_letter_id, v_first_animal, p_box_number,
    v_pickup_sequence, v_delivery_sequence);
end;
$$;

revoke all on function public.update_carriage_letter_atomically(text, uuid, jsonb, jsonb, jsonb, integer, boolean, boolean) from public, anon;
grant execute on function public.update_carriage_letter_atomically(text, uuid, jsonb, jsonb, jsonb, integer, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';