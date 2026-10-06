-- Box sizes (fit limits and the displayed dimensions) become editable from settings,
-- next to the prices. The recommendation now reads the limits from the catalogue.
alter table public.transport_box_catalog
  add column if not exists max_length_cm numeric check (max_length_cm is null or max_length_cm > 0),
  add column if not exists max_height_cm numeric check (max_height_cm is null or max_height_cm > 0),
  add column if not exists max_width_cm numeric check (max_width_cm is null or max_width_cm > 0);

update public.transport_box_catalog set max_length_cm = 33, max_height_cm = 29, max_width_cm = 46
  where category = 'pequeno' and max_length_cm is null;
update public.transport_box_catalog set max_length_cm = 50, max_height_cm = 50, max_width_cm = 52
  where category = 'mediano' and max_length_cm is null;
update public.transport_box_catalog set max_length_cm = 100, max_height_cm = 75, max_width_cm = 58
  where category = 'grande' and max_length_cm is null;

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
  if p_weight_kg >= 50 or p_length_cm > medium_box.max_length_cm
    or p_height_cm > medium_box.max_height_cm or p_width_cm > medium_box.max_width_cm then
    return 'grande';
  end if;
  if p_length_cm <= small_box.max_length_cm and p_height_cm <= small_box.max_height_cm
    and p_width_cm <= small_box.max_width_cm then
    return 'pequeno';
  end if;
  return 'mediano';
end;
$$;

-- Replaces the prices-only RPC: one payload per category with prices and sizes.
drop function if exists public.update_transport_box_catalog(jsonb);

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
    if current_category in ('grande', 'paso_rueda') then
      if jsonb_typeof(item -> 'large_amount_cents') <> 'number' then
        raise exception 'Introduce también la tarifa superior de %', current_category;
      end if;
      large_cents := (item ->> 'large_amount_cents')::integer;
      if large_cents <= 0 then raise exception 'Los importes deben ser positivos'; end if;
    end if;
    box_dimensions := btrim(coalesce(item ->> 'dimensions', ''));
    if box_dimensions = '' then raise exception 'Indica las dimensiones de cada box'; end if;
    max_length := null; max_height := null; max_width := null;
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
    update public.transport_box_catalog as catalog_row
    set amount_cents = regular_cents, large_amount_cents = large_cents,
      dimensions = box_dimensions, max_length_cm = max_length, max_height_cm = max_height,
      max_width_cm = max_width, updated_at = now()
    where catalog_row.category = current_category;
  end loop;
  -- Each box must be at least as large as the previous one on every axis.
  if exists (
    select 1
    from public.transport_box_catalog small, public.transport_box_catalog medium,
      public.transport_box_catalog large
    where small.category = 'pequeno' and medium.category = 'mediano' and large.category = 'grande'
      and (small.max_length_cm > medium.max_length_cm or medium.max_length_cm > large.max_length_cm
        or small.max_height_cm > medium.max_height_cm or medium.max_height_cm > large.max_height_cm
        or small.max_width_cm > medium.max_width_cm or medium.max_width_cm > large.max_width_cm)
  ) then
    raise exception 'Cada box debe ser igual o mayor que el anterior en todas sus medidas';
  end if;
end;
$$;

revoke all on function public.update_transport_box_catalog(jsonb) from public, anon;
grant execute on function public.update_transport_box_catalog(jsonb) to authenticated;

notify pgrst, 'reload schema';
