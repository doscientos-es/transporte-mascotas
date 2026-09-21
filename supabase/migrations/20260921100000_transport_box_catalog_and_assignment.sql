-- Real box catalogue and the distinction between the automatic recommendation,
-- the client's requested category and the final operational assignment.
create table public.transport_box_catalog (
  category text primary key check (category in ('pequeno', 'mediano', 'grande', 'paso_rueda')),
  label text not null,
  amount_cents integer not null check (amount_cents > 0),
  large_amount_cents integer check (large_amount_cents is null or large_amount_cents > 0),
  dimensions text not null,
  sort_order integer not null check (sort_order > 0),
  updated_at timestamptz not null default now()
);

insert into public.transport_box_catalog (
  category, label, amount_cents, large_amount_cents, dimensions, sort_order
)
values
  ('pequeno', 'Box pequeño', 10000, null, '33 × 46 × 29 cm · también disponible 33 × 36 × 29 cm', 1),
  ('mediano', 'Box mediano', 12000, null, '50 × 52 × 50 cm', 2),
  ('grande', 'Box grande', 15000, 18000, '100 × 58 × 75 cm · 180 € desde 50 kg', 3),
  ('paso_rueda', 'Box paso de rueda', 12000, 15000, '100 × 36/58 × 36 × 75 cm · según tamaño', 4)
on conflict (category) do update set
  label = excluded.label,
  amount_cents = excluded.amount_cents,
  large_amount_cents = excluded.large_amount_cents,
  dimensions = excluded.dimensions,
  sort_order = excluded.sort_order;

create trigger transport_box_catalog_updated_at
before update on public.transport_box_catalog
for each row execute function public.set_updated_at();

alter table public.transport_box_catalog enable row level security;
create policy "transport box catalog authenticated read" on public.transport_box_catalog
  for select to authenticated using (true);
create policy "transport box catalog admin manage" on public.transport_box_catalog
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.transport_box_catalog to authenticated;
grant update, insert on public.transport_box_catalog to authenticated;
revoke delete on public.transport_box_catalog from authenticated;

alter table public.transport_request_animals
  add column if not exists minimum_box_category text not null default 'pequeno'
    check (minimum_box_category in ('pequeno', 'mediano', 'grande')),
  add column if not exists requested_box_category text not null default 'pequeno'
    check (requested_box_category in ('pequeno', 'mediano', 'grande', 'paso_rueda')),
  add column if not exists assigned_box_category text not null default 'pequeno'
    check (assigned_box_category in ('pequeno', 'mediano', 'grande', 'paso_rueda')),
  add column if not exists box_assignment_source text not null default 'automatico'
    check (box_assignment_source in ('automatico', 'cliente', 'admin'));

update public.transport_request_animals
set minimum_box_category = size::text,
    requested_box_category = size::text,
    assigned_box_category = size::text
where true;

alter table public.animals
  add column if not exists box_category text
    check (box_category is null or box_category in ('pequeno', 'mediano', 'grande', 'paso_rueda'));

create or replace function public.box_category_rank(p_category text)
returns integer language sql immutable set search_path = '' as $$
  select case p_category when 'pequeno' then 1 when 'mediano' then 2 when 'grande' then 3
    when 'paso_rueda' then 3 else 0 end;
$$;

create or replace function public.box_category_for_measurements(
  p_weight_kg numeric,
  p_length_cm numeric,
  p_height_cm numeric,
  p_width_cm numeric
)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if p_weight_kg >= 50
    or p_length_cm > 50 or p_height_cm > 50 or p_width_cm > 52 then
    if p_length_cm > 100 or p_height_cm > 75 or p_width_cm > 58 then
      raise exception 'Las medidas superan el box grande disponible';
    end if;
    return 'grande';
  end if;
  if p_length_cm <= 33 and p_height_cm <= 29 and p_width_cm <= 46 then
    return 'pequeno';
  end if;
  if p_length_cm <= 50 and p_height_cm <= 50 and p_width_cm <= 52 then
    return 'mediano';
  end if;
  if p_length_cm <= 100 and p_height_cm <= 75 and p_width_cm <= 58 then
    return 'grande';
  end if;
  raise exception 'Las medidas superan el box grande disponible';
