-- Weight-based tariffs: pequeño up to 2.5 kg (100 €), mediano up to 13 kg (120 €),
-- grande / paso de rueda up to 40 kg (150 €) and 180 € above 40 kg.
-- next_box_from_kg now stores the maximum weight (inclusive) the box admits.
update public.transport_box_catalog set next_box_from_kg = 2.5 where category = 'pequeno';
update public.transport_box_catalog set next_box_from_kg = 13 where category = 'mediano';
update public.transport_box_catalog
set amount_cents = 15000, large_amount_cents = 18000,
    dimensions = replace(dimensions, 'desde 50 kg', 'a partir de 40 kg'),
    updated_at = now()
where category = 'grande';
update public.transport_box_catalog
set amount_cents = 15000, large_amount_cents = 18000, updated_at = now()
where category = 'paso_rueda';

create or replace function public.box_category_for_measurements(
  p_weight_kg numeric,
  p_length_cm numeric,
  p_height_cm numeric,
  p_width_cm numeric
)
returns text language plpgsql stable set search_path = '' as $$
declare
  small_box public.transport_box_catalog;
  medium_box public.transport_box_catalog;
  large_box public.transport_box_catalog;
begin
  select * into small_box from public.transport_box_catalog where category = 'pequeno';
  select * into medium_box from public.transport_box_catalog where category = 'mediano';
  select * into large_box from public.transport_box_catalog where category = 'grande';
  if p_length_cm > large_box.max_length_cm or p_height_cm > large_box.max_height_cm
    or p_width_cm > large_box.max_width_cm then
    raise exception 'Las medidas superan el box grande disponible';
  end if;
  if p_length_cm > medium_box.max_length_cm or p_height_cm > medium_box.max_height_cm
    or p_width_cm > medium_box.max_width_cm or p_weight_kg > medium_box.next_box_from_kg then
    return 'grande';
  end if;
  if p_length_cm <= small_box.max_length_cm and p_height_cm <= small_box.max_height_cm
    and p_width_cm <= small_box.max_width_cm and p_weight_kg <= small_box.next_box_from_kg then
    return 'pequeno';
  end if;
  return 'mediano';
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
  if p_category in ('grande', 'paso_rueda') and p_weight_kg > 40 then
    return coalesce(catalog_row.large_amount_cents, catalog_row.amount_cents);
  end if;
  return catalog_row.amount_cents;
end;
$$;

-- The wheel-arch box now admits up to 40 kg.
create or replace function public.submit_transport_request(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb,
  p_billing_payer public.payer_type, p_billing_client jsonb,
  p_sender_nif text, p_recipient_name text, p_recipient_nif text,
  p_recipient_phone text, p_recipient_email text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
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
  if exists (
    select 1 from jsonb_array_elements(p_animals) as animal
    where animal ->> 'requested_box_category' = 'paso_rueda'
      and coalesce((animal ->> 'weight_kg')::numeric, 0) > 40
  ) then
    raise exception 'El box de paso de rueda admite como máximo 40 kg';
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

notify pgrst, 'reload schema';
