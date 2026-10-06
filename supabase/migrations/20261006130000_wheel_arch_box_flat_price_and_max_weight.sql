-- Wheel-arch box: single 150 EUR tariff (no heavy tariff) and a configurable maximum weight (40 kg).
update public.transport_box_catalog
set amount_cents = 15000, large_amount_cents = null, next_box_from_kg = 40, updated_at = now()
where category = 'paso_rueda';

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
  if p_category = 'grande' and p_weight_kg > 40 then
    return coalesce(catalog_row.large_amount_cents, catalog_row.amount_cents);
  end if;
  return catalog_row.amount_cents;
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
    if current_category in ('pequeno', 'mediano', 'paso_rueda') then
      if jsonb_typeof(item -> 'next_box_from_kg') <> 'number' then
        raise exception 'Indica el peso máximo del box (%)', current_category;
      end if;
      next_from_kg := (item ->> 'next_box_from_kg')::numeric;
      if next_from_kg <= 0 then raise exception 'El peso debe ser positivo'; end if;
    end if;
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
        or small.next_box_from_kg > medium.next_box_from_kg)
  ) then
    raise exception 'Cada box debe ser igual o mayor que el anterior en medidas y peso';
  end if;
end;
$$;

notify pgrst, 'reload schema';
