-- Administration may manually put several carriage letters (pets) in the same van box.
-- Same checks as assign_van_box (admin only, box fits every pet of the letter) but
-- without the "box occupied in this stretch" rule.
create or replace function public.assign_shared_van_box(
  p_daily_route_id uuid,
  p_letter_id text,
  p_animal_id uuid,
  p_box_number integer,
  p_pickup_sequence integer,
  p_delivery_sequence integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare assignment_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo administración puede asignar boxes'; end if;
  if not exists (select 1 from public.animals where id = p_animal_id and letter_id = p_letter_id) then
    raise exception 'El animal no pertenece a la carta indicada';
  end if;
  if exists (
    select 1 from public.animals animal
    where animal.letter_id = p_letter_id
      and not (
        p_box_number in (1, 2, 3, 4, 37, 38, 39, 40)
        or (animal.size <> 'grande' and (p_box_number between 5 and 12 or p_box_number between 41 and 48))
        or (animal.size = 'pequeno' and (p_box_number between 13 and 36 or p_box_number between 49 and 72))
      )
  ) then raise exception 'El box no es adecuado para todos los animales de la carta'; end if;
  delete from public.van_assignments where daily_route_id = p_daily_route_id and letter_id = p_letter_id;
  insert into public.van_assignments(daily_route_id, letter_id, animal_id, box_number, pickup_sequence, delivery_sequence)
  values (p_daily_route_id, p_letter_id, p_animal_id, p_box_number, p_pickup_sequence, p_delivery_sequence)
  returning id into assignment_id;
  return assignment_id;
end;
$$;

revoke all on function public.assign_shared_van_box(uuid, text, uuid, integer, integer, integer) from public, anon;
grant execute on function public.assign_shared_van_box(uuid, text, uuid, integer, integer, integer) to authenticated;