end;
$$;

create or replace function public.transport_box_price_cents(
  p_category text,
  p_minimum_category text,
  p_weight_kg numeric
)
returns integer language plpgsql stable set search_path = '' as $$
declare
  catalog_row public.transport_box_catalog;
begin
  select * into catalog_row from public.transport_box_catalog where category = p_category;
  if catalog_row.category is null then raise exception 'Categoría de box no válida'; end if;
  if p_category = 'grande' and p_weight_kg >= 50 then
    return coalesce(catalog_row.large_amount_cents, catalog_row.amount_cents);
  end if;
  if p_category = 'paso_rueda' and public.box_category_rank(p_minimum_category) >= 3 then
    return coalesce(catalog_row.large_amount_cents, catalog_row.amount_cents);
  end if;
  return catalog_row.amount_cents;
end;
$$;

create or replace function public.set_request_animal_box_categories()
returns trigger language plpgsql set search_path = '' as $$
declare minimum_category text;
begin
  minimum_category := public.box_category_for_measurements(
    new.weight_kg, new.length_cm, new.height_cm, new.width_cm
  );
  new.minimum_box_category = minimum_category;
  if public.box_category_rank(new.requested_box_category) < public.box_category_rank(minimum_category)
    and new.requested_box_category <> 'paso_rueda' then
    new.requested_box_category = minimum_category;
    new.box_assignment_source = 'automatico';
  end if;
  if new.assigned_box_category is null
    or (new.assigned_box_category <> 'paso_rueda'
      and public.box_category_rank(new.assigned_box_category) < public.box_category_rank(minimum_category)) then
    new.assigned_box_category = new.requested_box_category;
  end if;
  return new;
end;
$$;

drop trigger if exists transport_request_animals_size on public.transport_request_animals;
create trigger transport_request_animals_box_categories
before insert or update of weight_kg, length_cm, height_cm, width_cm, requested_box_category, assigned_box_category
on public.transport_request_animals
for each row execute function public.set_request_animal_box_categories();

