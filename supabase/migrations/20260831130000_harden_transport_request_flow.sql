-- Public routes are only visible and selectable once operations has activated them.
create or replace function public.list_upcoming_routes()
returns table (
  id uuid,
  service_date date,
  route_direction text,
  template_name text,
  template_color text,
  localities text[]
)
language sql stable security definer set search_path = '' as $$
  select route.id,
         route.service_date,
         route.route_direction,
         coalesce(template.name, ''),
         coalesce(template.color, ''),
         coalesce((
           select array_agg(stop.locality order by stop.sequence)
           from public.daily_route_stops stop
           where stop.daily_route_id = route.id
         ), '{}')
  from public.daily_routes route
  left join public.route_templates template on template.id = route.route_template_id
  where auth.uid() is not null
    and route.status = 'activa'
    and route.service_date >= current_date
  order by route.service_date;
$$;

-- JSON payloads come from the browser and can be manipulated. Validate types and
-- bounds before casting so invalid values consistently produce useful feedback.
create or replace function public.save_client_pets(p_pets jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para guardar mascotas'; end if;
  if jsonb_typeof(p_pets) <> 'array' or jsonb_array_length(p_pets) = 0 then
    raise exception 'Incluye al menos una mascota válida';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_pets) as pet(value)
    where jsonb_typeof(pet.value) <> 'object'
      or coalesce(btrim(pet.value ->> 'name'), '') = ''
      or coalesce(btrim(pet.value ->> 'species'), '') = ''
      or case
        when jsonb_typeof(pet.value -> 'weight_kg') = 'number'
          and jsonb_typeof(pet.value -> 'length_cm') = 'number'
          and jsonb_typeof(pet.value -> 'height_cm') = 'number'
          and jsonb_typeof(pet.value -> 'width_cm') = 'number'
        then not (
          (pet.value ->> 'weight_kg')::numeric between 0.01 and 9999.99
          and (pet.value ->> 'length_cm')::numeric between 0.01 and 9999.99
          and (pet.value ->> 'height_cm')::numeric between 0.01 and 9999.99
          and (pet.value ->> 'width_cm')::numeric between 0.01 and 9999.99
        )
        else true
      end
  ) then raise exception 'Revisa el peso y las medidas de cada mascota'; end if;

  insert into public.client_pets (owner_id, name, species, breed, weight_kg, length_cm, height_cm, width_cm)
  select auth.uid(), btrim(value ->> 'name'), btrim(value ->> 'species'), coalesce(btrim(value ->> 'breed'), ''),
    (value ->> 'weight_kg')::numeric, (value ->> 'length_cm')::numeric,
    (value ->> 'height_cm')::numeric, (value ->> 'width_cm')::numeric
  from jsonb_array_elements(p_pets)
  on conflict (owner_id, lower(btrim(name))) do update set
    species = excluded.species, breed = excluded.breed, weight_kg = excluded.weight_kg,
    length_cm = excluded.length_cm, height_cm = excluded.height_cm, width_cm = excluded.width_cm,
    updated_at = now();
end;
$$;

