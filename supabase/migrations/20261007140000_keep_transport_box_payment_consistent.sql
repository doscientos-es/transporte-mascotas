-- Keep the amount charged in sync with the box category that will be assigned.
-- Once a payment is registered, the category and shared-box choice are immutable.
create or replace function public.validate_transport_request_payment_amount()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_received_amount text;
begin
  if new.amount_cents is distinct from old.amount_cents then
    if old.paid_at is not null then
      raise exception 'Una solicitud pagada no admite cambios de importe';
    end if;
    if new.status not in ('pago_pendiente', 'por_verificar') then
      raise exception 'La solicitud ya no admite cambios de importe';
    end if;
    if new.amount_cents <> public.transport_request_total_cents(new.id) then
      raise exception 'El importe de la solicitud no coincide con los boxes asignados';
    end if;
  end if;
  if new.paid_at is not null and (
    new.paid_at is distinct from old.paid_at
    or new.payment_gateway_response is distinct from old.payment_gateway_response
  ) then
    if not coalesce(new.payment_gateway_response ? 'amountCents', false) then
      raise exception 'El importe confirmado no coincide con el importe de la solicitud';
    end if;
    v_received_amount := new.payment_gateway_response ->> 'amountCents';
    if coalesce(v_received_amount, '') !~ '^[0-9]+$' then
      raise exception 'El importe confirmado no coincide con el importe de la solicitud';
    end if;
    if v_received_amount::numeric <> new.amount_cents then
      raise exception 'El importe confirmado no coincide con el importe de la solicitud';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_transport_request_payment_amount() from public, anon, authenticated;

drop trigger if exists transport_request_payment_amount_guard on public.transport_requests;
create trigger transport_request_payment_amount_guard
before update of amount_cents, paid_at, payment_gateway_response on public.transport_requests
for each row execute function public.validate_transport_request_payment_amount();

-- Retire the pre-Cyberpac client RPC, which could mark a request paid without
-- evidence of a successful payment or a verified amount.
revoke all on function public.confirm_transport_request_payment(uuid, text) from public, anon, authenticated;

create or replace function public.guard_transport_request_animal_box_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_request_ids uuid[];
  v_request record;
begin
  if tg_op = 'UPDATE' then
    if row(old.request_id, old.weight_kg, old.length_cm, old.height_cm, old.width_cm,
      old.minimum_box_category, old.requested_box_category, old.assigned_box_category, old.shared_box_group)
      is not distinct from row(new.request_id, new.weight_kg, new.length_cm, new.height_cm, new.width_cm,
        new.minimum_box_category, new.requested_box_category, new.assigned_box_category, new.shared_box_group)
    then return new; end if;
    v_request_ids := array[old.request_id, new.request_id];
  elsif tg_op = 'DELETE' then
    v_request_ids := array[old.request_id];
  else
    v_request_ids := array[new.request_id];
  end if;

  for v_request in
    select request.status, request.paid_at
    from public.transport_requests request
    where request.id = any(v_request_ids)
    order by request.id
    for update
  loop
    if v_request.status not in ('pago_pendiente', 'por_verificar') or v_request.paid_at is not null then
      raise exception 'La solicitud ya no admite cambios de box';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.guard_transport_request_animal_box_changes() from public, anon, authenticated;

drop trigger if exists transport_request_animals_paid_box_guard on public.transport_request_animals;
create trigger transport_request_animals_paid_box_guard
before insert or delete or update of request_id, weight_kg, length_cm, height_cm, width_cm,
  minimum_box_category, requested_box_category, assigned_box_category, shared_box_group
on public.transport_request_animals
for each row execute function public.guard_transport_request_animal_box_changes();

create or replace function public.reprice_transport_request_after_animal_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
begin
  if tg_op = 'DELETE' then
    v_request_id := old.request_id;
    update public.transport_requests request
    set amount_cents = public.transport_request_total_cents(v_request_id)
    where request.id = v_request_id;
    return old;
  end if;

  update public.transport_requests request
  set amount_cents = public.transport_request_total_cents(new.request_id)
  where request.id = new.request_id;
  if tg_op = 'UPDATE' and old.request_id is distinct from new.request_id then
    update public.transport_requests request
    set amount_cents = public.transport_request_total_cents(old.request_id)
    where request.id = old.request_id;
  end if;
  return new;
end;
$$;

revoke all on function public.reprice_transport_request_after_animal_change() from public, anon, authenticated;

drop trigger if exists transport_request_animals_reprice_request on public.transport_request_animals;
create trigger transport_request_animals_reprice_request
after insert or delete or update of request_id, weight_kg, length_cm, height_cm, width_cm,
  minimum_box_category, requested_box_category, assigned_box_category, shared_box_group
on public.transport_request_animals
for each row execute function public.reprice_transport_request_after_animal_change();

create or replace function public.update_transport_request_animal_box(
  p_animal_id uuid,
  p_category text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
  v_minimum_category text;
  v_request_status public.transport_request_status;
  v_paid_at timestamptz;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cambiar la caja'; end if;
  select animal.request_id, animal.minimum_box_category, request.status, request.paid_at
  into v_request_id, v_minimum_category, v_request_status, v_paid_at
  from public.transport_request_animals animal
  join public.transport_requests request on request.id = animal.request_id
  where animal.id = p_animal_id
  for update of request;
  if v_request_id is null then raise exception 'Animal no encontrado'; end if;
  if v_request_status not in ('pago_pendiente', 'por_verificar') or v_paid_at is not null then
    raise exception 'La solicitud ya no admite cambios de box';
  end if;
  if p_category is null or p_category not in ('pequeno', 'mediano', 'grande', 'paso_rueda') then
    raise exception 'Categoría de box no válida';
  end if;
  if p_category <> 'paso_rueda'
    and public.box_category_rank(p_category) < public.box_category_rank(v_minimum_category) then
    raise exception 'No se puede asignar una caja menor que la recomendada';
  end if;

  update public.transport_request_animals
  set assigned_box_category = p_category, box_assignment_source = 'admin'
  where id = p_animal_id;
  update public.transport_requests request
  set amount_cents = public.transport_request_total_cents(v_request_id)
  where request.id = v_request_id;
end;
$$;

revoke all on function public.update_transport_request_animal_box(uuid, text) from public, anon;
grant execute on function public.update_transport_request_animal_box(uuid, text) to authenticated;

create or replace function public.set_transport_request_animal_shared_box(
  p_animal_id uuid,
  p_partner_animal_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
  v_request_status public.transport_request_status;
  v_paid_at timestamptz;
  v_group uuid;
  v_best_category text;
begin
  if not public.is_admin() then raise exception 'Solo administración puede compartir boxes'; end if;
  select animal.request_id, request.status, request.paid_at
  into v_request_id, v_request_status, v_paid_at
  from public.transport_request_animals animal
  join public.transport_requests request on request.id = animal.request_id
  where animal.id = p_animal_id
  for update of request;
  if v_request_id is null then raise exception 'Animal no encontrado'; end if;
  if v_request_status not in ('por_verificar', 'pago_pendiente') or v_paid_at is not null then
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

  update public.transport_requests request
  set amount_cents = public.transport_request_total_cents(v_request_id)
  where request.id = v_request_id;
end;
$$;

revoke all on function public.set_transport_request_animal_shared_box(uuid, uuid) from public, anon;
grant execute on function public.set_transport_request_animal_shared_box(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';