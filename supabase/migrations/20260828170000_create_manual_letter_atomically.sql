create sequence if not exists public.manual_carriage_letter_number_seq;

select setval(
  'public.manual_carriage_letter_number_seq',
  coalesce((
    select max((regexp_match(id, '([0-9]+)$'))[1]::bigint)
    from public.carriage_letters
    where id ~ '[0-9]+$'
  ), 1),
  exists (select 1 from public.carriage_letters where id ~ '[0-9]+$')
);

create or replace function public.create_manual_carriage_letter(
  p_daily_route_id uuid,
  p_reference text,
  p_sender_name text,
  p_sender_phone text,
  p_recipient_name text,
  p_recipient_phone text,
  p_origin text,
  p_destination text,
  p_animals jsonb,
  p_actions jsonb,
  p_box_number integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_letter_id text;
  v_template_id uuid;
  v_pickup_sequence integer;
  v_delivery_sequence integer;
  v_first_animal_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede crear cartas de porte';
  end if;

  select route.route_template_id into v_template_id
  from public.daily_routes route
  where route.id = p_daily_route_id;
  if v_template_id is null then
    raise exception 'La ruta diaria no existe o no tiene plantilla';
  end if;
  if jsonb_typeof(p_animals) <> 'array' or jsonb_array_length(p_animals) = 0 then
    raise exception 'La carta debe incluir al menos un animal';
  end if;
  if jsonb_typeof(p_actions) <> 'array'
     or jsonb_array_length(p_actions) <> jsonb_array_length(p_animals) * 2 then
    raise exception 'La carta debe incluir una recogida y una entrega por animal';
  end if;

  v_letter_id := nullif(btrim(p_reference), '');
  if v_letter_id is null then
    v_letter_id := format('CARTA DE PORTE Nº %s-%s', to_char(current_date, 'YYYY'), nextval('public.manual_carriage_letter_number_seq'));
  elsif upper(v_letter_id) not like 'CARTA DE PORTE Nº%' then
    v_letter_id := 'CARTA DE PORTE Nº ' || v_letter_id;
  end if;

  insert into public.carriage_letters (
    id, service_date, default_route_template_id, sender_name, sender_phone,
    recipient_name, recipient_phone, origin_text, destination_text, entry_source, imported_by
  )
  select v_letter_id, route.service_date, v_template_id, btrim(p_sender_name), btrim(p_sender_phone),
         btrim(p_recipient_name), btrim(p_recipient_phone), btrim(p_origin), btrim(p_destination),
         'manual', auth.uid()
  from public.daily_routes route
  where route.id = p_daily_route_id;

  insert into public.animals (id, letter_id, ordinal, species, breed, size, size_source)
  select (animal.value ->> 'id')::uuid,
         v_letter_id,
         animal.ordinality::integer,
         btrim(animal.value ->> 'species'),
         coalesce(nullif(btrim(animal.value ->> 'breed'), ''), 'Sin clasificar'),
         (animal.value ->> 'size')::public.animal_size,
         case when coalesce(nullif(btrim(animal.value ->> 'breed'), ''), 'Sin clasificar') = 'Sin clasificar' then 'manual' else 'regla' end
  from jsonb_array_elements(p_animals) with ordinality as animal(value, ordinality);

  if exists (
    select 1
    from jsonb_array_elements(p_actions) action
    left join public.daily_route_stops stop
      on stop.id = (action.value ->> 'stop_id')::uuid
     and stop.daily_route_id = p_daily_route_id
    where stop.id is null
       or (action.value ->> 'animal_id')::uuid not in (
         select (animal.value ->> 'id')::uuid from jsonb_array_elements(p_animals) animal
       )
       or action.value ->> 'type' not in ('recogida', 'entrega')
  ) then
    raise exception 'Los servicios no corresponden a la ruta o a sus animales';
  end if;

  insert into public.route_actions (
    id, daily_route_id, daily_route_stop_id, letter_id, animal_id, action_type, status, dwell_minutes
  )
  select (action.value ->> 'id')::uuid,
         p_daily_route_id,
         (action.value ->> 'stop_id')::uuid,
         v_letter_id,
         (action.value ->> 'animal_id')::uuid,
         (action.value ->> 'type')::public.service_type,
         'pendiente',
         15
  from jsonb_array_elements(p_actions) action;

  if p_box_number is not null then
    select (action.value ->> 'animal_id')::uuid, stop.sequence
      into v_first_animal_id, v_pickup_sequence
    from jsonb_array_elements(p_actions) action
    join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid
    where action.value ->> 'type' = 'recogida'
    order by stop.sequence
    limit 1;
    select stop.sequence into v_delivery_sequence
    from jsonb_array_elements(p_actions) action
    join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid
    where action.value ->> 'type' = 'entrega'
    order by stop.sequence
    limit 1;
    perform public.assign_van_box(
      p_daily_route_id, v_letter_id, v_first_animal_id, p_box_number,
      v_pickup_sequence, greatest(v_pickup_sequence + 1, v_delivery_sequence)
    );
  end if;

  return v_letter_id;
end;
$$;

revoke all on function public.create_manual_carriage_letter(uuid, text, text, text, text, text, text, text, jsonb, jsonb, integer) from public, anon;
grant execute on function public.create_manual_carriage_letter(uuid, text, text, text, text, text, text, text, jsonb, jsonb, integer) to authenticated;
