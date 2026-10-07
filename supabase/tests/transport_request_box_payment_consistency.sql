-- Run with a database-administrator connection. All fixtures and tariff changes roll back.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000d1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated',
  'box-payment-test@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.profiles (id, display_name, role, active)
values ('00000000-0000-4000-8000-0000000000d1', 'Box payment test', 'admin', true)
on conflict (id) do update set role = 'admin', active = true;

update public.transport_box_catalog set amount_cents = 10000 where category = 'pequeno';
update public.transport_box_catalog set amount_cents = 12000 where category = 'mediano';

insert into public.transport_requests (
  id, requester_id, contact_name, contact_phone, contact_email, origin_text, destination_text,
  desired_date, amount_cents
) values (
  '10000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d1',
  'Box payment test', '600000000', 'box-payment-test@example.invalid', 'Origen', 'Destino',
  current_date, 22000
);
insert into public.transport_request_animals (
  id, request_id, ordinal, name, species, breed, weight_kg, length_cm, height_cm, width_cm,
  size, requested_box_category, assigned_box_category
) values
  ('20000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-0000000000d1',
   1, 'Prueba uno', 'perro', 'mestizo', 1, 20, 20, 20, 'pequeno', 'mediano', 'mediano'),
  ('20000000-0000-4000-8000-0000000000d2', '10000000-0000-4000-8000-0000000000d1',
   2, 'Prueba dos', 'perro', 'mestizo', 1, 20, 20, 20, 'pequeno', 'pequeno', 'pequeno');

do $$
declare v_amount integer; v_group uuid;
begin
  update public.transport_request_animals set assigned_box_category = 'pequeno'
  where id = '20000000-0000-4000-8000-0000000000d1';
  select amount_cents into v_amount from public.transport_requests
  where id = '10000000-0000-4000-8000-0000000000d1';
  if v_amount <> 20000 then
    raise exception 'A direct box change before payment must reprice the request to 20000 cents; got %', v_amount;
  end if;
  perform public.update_transport_request_animal_box(
    '20000000-0000-4000-8000-0000000000d1', 'mediano');
  select amount_cents into v_amount from public.transport_requests
  where id = '10000000-0000-4000-8000-0000000000d1';
  if v_amount <> 22000 then
    raise exception 'Changing a box through the admin RPC must reprice the request to 22000 cents';
  end if;
  perform public.update_transport_request_animal_box(
    '20000000-0000-4000-8000-0000000000d1', 'pequeno');
  select amount_cents into v_amount from public.transport_requests
  where id = '10000000-0000-4000-8000-0000000000d1';
  if v_amount <> 20000 then
    raise exception 'The admin RPC must reprice the request when a box becomes small';
  end if;

  perform public.set_transport_request_animal_shared_box(
    '20000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000d2');
  select amount_cents into v_amount from public.transport_requests
  where id = '10000000-0000-4000-8000-0000000000d1';
  select shared_box_group into v_group from public.transport_request_animals
  where id = '20000000-0000-4000-8000-0000000000d1';
  if v_amount <> 10000 or v_group is null then
    raise exception 'Sharing one small box must recalculate the request to 10000 cents';
  end if;

  begin
    update public.transport_requests
    set status = 'por_verificar', paid_at = now(),
        payment_gateway_response = '{"amountCents":"12000"}'::jsonb
    where id = '10000000-0000-4000-8000-0000000000d1';
    raise exception 'A payment for the old amount was accepted after the box price changed';
  exception when others then
    if sqlerrm <> 'El importe confirmado no coincide con el importe de la solicitud' then raise; end if;
  end;
  if exists (
    select 1 from public.transport_requests
    where id = '10000000-0000-4000-8000-0000000000d1' and paid_at is not null
  ) then raise exception 'A mismatched payment marked the request as paid'; end if;
  begin
    update public.transport_requests
    set status = 'por_verificar', paid_at = now(), payment_gateway_response = '{}'::jsonb
    where id = '10000000-0000-4000-8000-0000000000d1';
    raise exception 'A payment confirmation without a gateway amount was accepted';
  exception when others then
    if sqlerrm <> 'El importe confirmado no coincide con el importe de la solicitud' then raise; end if;
  end;
  if has_function_privilege(
    'authenticated', 'public.confirm_transport_request_payment(uuid,text)', 'EXECUTE'
  ) then raise exception 'The obsolete client payment-confirmation RPC is still executable'; end if;

  update public.transport_requests
  set status = 'por_verificar', paid_at = now(),
      payment_gateway_response = '{"amountCents":"10000"}'::jsonb
  where id = '10000000-0000-4000-8000-0000000000d1';
  begin
    perform public.update_transport_request_animal_box(
      '20000000-0000-4000-8000-0000000000d1', 'mediano');
    raise exception 'A paid request allowed its box category to change';
  exception when others then
    if sqlerrm <> 'La solicitud ya no admite cambios de box' then raise; end if;
  end;
  begin
    perform public.set_transport_request_animal_shared_box(
      '20000000-0000-4000-8000-0000000000d1', null);
    raise exception 'A paid request allowed its shared box to change';
  exception when others then
    if sqlerrm <> 'La solicitud ya no admite cambios de box' then raise; end if;
  end;
  begin
    update public.transport_requests set amount_cents = 12000
    where id = '10000000-0000-4000-8000-0000000000d1';
    raise exception 'A paid request allowed its amount to change';
  exception when others then
    if sqlerrm <> 'Una solicitud pagada no admite cambios de importe' then raise; end if;
  end;
  begin
    update public.transport_request_animals set assigned_box_category = 'mediano'
    where id = '20000000-0000-4000-8000-0000000000d1';
    raise exception 'A direct update allowed a paid request box to change';
  exception when others then
    if sqlerrm <> 'La solicitud ya no admite cambios de box' then raise; end if;
  end;
  if not exists (
    select 1 from public.transport_request_animals
    where id = '20000000-0000-4000-8000-0000000000d1'
      and assigned_box_category = 'pequeno' and shared_box_group = v_group
  ) then raise exception 'A rejected paid-request edit changed the assigned box'; end if;
end;
$$;

rollback;