create or replace function public.update_transport_box_catalog(p_prices jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  category text;
  regular_cents integer;
  large_cents integer;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cambiar las tarifas'; end if;
  if jsonb_typeof(p_prices) <> 'object' then raise exception 'Las tarifas no son válidas'; end if;
  foreach category in array array['pequeno', 'mediano', 'grande', 'paso_rueda'] loop
    if jsonb_typeof(p_prices -> category) <> 'number' then
      raise exception 'Introduce un importe válido para cada categoría';
    end if;
    regular_cents := (p_prices ->> category)::integer;
    if regular_cents <= 0 then raise exception 'Los importes deben ser positivos'; end if;
    large_cents := null;
    if category in ('grande', 'paso_rueda') then
      if jsonb_typeof(p_prices -> (category || '_grande')) <> 'number' then
        raise exception 'Introduce también la tarifa superior de %', category;
      end if;
      large_cents := (p_prices ->> (category || '_grande'))::integer;
      if large_cents <= 0 then raise exception 'Los importes deben ser positivos'; end if;
    end if;
    update public.transport_box_catalog
    set amount_cents = regular_cents, large_amount_cents = large_cents, updated_at = now()
    where transport_box_catalog.category = category;
  end loop;
end;
$$;

revoke all on function public.update_transport_box_catalog(jsonb) from public, anon;
grant execute on function public.update_transport_box_catalog(jsonb) to authenticated;

create or replace function public.update_transport_request_animal_box(
  p_animal_id uuid,
  p_category text
)
returns void language plpgsql security definer set search_path = '' as $$
declare minimum_category text; request_status public.transport_request_status;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cambiar la caja'; end if;
  select animal.minimum_box_category, request.status into minimum_category, request_status
  from public.transport_request_animals animal
  join public.transport_requests request on request.id = animal.request_id
  where animal.id = p_animal_id;
  if minimum_category is null then raise exception 'Animal no encontrado'; end if;
  if p_category not in ('pequeno', 'mediano', 'grande', 'paso_rueda') then
    raise exception 'Categoría de box no válida';
  end if;
  if p_category <> 'paso_rueda'
    and public.box_category_rank(p_category) < public.box_category_rank(minimum_category) then
    raise exception 'No se puede asignar una caja menor que la recomendada';
  end if;
  update public.transport_request_animals
  set assigned_box_category = p_category, box_assignment_source = 'admin'
  where id = p_animal_id;
end;
$$;

revoke all on function public.update_transport_request_animal_box(uuid, text) from public, anon;
grant execute on function public.update_transport_request_animal_box(uuid, text) to authenticated;

create or replace function public.submit_transport_request(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
  v_route_template_id uuid;
  v_amount_cents integer;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para enviar una solicitud'; end if;
  if coalesce(btrim(p_contact_name), '') = '' or coalesce(btrim(p_contact_phone), '') = ''
    or coalesce(btrim(p_contact_email), '') = '' or coalesce(btrim(p_origin), '') = ''
    or coalesce(btrim(p_destination), '') = '' then
    raise exception 'Completa los datos de contacto y del trayecto';
  end if;
  if btrim(p_contact_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Escribe un correo electrónico válido';
  end if;
  if p_desired_date is null or p_desired_date < current_date then
    raise exception 'La fecha solicitada no es válida';
  end if;
  if jsonb_typeof(p_animals) <> 'array' or jsonb_array_length(p_animals) = 0 then
    raise exception 'Incluye al menos una mascota';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) as animal(value)
    where jsonb_typeof(animal.value) <> 'object'
      or coalesce(btrim(animal.value ->> 'name'), '') = ''
      or coalesce(btrim(animal.value ->> 'species'), '') = ''
      or coalesce((animal.value ->> 'weight_kg')::numeric, 0) <= 0
      or coalesce((animal.value ->> 'length_cm')::numeric, 0) <= 0
      or coalesce((animal.value ->> 'height_cm')::numeric, 0) <= 0
      or coalesce((animal.value ->> 'width_cm')::numeric, 0) <= 0
  ) then raise exception 'Revisa los datos de cada mascota'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) as animal(value)
    where coalesce(animal.value ->> 'client_pet_id', '') <> ''
      and (
        animal.value ->> 'client_pet_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not exists (
          select 1 from public.client_pets pet
          where pet.id = (animal.value ->> 'client_pet_id')::uuid and pet.owner_id = auth.uid()
        )
      )
  ) then raise exception 'La mascota seleccionada no está disponible'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) as animal(value)
    where coalesce(animal.value ->> 'requested_box_category', '') not in
      ('pequeno', 'mediano', 'grande', 'paso_rueda')
      or (
        animal.value ->> 'requested_box_category' <> 'paso_rueda'
        and public.box_category_rank(animal.value ->> 'requested_box_category') < public.box_category_rank(
          public.box_category_for_measurements(
            (animal.value ->> 'weight_kg')::numeric,
            (animal.value ->> 'length_cm')::numeric,
            (animal.value ->> 'height_cm')::numeric,
            (animal.value ->> 'width_cm')::numeric
          )
        )
      )
  ) then raise exception 'La categoría de box elegida no es suficiente para la mascota'; end if;
  select route.route_template_id into v_route_template_id
  from public.daily_routes route
  where route.id = p_daily_route_id and route.service_date = p_desired_date and route.status = 'activa';
  if not found then raise exception 'La salida seleccionada ya no está disponible'; end if;
  if not exists (
    select 1
    from public.daily_route_stops pickup
    join public.daily_route_stops delivery
      on delivery.daily_route_id = pickup.daily_route_id and delivery.sequence > pickup.sequence
    where pickup.daily_route_id = p_daily_route_id
      and lower(btrim(pickup.locality)) = lower(btrim(p_origin))
      and lower(btrim(delivery.locality)) = lower(btrim(p_destination))
  ) then raise exception 'La recogida y la entrega deben respetar la ruta seleccionada'; end if;
  insert into public.transport_requests (
    requester_id, contact_name, contact_phone, contact_email, origin_text, destination_text,
    desired_date, route_template_id, daily_route_id, notes
  ) values (
    auth.uid(), btrim(p_contact_name), btrim(p_contact_phone), btrim(p_contact_email),
    btrim(p_origin), btrim(p_destination), p_desired_date, v_route_template_id,
    p_daily_route_id, coalesce(btrim(p_notes), '')
  ) returning id into v_request_id;
  insert into public.transport_request_animals (
    request_id, ordinal, name, species, breed, weight_kg, length_cm, height_cm, width_cm,
    client_pet_id, requested_box_category, assigned_box_category, box_assignment_source
  )
  select v_request_id, animal.ordinality::integer, btrim(animal.value ->> 'name'),
    btrim(animal.value ->> 'species'), coalesce(btrim(animal.value ->> 'breed'), ''),
    (animal.value ->> 'weight_kg')::numeric, (animal.value ->> 'length_cm')::numeric,
    (animal.value ->> 'height_cm')::numeric, (animal.value ->> 'width_cm')::numeric,
    nullif(animal.value ->> 'client_pet_id', '')::uuid,
    animal.value ->> 'requested_box_category', animal.value ->> 'requested_box_category', 'cliente'
  from jsonb_array_elements(p_animals) with ordinality as animal(value, ordinality);
  select sum(public.transport_box_price_cents(
    animal.requested_box_category, animal.minimum_box_category, animal.weight_kg
  ))::integer into v_amount_cents
  from public.transport_request_animals animal where animal.request_id = v_request_id;
  if coalesce(v_amount_cents, 0) <= 0 then raise exception 'No se han podido calcular las tarifas'; end if;
  update public.transport_requests set amount_cents = v_amount_cents where id = v_request_id;
  update public.client_pets pet
  set name = btrim(animal.value ->> 'name'), species = btrim(animal.value ->> 'species'),
    breed = coalesce(btrim(animal.value ->> 'breed'), ''), weight_kg = (animal.value ->> 'weight_kg')::numeric,
    length_cm = (animal.value ->> 'length_cm')::numeric, height_cm = (animal.value ->> 'height_cm')::numeric,
    width_cm = (animal.value ->> 'width_cm')::numeric, updated_at = now()
  from jsonb_array_elements(p_animals) as animal(value)
  where pet.id = nullif(animal.value ->> 'client_pet_id', '')::uuid and pet.owner_id = auth.uid();
  return v_request_id;
