-- A carriage letter occupies one box, even when it contains several animals.
alter table public.van_assignments
  add column if not exists letter_id text references public.carriage_letters(id) on delete cascade;

update public.van_assignments assignment
set letter_id = animal.letter_id
from public.animals animal
where animal.id = assignment.animal_id
  and assignment.letter_id is null;

alter table public.van_assignments
  alter column letter_id set not null;

create index if not exists van_assignments_route_letter_idx
  on public.van_assignments (daily_route_id, letter_id);

create or replace function public.assign_van_box(
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
  if exists (
    select 1 from public.van_assignments assignment
    where assignment.daily_route_id = p_daily_route_id
      and assignment.box_number = p_box_number
      and assignment.letter_id <> p_letter_id
      and int4range(assignment.pickup_sequence, assignment.delivery_sequence, '[]') && int4range(p_pickup_sequence, p_delivery_sequence, '[]')
  ) then raise exception 'El box está ocupado en este tramo'; end if;
  delete from public.van_assignments where daily_route_id = p_daily_route_id and letter_id = p_letter_id;
  insert into public.van_assignments(daily_route_id, letter_id, animal_id, box_number, pickup_sequence, delivery_sequence)
  values (p_daily_route_id, p_letter_id, p_animal_id, p_box_number, p_pickup_sequence, p_delivery_sequence)
  returning id into assignment_id;
  return assignment_id;
end;
$$;

revoke all on function public.assign_van_box(uuid, text, uuid, integer, integer, integer) from public;
grant execute on function public.assign_van_box(uuid, text, uuid, integer, integer, integer) to authenticated;

create or replace view public.transporter_route_actions as
  select action.id,
         action.daily_route_id,
         action.daily_route_stop_id,
         action.letter_id,
         action.animal_id,
         action.action_type,
         action.status,
         action.dwell_minutes,
         case when action.action_type = 'recogida' then letter.sender_name else letter.recipient_name end as customer_name,
         case when action.action_type = 'recogida' then letter.sender_phone else letter.recipient_phone end as customer_phone,
         animal.breed as animal_breed,
         animal.species as animal_species,
         assignment.box_number
  from public.route_actions action
  join public.daily_routes route on route.id = action.daily_route_id
  join public.carriage_letters letter on letter.id = action.letter_id
  join public.animals animal on animal.id = action.animal_id
  left join lateral (
    select candidate.box_number
    from public.van_assignments candidate
    where candidate.daily_route_id = action.daily_route_id
      and candidate.letter_id = action.letter_id
    order by candidate.created_at desc
    limit 1
  ) assignment on true
  where public.is_admin() or route.transporter_id = auth.uid();

revoke all on public.transporter_route_actions from public, anon;
grant select on public.transporter_route_actions to authenticated;