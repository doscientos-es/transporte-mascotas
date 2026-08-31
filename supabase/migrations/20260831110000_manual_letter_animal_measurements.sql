alter table public.animals
  add column if not exists weight_kg numeric(6,2),
  add column if not exists length_cm numeric(6,2),
  add column if not exists height_cm numeric(6,2),
  add column if not exists width_cm numeric(6,2),
  add constraint animals_weight_kg_positive check (weight_kg is null or weight_kg > 0) not valid,
  add constraint animals_length_cm_positive check (length_cm is null or length_cm > 0) not valid,
  add constraint animals_height_cm_positive check (height_cm is null or height_cm > 0) not valid,
  add constraint animals_width_cm_positive check (width_cm is null or width_cm > 0) not valid;

alter table public.animals drop constraint if exists animals_size_source_check;
alter table public.animals
  add constraint animals_size_source_check check (size_source in ('regla', 'manual', 'medidas'));

create or replace function public.set_animal_size_from_measurements()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.weight_kg is not null and new.length_cm is not null and new.height_cm is not null then
    new.size = public.size_for_measurements(new.weight_kg, new.length_cm, new.height_cm);
    new.size_source = 'medidas';
  end if;
  return new;
end;
$$;

drop trigger if exists animals_measurements_size on public.animals;
create trigger animals_measurements_size
before insert or update of weight_kg, length_cm, height_cm on public.animals
for each row execute function public.set_animal_size_from_measurements();

