create or replace function public.assign_van_box(p_daily_route_id uuid, p_animal_id uuid, p_box_number integer, p_pickup_sequence integer, p_delivery_sequence integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare assignment_id uuid; animal_size public.animal_size;
begin
  if not public.is_admin() then raise exception 'Solo administración puede asignar boxes'; end if;
  select size into animal_size from public.animals where id = p_animal_id;
  if animal_size is null or not public.box_matches_animal_size(p_box_number, animal_size) then raise exception 'El box no corresponde al tamaño del animal'; end if;
  -- The delivery stop releases the box, so another animal may enter after that delivery.
  if exists (select 1 from public.van_assignments where daily_route_id = p_daily_route_id and box_number = p_box_number and int4range(pickup_sequence, delivery_sequence, '[)') && int4range(p_pickup_sequence, p_delivery_sequence, '[)')) then raise exception 'El box está ocupado en este tramo'; end if;
  insert into public.van_assignments(daily_route_id, animal_id, box_number, pickup_sequence, delivery_sequence) values (p_daily_route_id, p_animal_id, p_box_number, p_pickup_sequence, p_delivery_sequence) returning id into assignment_id;
  return assignment_id;
end;
$$;

revoke all on function public.assign_van_box(uuid, uuid, integer, integer, integer) from public, anon;
grant execute on function public.assign_van_box(uuid, uuid, integer, integer, integer) to authenticated;
