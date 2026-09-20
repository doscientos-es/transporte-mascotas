-- Transport prices are managed by administrators and copied to each request at
-- submission time. Existing requests receive a safe positive placeholder until
-- they are replaced by a new request.
alter table public.transport_requests
  add column if not exists amount_cents integer not null default 1 check (amount_cents > 0),
  add column if not exists payment_public_token uuid unique default gen_random_uuid(),
  add column if not exists payment_merchant_order text unique,
  add column if not exists payment_expires_at timestamptz not null default now() + interval '30 days',
  add column if not exists payment_gateway_response jsonb not null default '{}'::jsonb;

create table public.transport_box_prices (
  size public.animal_size primary key,
  amount_cents integer not null check (amount_cents > 0),
  updated_at timestamptz not null default now()
);

insert into public.transport_box_prices (size, amount_cents)
values ('pequeno', 8000), ('mediano', 10000), ('grande', 14000)
on conflict (size) do nothing;

update public.transport_requests request
set amount_cents = coalesce((
  select sum(price.amount_cents)::integer
  from public.transport_request_animals animal
  join public.transport_box_prices price on price.size = animal.size
  where animal.request_id = request.id
), 1);

create trigger transport_box_prices_updated_at
before update on public.transport_box_prices for each row execute function public.set_updated_at();

alter table public.transport_box_prices enable row level security;
create policy "transport box prices authenticated read" on public.transport_box_prices
  for select to authenticated using (true);
create policy "transport box prices admin manage" on public.transport_box_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.transport_box_prices to authenticated;
grant update, insert on public.transport_box_prices to authenticated;
revoke delete on public.transport_box_prices from authenticated;

create or replace function public.update_transport_box_prices(p_prices jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  expected public.animal_size[] := array['pequeno'::public.animal_size, 'mediano'::public.animal_size, 'grande'::public.animal_size];
  current_size public.animal_size;
  value_cents integer;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cambiar las tarifas'; end if;
  if jsonb_typeof(p_prices) <> 'object' then raise exception 'Las tarifas no son válidas'; end if;
  foreach current_size in array expected loop
    if jsonb_typeof(p_prices -> current_size::text) <> 'number' then
      raise exception 'Introduce un importe válido para cada tamaño de box';
    end if;
    value_cents := (p_prices ->> current_size::text)::integer;
    if value_cents <= 0 then raise exception 'Los importes deben ser positivos'; end if;
    insert into public.transport_box_prices (size, amount_cents)
    values (current_size, value_cents)
    on conflict (size) do update set amount_cents = excluded.amount_cents, updated_at = now();
  end loop;
end;
$$;

revoke all on function public.update_transport_box_prices(jsonb) from public, anon;
grant execute on function public.update_transport_box_prices(jsonb) to authenticated;

-- The latest request function validates the route and calculates the amount
-- after the animal-size trigger has assigned each server-side size.
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
    request_id, ordinal, name, species, breed, weight_kg, length_cm, height_cm, width_cm, client_pet_id
  )
  select v_request_id, animal.ordinality::integer, btrim(animal.value ->> 'name'),
    btrim(animal.value ->> 'species'), coalesce(btrim(animal.value ->> 'breed'), ''),
    (animal.value ->> 'weight_kg')::numeric, (animal.value ->> 'length_cm')::numeric,
    (animal.value ->> 'height_cm')::numeric, (animal.value ->> 'width_cm')::numeric,
    nullif(animal.value ->> 'client_pet_id', '')::uuid
  from jsonb_array_elements(p_animals) with ordinality as animal(value, ordinality);

  select sum(pr.amount_cents)::integer into v_amount_cents
  from public.transport_request_animals animal
  join public.transport_box_prices pr on pr.size = animal.size
  where animal.request_id = v_request_id;
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

create or replace function public.prepare_transport_payment(p_request_id uuid, p_requester_id uuid)
returns table (public_token uuid, merchant_order text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  request public.transport_requests;
begin
  select * into request from public.transport_requests
  where id = p_request_id and requester_id = p_requester_id for update;
  if request.id is null then raise exception 'Solicitud no encontrada'; end if;
  if request.status <> 'pago_pendiente' then raise exception 'Esta solicitud ya no admite pagos'; end if;
  if request.amount_cents <= 0 then raise exception 'El importe de la solicitud no es válido'; end if;
  if request.payment_merchant_order is null then
    update public.transport_requests
    set payment_merchant_order = 'T' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 11))
    where id = request.id
    returning * into request;
  end if;
  return query select request.payment_public_token, request.payment_merchant_order, request.payment_expires_at;
end;
$$;

revoke all on function public.prepare_transport_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_transport_payment(uuid, uuid) to service_role;