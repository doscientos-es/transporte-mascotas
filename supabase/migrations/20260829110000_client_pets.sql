-- Private reusable pet profiles. Request animals remain immutable snapshots.
alter table public.transport_request_animals
  add column if not exists name text not null default '',
  add column if not exists client_pet_id uuid;

create table if not exists public.client_pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  species text not null check (btrim(species) <> ''),
  breed text not null default '',
  weight_kg numeric not null check (weight_kg > 0),
  length_cm numeric not null check (length_cm > 0),
  height_cm numeric not null check (height_cm > 0),
  width_cm numeric not null check (width_cm > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transport_request_animals
  add constraint transport_request_animals_client_pet_id_fkey
  foreign key (client_pet_id) references public.client_pets(id) on delete set null;

create unique index if not exists client_pets_owner_name_key
  on public.client_pets (owner_id, lower(btrim(name)));

alter table public.client_pets enable row level security;
create policy "client pets owner read" on public.client_pets
  for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.client_pets from public, anon, authenticated;
grant select on public.client_pets to authenticated;

create or replace function public.save_client_pets(p_pets jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
      or coalesce((pet.value ->> 'weight_kg')::numeric, 0) <= 0
      or coalesce((pet.value ->> 'length_cm')::numeric, 0) <= 0
      or coalesce((pet.value ->> 'height_cm')::numeric, 0) <= 0
      or coalesce((pet.value ->> 'width_cm')::numeric, 0) <= 0
  ) then raise exception 'Los datos de la mascota no son válidos'; end if;

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

revoke all on function public.save_client_pets(jsonb) from public, anon;
grant execute on function public.save_client_pets(jsonb) to authenticated;

create or replace function public.submit_transport_request(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request_id uuid; v_route_template_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para enviar una solicitud'; end if;
  if coalesce(btrim(p_contact_name), '') = '' or coalesce(btrim(p_contact_phone), '') = ''
    or coalesce(btrim(p_contact_email), '') = '' or coalesce(btrim(p_origin), '') = '' or coalesce(btrim(p_destination), '') = '' then
    raise exception 'Completa los datos de contacto y del trayecto'; end if;
  if p_desired_date is null or p_desired_date < current_date then raise exception 'La fecha solicitada no es válida'; end if;
  if jsonb_typeof(p_animals) <> 'array' or jsonb_array_length(p_animals) = 0 then raise exception 'Incluye al menos una mascota'; end if;
  if exists (select 1 from jsonb_array_elements(p_animals) as animal(value)
    where jsonb_typeof(animal.value) <> 'object' or coalesce(btrim(animal.value ->> 'name'), '') = ''
      or coalesce(btrim(animal.value ->> 'species'), '') = '') then raise exception 'Los datos de las mascotas no son válidos'; end if;
  if exists (select 1 from jsonb_array_elements(p_animals) as animal(value)
    where coalesce(animal.value ->> 'client_pet_id', '') <> '' and (
      animal.value ->> 'client_pet_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists (select 1 from public.client_pets pet where pet.id = (animal.value ->> 'client_pet_id')::uuid and pet.owner_id = auth.uid())
    )) then raise exception 'La mascota seleccionada no está disponible'; end if;
  select route.route_template_id into v_route_template_id from public.daily_routes route
    where route.id = p_daily_route_id and route.service_date = p_desired_date and route.status in ('borrador', 'activa');
  if not found then raise exception 'La salida seleccionada ya no está disponible'; end if;
  if not exists (select 1 from public.daily_route_stops pickup join public.daily_route_stops delivery
    on delivery.daily_route_id = pickup.daily_route_id and delivery.sequence > pickup.sequence
    where pickup.daily_route_id = p_daily_route_id and lower(btrim(pickup.locality)) = lower(btrim(p_origin))
      and lower(btrim(delivery.locality)) = lower(btrim(p_destination))) then
    raise exception 'La recogida y la entrega deben ser paradas de la salida seleccionada y respetar su sentido'; end if;
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

revoke all on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb) from public, anon;
grant execute on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb) to authenticated;