create or replace function public.submit_transport_request(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request_id uuid; v_route_template_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para enviar una solicitud'; end if;
  if coalesce(btrim(p_contact_name), '') = '' or coalesce(btrim(p_contact_phone), '') = ''
    or coalesce(btrim(p_contact_email), '') = '' or coalesce(btrim(p_origin), '') = '' or coalesce(btrim(p_destination), '') = '' then
    raise exception 'Completa los datos de contacto y del trayecto';
  end if;
  if btrim(p_contact_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Escribe un correo electrónico válido';
  end if;
  if p_desired_date is null or p_desired_date < current_date then raise exception 'La fecha solicitada no es válida'; end if;
  if jsonb_typeof(p_animals) <> 'array' or jsonb_array_length(p_animals) = 0 then raise exception 'Incluye al menos una mascota'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) as animal(value)
    where jsonb_typeof(animal.value) <> 'object'
      or coalesce(btrim(animal.value ->> 'name'), '') = ''
      or coalesce(btrim(animal.value ->> 'species'), '') = ''
      or case
        when jsonb_typeof(animal.value -> 'weight_kg') = 'number'
          and jsonb_typeof(animal.value -> 'length_cm') = 'number'
          and jsonb_typeof(animal.value -> 'height_cm') = 'number'
          and jsonb_typeof(animal.value -> 'width_cm') = 'number'
        then not (
          (animal.value ->> 'weight_kg')::numeric between 0.01 and 9999.99
          and (animal.value ->> 'length_cm')::numeric between 0.01 and 9999.99
          and (animal.value ->> 'height_cm')::numeric between 0.01 and 9999.99
          and (animal.value ->> 'width_cm')::numeric between 0.01 and 9999.99
        )
        else true
      end
  ) then raise exception 'Revisa el nombre, la especie, el peso y las medidas de cada mascota'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) as animal(value)
    where coalesce(animal.value ->> 'client_pet_id', '') <> ''
      and case
        when animal.value ->> 'client_pet_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then not exists (select 1 from public.client_pets pet where pet.id = (animal.value ->> 'client_pet_id')::uuid and pet.owner_id = auth.uid())
        else true
      end
  ) then raise exception 'La mascota seleccionada no está disponible'; end if;
  select route.route_template_id into v_route_template_id from public.daily_routes route
    where route.id = p_daily_route_id and route.service_date = p_desired_date and route.status = 'activa';
  if not found then raise exception 'La salida seleccionada ya no está disponible'; end if;
  if not exists (
    select 1 from public.daily_route_stops pickup join public.daily_route_stops delivery
      on delivery.daily_route_id = pickup.daily_route_id and delivery.sequence > pickup.sequence
    where pickup.daily_route_id = p_daily_route_id and lower(btrim(pickup.locality)) = lower(btrim(p_origin))
      and lower(btrim(delivery.locality)) = lower(btrim(p_destination))
  ) then raise exception 'La recogida y la entrega deben ser paradas de la salida seleccionada y respetar su sentido'; end if;
  insert into public.transport_requests (requester_id, contact_name, contact_phone, contact_email, origin_text, destination_text, desired_date, route_template_id, daily_route_id, notes)
    values (auth.uid(), btrim(p_contact_name), btrim(p_contact_phone), btrim(p_contact_email), btrim(p_origin), btrim(p_destination), p_desired_date, v_route_template_id, p_daily_route_id, coalesce(btrim(p_notes), '')) returning id into v_request_id;
  insert into public.transport_request_animals (request_id, ordinal, name, species, breed, weight_kg, length_cm, height_cm, width_cm, client_pet_id)
    select v_request_id, animal.ordinality::integer, btrim(animal.value ->> 'name'), btrim(animal.value ->> 'species'), coalesce(btrim(animal.value ->> 'breed'), ''),
      (animal.value ->> 'weight_kg')::numeric, (animal.value ->> 'length_cm')::numeric, (animal.value ->> 'height_cm')::numeric, (animal.value ->> 'width_cm')::numeric,
      nullif(animal.value ->> 'client_pet_id', '')::uuid from jsonb_array_elements(p_animals) with ordinality as animal(value, ordinality);
  update public.client_pets pet set name = btrim(animal.value ->> 'name'), species = btrim(animal.value ->> 'species'), breed = coalesce(btrim(animal.value ->> 'breed'), ''),
    weight_kg = (animal.value ->> 'weight_kg')::numeric, length_cm = (animal.value ->> 'length_cm')::numeric,
    height_cm = (animal.value ->> 'height_cm')::numeric, width_cm = (animal.value ->> 'width_cm')::numeric, updated_at = now()
    from jsonb_array_elements(p_animals) as animal(value)
    where pet.id = nullif(animal.value ->> 'client_pet_id', '')::uuid and pet.owner_id = auth.uid();
  return v_request_id;
end;
$$;

create or replace function public.confirm_transport_request(
  p_request_id uuid, p_daily_route_id uuid, p_pickup_stop_id uuid, p_delivery_stop_id uuid, p_admin_note text default ''
) returns text language plpgsql security definer set search_path = '' as $$
declare
  request public.transport_requests;
  selected_route_id uuid;
  pickup_sequence integer;
  delivery_sequence integer;
  new_letter_id text;
  largest_size public.animal_size;
  chosen_box integer;
  created_animal_id uuid;
  first_animal_id uuid;
  animal record;
