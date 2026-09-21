-- Avoid the ambiguous category reference in the catalog pricing RPC.
create or replace function public.update_transport_box_catalog(p_prices jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_category text;
  regular_cents integer;
  large_cents integer;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cambiar las tarifas'; end if;
  if jsonb_typeof(p_prices) <> 'object' then raise exception 'Las tarifas no son válidas'; end if;
  foreach current_category in array array['pequeno', 'mediano', 'grande', 'paso_rueda'] loop
    if jsonb_typeof(p_prices -> current_category) <> 'number' then
      raise exception 'Introduce un importe válido para cada categoría';
    end if;
    regular_cents := (p_prices ->> current_category)::integer;
    if regular_cents <= 0 then raise exception 'Los importes deben ser positivos'; end if;
    large_cents := null;
    if current_category in ('grande', 'paso_rueda') then
      if jsonb_typeof(p_prices -> (current_category || '_grande')) <> 'number' then
        raise exception 'Introduce también la tarifa superior de %', current_category;
      end if;
      large_cents := (p_prices ->> (current_category || '_grande'))::integer;
      if large_cents <= 0 then raise exception 'Los importes deben ser positivos'; end if;
    end if;
    update public.transport_box_catalog as catalog_row
    set amount_cents = regular_cents, large_amount_cents = large_cents, updated_at = now()
    where catalog_row.category = current_category;
  end loop;
end;
$$;

revoke all on function public.update_transport_box_catalog(jsonb) from public, anon;
grant execute on function public.update_transport_box_catalog(jsonb) to authenticated;