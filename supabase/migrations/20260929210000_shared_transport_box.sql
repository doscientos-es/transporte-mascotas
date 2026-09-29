-- Several pets of one request can travel in the same box. The box is charged once,
-- at the rate of the most expensive box in the group.
alter table public.transport_request_animals
  add column if not exists shared_box_group uuid;

create index if not exists transport_request_animals_shared_box_group_idx
  on public.transport_request_animals (request_id, shared_box_group)
  where shared_box_group is not null;

create or replace function public.transport_request_total_cents(p_request_id uuid)
returns integer language sql stable set search_path = '' as $$
  with priced as (
    select animal.shared_box_group,
      public.transport_box_price_cents(
        coalesce(animal.assigned_box_category, animal.requested_box_category),
        animal.minimum_box_category,
        animal.weight_kg
      ) as price
    from public.transport_request_animals animal
    where animal.request_id = p_request_id
  )
  select (
    coalesce((select sum(price) from priced where shared_box_group is null), 0)
    + coalesce((
      select sum(group_price) from (
        select max(price) as group_price from priced
        where shared_box_group is not null group by shared_box_group
      ) grouped
    ), 0)
  )::integer;
$$;

revoke all on function public.transport_request_total_cents(uuid) from public, anon;
grant execute on function public.transport_request_total_cents(uuid) to authenticated;

-- Puts an animal in the same box as another animal of its request, or takes it out of
-- its shared box when p_partner_animal_id is null.
create or replace function public.set_transport_request_animal_shared_box(
  p_animal_id uuid,
  p_partner_animal_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
  v_status public.transport_request_status;
  v_paid_at timestamptz;
  v_group uuid;
  v_old_group uuid;
  v_best_category text;
begin
  if not public.is_admin() then raise exception 'Solo administración puede compartir boxes'; end if;
  select animal.request_id, animal.shared_box_group, request.status, request.paid_at
  into v_request_id, v_old_group, v_status, v_paid_at
  from public.transport_request_animals animal
  join public.transport_requests request on request.id = animal.request_id
  where animal.id = p_animal_id
  for update of request;
  if v_request_id is null then raise exception 'Animal no encontrado'; end if;
  if v_status not in ('por_verificar', 'pago_pendiente') then
    raise exception 'La solicitud ya no admite cambios de box';
  end if;

  if p_partner_animal_id is null then
    update public.transport_request_animals set shared_box_group = null where id = p_animal_id;
  else
    if p_partner_animal_id = p_animal_id then raise exception 'Elige otra mascota'; end if;
    select partner.shared_box_group into v_group
    from public.transport_request_animals partner
    where partner.id = p_partner_animal_id and partner.request_id = v_request_id;
    if not found then raise exception 'La otra mascota no pertenece a la solicitud'; end if;
    if v_group is null then
      v_group := gen_random_uuid();
      update public.transport_request_animals set shared_box_group = v_group
      where id = p_partner_animal_id;
    end if;
    update public.transport_request_animals set shared_box_group = v_group where id = p_animal_id;

    -- Every pet in the group travels in the biggest box any of them needs.
    select coalesce(animal.assigned_box_category, animal.requested_box_category)
    into v_best_category
    from public.transport_request_animals animal
    where animal.shared_box_group = v_group
    order by public.box_category_rank(coalesce(animal.assigned_box_category, animal.requested_box_category)) desc,
      public.transport_box_price_cents(
        coalesce(animal.assigned_box_category, animal.requested_box_category),
        animal.minimum_box_category, animal.weight_kg) desc
    limit 1;
    update public.transport_request_animals
    set assigned_box_category = v_best_category, box_assignment_source = 'admin'
    where shared_box_group = v_group;
  end if;

  -- A group left with a single pet is no longer shared.
  update public.transport_request_animals animal set shared_box_group = null
  where animal.request_id = v_request_id and animal.shared_box_group is not null
    and (select count(*) from public.transport_request_animals other
         where other.request_id = v_request_id
           and other.shared_box_group = animal.shared_box_group) = 1;

  -- Already paid requests keep the amount that was charged.
  if v_paid_at is null then
    update public.transport_requests
    set amount_cents = public.transport_request_total_cents(v_request_id)
    where id = v_request_id;
  end if;
end;
$$;

revoke all on function public.set_transport_request_animal_shared_box(uuid, uuid) from public, anon;
grant execute on function public.set_transport_request_animal_shared_box(uuid, uuid) to authenticated;