begin
  if not public.is_admin() then raise exception 'Solo administración puede confirmar solicitudes'; end if;
  select * into request from public.transport_requests where id = p_request_id for update;
  if request.id is null then raise exception 'Solicitud no encontrada'; end if;
  if request.status <> 'por_verificar' then raise exception 'La solicitud no está pendiente de verificación'; end if;
  select route.id into selected_route_id from public.daily_routes route
    where route.id = p_daily_route_id and route.id = request.daily_route_id
      and route.service_date = request.desired_date and route.status = 'activa'
    for share;
  if selected_route_id is null then
    raise exception 'La salida elegida ya no está activa o no coincide con la solicitud';
  end if;
  select sequence into pickup_sequence from public.daily_route_stops
    where id = p_pickup_stop_id and daily_route_id = p_daily_route_id;
  select sequence into delivery_sequence from public.daily_route_stops
    where id = p_delivery_stop_id and daily_route_id = p_daily_route_id;
  if pickup_sequence is null or delivery_sequence is null then raise exception 'Las paradas indicadas no pertenecen a la ruta'; end if;
  if delivery_sequence <= pickup_sequence then raise exception 'La entrega debe ir después de la recogida'; end if;
  new_letter_id = 'CARTA DE PORTE Nº ' || to_char(request.desired_date, 'YYYY') || '-P' || lpad(nextval('public.transport_request_letter_seq')::text, 5, '0');
  insert into public.carriage_letters (id, service_date, default_route_template_id, sender_name, sender_phone, sender_email, recipient_name, recipient_phone, recipient_email, origin_text, destination_text, entry_source, imported_by)
  select new_letter_id, request.desired_date, route.route_template_id, request.contact_name, request.contact_phone, request.contact_email, request.contact_name, request.contact_phone, request.contact_email, request.origin_text, request.destination_text, 'manual', auth.uid()
  from public.daily_routes route where route.id = p_daily_route_id;
  for animal in select * from public.transport_request_animals where request_id = p_request_id order by ordinal loop
    insert into public.animals (letter_id, ordinal, species, breed, size, size_source)
    values (new_letter_id, animal.ordinal, animal.species, animal.breed, animal.size, 'regla') returning id into created_animal_id;
    if first_animal_id is null then first_animal_id = created_animal_id; end if;
    if largest_size is null or animal.size = 'grande' or (animal.size = 'mediano' and largest_size = 'pequeno') then largest_size = animal.size; end if;
    insert into public.route_actions (daily_route_id, daily_route_stop_id, letter_id, animal_id, action_type)
    values (p_daily_route_id, p_pickup_stop_id, new_letter_id, created_animal_id, 'recogida'), (p_daily_route_id, p_delivery_stop_id, new_letter_id, created_animal_id, 'entrega');
  end loop;
  if first_animal_id is null then raise exception 'La solicitud no tiene animales'; end if;
  chosen_box = public.suggest_free_box(p_daily_route_id, largest_size, pickup_sequence, delivery_sequence);
  if chosen_box is null then raise exception 'No queda ningún box libre para este tramo'; end if;
  perform public.assign_van_box(p_daily_route_id, new_letter_id, first_animal_id, chosen_box, pickup_sequence, delivery_sequence);
  update public.transport_requests set status = 'confirmada', letter_id = new_letter_id, daily_route_id = p_daily_route_id, admin_note = coalesce(p_admin_note, '') where id = p_request_id;
  insert into public.transport_request_notifications (request_id, kind, channel, recipient, scheduled_for)
  values (p_request_id, 'confirmacion', 'whatsapp', request.contact_phone, now()),
    (p_request_id, 'recordatorio_ruta', 'whatsapp', request.contact_phone, ((request.desired_date - 1)::timestamp + time '10:00') at time zone 'Europe/Madrid')
  on conflict (request_id, kind, channel) do nothing;
  insert into public.audit_logs (actor_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'transport_request_confirmed', 'transport_request', p_request_id::text);
  return new_letter_id;
end;
$$;

revoke all on function public.list_upcoming_routes() from public, anon;
grant execute on function public.list_upcoming_routes() to authenticated;
revoke all on function public.save_client_pets(jsonb) from public, anon;
grant execute on function public.save_client_pets(jsonb) to authenticated;
revoke all on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb) from public, anon;
grant execute on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb) to authenticated;
revoke all on function public.confirm_transport_request(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.confirm_transport_request(uuid, uuid, uuid, uuid, text) to authenticated;