end;
$$;

revoke all on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb) from public, anon;
grant execute on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb) to authenticated;

create or replace function public.confirm_transport_request(
  p_request_id uuid,
  p_daily_route_id uuid,
  p_pickup_stop_id uuid,
  p_delivery_stop_id uuid,
  p_admin_note text default ''
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  request public.transport_requests;
  pickup_sequence integer;
  delivery_sequence integer;
  new_letter_id text;
  largest_size public.animal_size;
  chosen_box integer;
  created_animal_id uuid;
  first_animal_id uuid;
  animal record;
  operational_category text;
begin
  if not public.is_admin() then raise exception 'Solo administración puede confirmar solicitudes'; end if;
  select * into request from public.transport_requests where id = p_request_id for update;
  if request.id is null then raise exception 'Solicitud no encontrada'; end if;
  if request.status <> 'por_verificar' then raise exception 'La solicitud no está pendiente de verificación'; end if;
  select sequence into pickup_sequence from public.daily_route_stops
    where id = p_pickup_stop_id and daily_route_id = p_daily_route_id;
  select sequence into delivery_sequence from public.daily_route_stops
    where id = p_delivery_stop_id and daily_route_id = p_daily_route_id;
  if pickup_sequence is null or delivery_sequence is null then raise exception 'Las paradas indicadas no pertenecen a la ruta'; end if;
  if delivery_sequence <= pickup_sequence then raise exception 'La entrega debe ir después de la recogida'; end if;
  new_letter_id = 'CARTA DE PORTE Nº ' || to_char(request.desired_date, 'YYYY') || '-P'
    || lpad(nextval('public.transport_request_letter_seq')::text, 5, '0');
  insert into public.carriage_letters (
    id, service_date, default_route_template_id, sender_name, sender_phone, sender_email,
    recipient_name, recipient_phone, recipient_email, origin_text, destination_text, entry_source, imported_by
  )
  select new_letter_id, request.desired_date, route.route_template_id,
    request.contact_name, request.contact_phone, request.contact_email,
    request.contact_name, request.contact_phone, request.contact_email,
    request.origin_text, request.destination_text, 'manual', auth.uid()
  from public.daily_routes route where route.id = p_daily_route_id;
  for animal in select * from public.transport_request_animals where request_id = p_request_id order by ordinal loop
    operational_category := coalesce(animal.assigned_box_category, animal.requested_box_category, animal.minimum_box_category);
    if operational_category = 'paso_rueda' then
      operational_category := 'grande';
    end if;
    insert into public.animals (letter_id, ordinal, species, breed, size, size_source, box_category)
    values (new_letter_id, animal.ordinal, animal.species, animal.breed, operational_category::public.animal_size, 'regla',
      coalesce(animal.assigned_box_category, animal.requested_box_category, animal.minimum_box_category))
    returning id into created_animal_id;
    if first_animal_id is null then first_animal_id = created_animal_id; end if;
    if largest_size is null or public.box_category_rank(operational_category) > public.box_category_rank(largest_size::text)
      then largest_size = operational_category::public.animal_size; end if;
    insert into public.route_actions (daily_route_id, daily_route_stop_id, letter_id, animal_id, action_type)
    values (p_daily_route_id, p_pickup_stop_id, new_letter_id, created_animal_id, 'recogida'),
      (p_daily_route_id, p_delivery_stop_id, new_letter_id, created_animal_id, 'entrega');
  end loop;
  if first_animal_id is null then raise exception 'La solicitud no tiene animales'; end if;
  chosen_box = public.suggest_free_box(p_daily_route_id, largest_size, pickup_sequence, delivery_sequence);
  if chosen_box is null then raise exception 'No queda ningún box libre para este tramo'; end if;
  insert into public.van_assignments (daily_route_id, letter_id, animal_id, box_number, pickup_sequence, delivery_sequence)
    values (p_daily_route_id, new_letter_id, first_animal_id, chosen_box, pickup_sequence, delivery_sequence);
  update public.transport_requests
    set status = 'confirmada', letter_id = new_letter_id, daily_route_id = p_daily_route_id,
      admin_note = coalesce(p_admin_note, '') where id = p_request_id;
  insert into public.transport_request_notifications (request_id, kind, channel, recipient)
    values (p_request_id, 'confirmacion', 'whatsapp', request.contact_phone)
    on conflict (request_id, kind, channel) do nothing;
  insert into public.audit_logs (actor_id, event_type, entity_type, entity_id)
    values (auth.uid(), 'transport_request_confirmed', 'transport_request', p_request_id::text);
  return new_letter_id;
end;
$$;

revoke all on function public.confirm_transport_request(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.confirm_transport_request(uuid, uuid, uuid, uuid, text) to authenticated;

update public.transport_box_prices set amount_cents = case size
  when 'pequeno' then 10000 when 'mediano' then 12000 when 'grande' then 15000 end;