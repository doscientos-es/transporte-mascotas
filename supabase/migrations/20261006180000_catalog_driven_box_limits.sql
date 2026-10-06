-- Weight limits come from Ajustes (transport_box_catalog), never from constants in SQL.
-- grande.next_box_from_kg = weight above which the large tariff applies (was hardcoded 40).
-- paso_rueda.next_box_from_kg = heaviest pet the wheel-arch box admits (was hardcoded 40).
update public.transport_box_catalog
set next_box_from_kg = 40, updated_at = now()
where category = 'grande' and next_box_from_kg is null;

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
  if p_category = 'grande' and catalog_row.large_amount_cents is not null
    and p_weight_kg > coalesce(catalog_row.next_box_from_kg, p_weight_kg) then
    return catalog_row.large_amount_cents;
  end if;
  return catalog_row.amount_cents;
end;
$$;

create or replace function public.submit_transport_request(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb,
  p_billing_payer public.payer_type, p_billing_client jsonb,
  p_sender_nif text, p_recipient_name text, p_recipient_nif text,
  p_recipient_phone text, p_recipient_email text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
  v_wheel_arch_max_kg numeric;
begin
  if coalesce(btrim(p_sender_nif), '') = '' or coalesce(btrim(p_recipient_name), '') = ''
    or coalesce(btrim(p_recipient_nif), '') = '' or coalesce(btrim(p_recipient_phone), '') = '' then
    raise exception 'Completa el DNI, nombre y teléfono de quien envía y de quien recibe';
  end if;
  if coalesce(btrim(p_recipient_email), '') <> ''
    and btrim(p_recipient_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'El correo de quien recibe no es válido';
  end if;
  if coalesce(jsonb_typeof(p_animals), '') <> 'array' or exists (
    select 1 from jsonb_array_elements(p_animals) as animal
    where nullif(btrim(animal ->> 'breed'), '') is null
  ) then
    raise exception 'Indica la raza de cada mascota';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) as animal
    where case
      when coalesce(animal ->> 'birth_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        then (animal ->> 'birth_date')::date > current_date
      else true
    end
  ) then
    raise exception 'Indica una fecha de nacimiento válida para cada mascota';
  end if;
  select next_box_from_kg into v_wheel_arch_max_kg
  from public.transport_box_catalog where category = 'paso_rueda';
  if v_wheel_arch_max_kg is not null and exists (
    select 1 from jsonb_array_elements(p_animals) as animal
    where animal ->> 'requested_box_category' = 'paso_rueda'
      and coalesce((animal ->> 'weight_kg')::numeric, 0) > v_wheel_arch_max_kg
  ) then
    raise exception 'El box de paso de rueda admite como máximo % kg', v_wheel_arch_max_kg;
  end if;

  v_request_id := public.submit_transport_request(
    p_contact_name, p_contact_phone, p_contact_email, p_daily_route_id,
    p_origin, p_destination, p_desired_date, p_notes, p_animals,
    p_billing_payer, p_billing_client
  );
  update public.transport_requests
  set sender_nif = btrim(p_sender_nif),
      recipient_name = btrim(p_recipient_name),
      recipient_nif = btrim(p_recipient_nif),
      recipient_phone = btrim(p_recipient_phone),
      recipient_email = coalesce(btrim(p_recipient_email), '')
  where id = v_request_id;
  update public.transport_request_animals request_animal
  set birth_date = (animal.value ->> 'birth_date')::date
  from jsonb_array_elements(p_animals) with ordinality as animal(value, ordinality)
  where request_animal.request_id = v_request_id
    and request_animal.ordinal = animal.ordinality::integer;
  return v_request_id;
end;
$$;

create or replace function public.update_transport_box_catalog(p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_category text;
  item jsonb;
  regular_cents integer;
  large_cents integer;
  max_length numeric;
  max_height numeric;
  max_width numeric;
  next_from_kg numeric;
  box_dimensions text;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cambiar el catálogo'; end if;
  if jsonb_typeof(p_items) <> 'object' then raise exception 'El catálogo no es válido'; end if;
  foreach current_category in array array['pequeno', 'mediano', 'grande', 'paso_rueda'] loop
    item := p_items -> current_category;
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Faltan los datos de la categoría %', current_category;
    end if;
    if jsonb_typeof(item -> 'amount_cents') <> 'number' then
      raise exception 'Introduce un importe válido para cada categoría';
    end if;
    regular_cents := (item ->> 'amount_cents')::integer;
    if regular_cents <= 0 then raise exception 'Los importes deben ser positivos'; end if;
    large_cents := null;
    if current_category = 'grande' then
      if jsonb_typeof(item -> 'large_amount_cents') <> 'number' then
        raise exception 'Introduce también la tarifa superior de %', current_category;
      end if;
      large_cents := (item ->> 'large_amount_cents')::integer;
      if large_cents <= 0 then raise exception 'Los importes deben ser positivos'; end if;
    end if;
    box_dimensions := btrim(coalesce(item ->> 'dimensions', ''));
    if box_dimensions = '' then raise exception 'Indica las dimensiones de cada box'; end if;
    max_length := null; max_height := null; max_width := null; next_from_kg := null;
    if current_category <> 'paso_rueda' then
      if jsonb_typeof(item -> 'max_length_cm') <> 'number'
        or jsonb_typeof(item -> 'max_height_cm') <> 'number'
        or jsonb_typeof(item -> 'max_width_cm') <> 'number' then
        raise exception 'Indica las medidas máximas de %', current_category;
      end if;
      max_length := (item ->> 'max_length_cm')::numeric;
      max_height := (item ->> 'max_height_cm')::numeric;
      max_width := (item ->> 'max_width_cm')::numeric;
      if max_length <= 0 or max_height <= 0 or max_width <= 0 then
        raise exception 'Las medidas deben ser positivas';
      end if;
    end if;
    -- Every box carries a weight: its maximum, or (grande) where the large tariff starts.
    if jsonb_typeof(item -> 'next_box_from_kg') <> 'number' then
      raise exception 'Indica el peso del box (%)', current_category;
    end if;
    next_from_kg := (item ->> 'next_box_from_kg')::numeric;
    if next_from_kg <= 0 then raise exception 'El peso debe ser positivo'; end if;
    update public.transport_box_catalog as catalog_row
    set amount_cents = regular_cents, large_amount_cents = large_cents,
      dimensions = box_dimensions, max_length_cm = max_length, max_height_cm = max_height,
      max_width_cm = max_width, next_box_from_kg = next_from_kg, updated_at = now()
    where catalog_row.category = current_category;
  end loop;
  if exists (
    select 1
    from public.transport_box_catalog small, public.transport_box_catalog medium,
      public.transport_box_catalog large
    where small.category = 'pequeno' and medium.category = 'mediano' and large.category = 'grande'
      and (small.max_length_cm > medium.max_length_cm or medium.max_length_cm > large.max_length_cm
        or small.max_height_cm > medium.max_height_cm or medium.max_height_cm > large.max_height_cm
        or small.max_width_cm > medium.max_width_cm or medium.max_width_cm > large.max_width_cm
        or small.next_box_from_kg > medium.next_box_from_kg
        or medium.next_box_from_kg > large.next_box_from_kg)
  ) then
    raise exception 'Cada box debe ser igual o mayor que el anterior en medidas y peso';
  end if;
end;
$$;

notify pgrst, 'reload schema';