create or replace function public.create_manual_carriage_letter(
  p_daily_route_id uuid, p_reference text, p_sender jsonb, p_recipient jsonb,
  p_origin_stop text, p_destination_stop text, p_origin_point text, p_destination_point text,
  p_accompanying_documents text[], p_billing_payer public.payer_type,
  p_billing_client jsonb, p_signature_confirmed boolean, p_animals jsonb,
  p_actions jsonb, p_box_number integer
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_letter_id text;
  v_template_id uuid;
  v_pickup_sequence integer;
  v_delivery_sequence integer;
  v_first_animal_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo administración puede crear cartas de porte'; end if;
  if not p_signature_confirmed then raise exception 'Debes confirmar que firmas la carta de porte'; end if;
  if jsonb_typeof(p_sender) <> 'object' or jsonb_typeof(p_recipient) <> 'object' or jsonb_typeof(p_billing_client) <> 'object' then
    raise exception 'Los datos de contacto no son válidos';
  end if;
  if exists (
    select 1 from (values
      (p_sender ->> 'name'), (p_sender ->> 'phone'), (p_recipient ->> 'name'), (p_recipient ->> 'phone'),
      (p_origin_stop), (p_destination_stop)
    ) as required(value) where nullif(btrim(value), '') is null
  ) then raise exception 'Completa los datos obligatorios de la carta'; end if;
  if p_billing_payer = 'manual' and exists (
    select 1 from (values
      (p_billing_client ->> 'fullName'), (p_billing_client ->> 'nif'), (p_billing_client ->> 'email'), (p_billing_client ->> 'phone'), (p_billing_client ->> 'address'), (p_billing_client ->> 'postalCode'), (p_billing_client ->> 'city')
    ) as required(value) where nullif(btrim(value), '') is null
  ) then raise exception 'Completa los datos fiscales de la empresa u otro pagador'; end if;
  if coalesce(cardinality(p_accompanying_documents), 0) = 0 then raise exception 'Selecciona al menos un documento que acompañe al animal'; end if;
  if exists (select 1 from unnest(coalesce(p_accompanying_documents, '{}')) document where document not in ('cartilla_sanitaria', 'microchip', 'pasaporte', 'tatuaje', 'anillo', 'cites', 'otro')) then
    raise exception 'La documentación indicada no es válida';
  end if;
  select route.route_template_id into v_template_id from public.daily_routes route where route.id = p_daily_route_id;
  if v_template_id is null then raise exception 'La ruta diaria no existe o no tiene plantilla'; end if;
  if jsonb_typeof(p_animals) <> 'array' or jsonb_array_length(p_animals) = 0 then raise exception 'La carta debe incluir al menos un animal'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) animal
    where nullif(btrim(animal.value ->> 'species'), '') is null
      or coalesce((animal.value ->> 'weight_kg')::numeric, 0) <= 0
      or coalesce((animal.value ->> 'length_cm')::numeric, 0) <= 0
      or coalesce((animal.value ->> 'height_cm')::numeric, 0) <= 0
      or coalesce((animal.value ->> 'width_cm')::numeric, 0) <= 0
  ) then raise exception 'Indica especie, peso y medidas para cada animal'; end if;
  if jsonb_typeof(p_actions) <> 'array' or jsonb_array_length(p_actions) <> jsonb_array_length(p_animals) * 2 then raise exception 'La carta debe incluir una recogida y una entrega por animal'; end if;

  v_letter_id := nullif(btrim(p_reference), '');
  if v_letter_id is null then v_letter_id := format('CARTA DE PORTE Nº %s-%s', to_char(current_date, 'YYYY'), nextval('public.manual_carriage_letter_number_seq'));
  elsif upper(v_letter_id) not like 'CARTA DE PORTE Nº%' then v_letter_id := 'CARTA DE PORTE Nº ' || v_letter_id; end if;

  insert into public.carriage_letters (
    id, service_date, default_route_template_id, sender_name, sender_nif, sender_email, sender_phone, sender_address, sender_postal_code, sender_city, sender_province,
    recipient_name, recipient_nif, recipient_email, recipient_phone, recipient_address, recipient_postal_code, recipient_city, recipient_province,
    origin_text, destination_text, origin_point, destination_point, accompanying_documents, billing_payer, billing_client, signed_at, signed_by, entry_source, imported_by
  ) select v_letter_id, route.service_date, v_template_id,
    btrim(p_sender ->> 'name'), coalesce(btrim(p_sender ->> 'nif'), ''), coalesce(btrim(p_sender ->> 'email'), ''), btrim(p_sender ->> 'phone'), coalesce(btrim(p_sender ->> 'address'), ''), coalesce(btrim(p_sender ->> 'postalCode'), ''), coalesce(btrim(p_sender ->> 'city'), ''), coalesce(btrim(p_sender ->> 'province'), ''),
    btrim(p_recipient ->> 'name'), coalesce(btrim(p_recipient ->> 'nif'), ''), coalesce(btrim(p_recipient ->> 'email'), ''), btrim(p_recipient ->> 'phone'), coalesce(btrim(p_recipient ->> 'address'), ''), coalesce(btrim(p_recipient ->> 'postalCode'), ''), coalesce(btrim(p_recipient ->> 'city'), ''), coalesce(btrim(p_recipient ->> 'province'), ''),
    btrim(p_origin_stop), btrim(p_destination_stop), coalesce(btrim(p_origin_point), ''), coalesce(btrim(p_destination_point), ''), coalesce(p_accompanying_documents, '{}'), p_billing_payer, p_billing_client, now(), auth.uid(), 'manual', auth.uid()
  from public.daily_routes route where route.id = p_daily_route_id;

  insert into public.animals (id, letter_id, ordinal, species, breed, birth_date, weight_kg, length_cm, height_cm, width_cm)
  select (animal.value ->> 'id')::uuid, v_letter_id, animal.ordinality::integer, btrim(animal.value ->> 'species'), coalesce(nullif(btrim(animal.value ->> 'breed'), ''), 'Sin clasificar'), nullif(btrim(animal.value ->> 'birth_date'), '')::date,
    (animal.value ->> 'weight_kg')::numeric, (animal.value ->> 'length_cm')::numeric, (animal.value ->> 'height_cm')::numeric, (animal.value ->> 'width_cm')::numeric
  from jsonb_array_elements(p_animals) with ordinality as animal(value, ordinality);

  if exists (select 1 from jsonb_array_elements(p_actions) action left join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid and stop.daily_route_id = p_daily_route_id where stop.id is null or (action.value ->> 'animal_id')::uuid not in (select (animal.value ->> 'id')::uuid from jsonb_array_elements(p_animals) animal) or action.value ->> 'type' not in ('recogida', 'entrega')) then
    raise exception 'Los servicios no corresponden a la ruta o a sus animales';
  end if;
  insert into public.route_actions (id, daily_route_id, daily_route_stop_id, letter_id, animal_id, action_type, status, dwell_minutes)
  select (action.value ->> 'id')::uuid, p_daily_route_id, (action.value ->> 'stop_id')::uuid, v_letter_id, (action.value ->> 'animal_id')::uuid, (action.value ->> 'type')::public.service_type, 'pendiente', 15 from jsonb_array_elements(p_actions) action;

  if p_box_number is not null then
    select (action.value ->> 'animal_id')::uuid, stop.sequence into v_first_animal_id, v_pickup_sequence from jsonb_array_elements(p_actions) action join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid where action.value ->> 'type' = 'recogida' order by stop.sequence limit 1;
    select stop.sequence into v_delivery_sequence from jsonb_array_elements(p_actions) action join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid where action.value ->> 'type' = 'entrega' order by stop.sequence limit 1;
    perform public.assign_van_box(p_daily_route_id, v_letter_id, v_first_animal_id, p_box_number, v_pickup_sequence, greatest(v_pickup_sequence + 1, v_delivery_sequence));
  end if;
  return v_letter_id;
end;
$$;