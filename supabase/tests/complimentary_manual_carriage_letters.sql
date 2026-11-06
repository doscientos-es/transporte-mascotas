-- Run against a disposable database after migrations. All fixtures are rolled back.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated',
  'free-letter-test@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.profiles (id, display_name, role, active)
values ('00000000-0000-4000-8000-0000000000e1', 'Free letter test', 'admin', true)
on conflict (id) do update set role = 'admin', active = true;
insert into public.route_templates (id, name)
values ('10000000-0000-4000-8000-0000000000e1', 'Free letter test route');
insert into public.daily_routes (id, route_template_id, service_date)
values ('20000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', current_date);
insert into public.daily_route_stops (id, daily_route_id, sequence, locality) values
  ('30000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e1', 1, 'Origen'),
  ('30000000-0000-4000-8000-0000000000e2', '20000000-0000-4000-8000-0000000000e1', 2, 'Destino');

do $$
declare
  contact jsonb := '{"name":"Free test","nif":"TEST","email":"","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}';
  payer jsonb := '{"fullName":"Free test","nif":"TEST","email":"","phone":"600000000","address":"Test","postalCode":"00000","city":"Test"}';
  animal jsonb := '[{"id":"40000000-0000-4000-8000-0000000000e1","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1,"box_category":"pequeno"}]';
  actions jsonb := '[{"id":"50000000-0000-4000-8000-0000000000e1","animal_id":"40000000-0000-4000-8000-0000000000e1","stop_id":"30000000-0000-4000-8000-0000000000e1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000e2","animal_id":"40000000-0000-4000-8000-0000000000e1","stop_id":"30000000-0000-4000-8000-0000000000e2","type":"entrega"}]';
  free_id text;
  pending_id text;
  invoice_id uuid;
begin
  free_id := public.create_manual_carriage_letter(
    '20000000-0000-4000-8000-0000000000e1', 'FREE-TEST', contact, contact,
    'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente', payer,
    0, true, animal, actions, 13, null, true
  );
  if not exists (select 1 from public.carriage_letters where id = free_id and complimentary and signed_at is not null)
    or (select count(*) from public.route_actions where letter_id = free_id) <> 2
    or not exists (select 1 from public.van_assignments where letter_id = free_id and box_number = 13)
    or exists (select 1 from public.invoice_drafts where letter_id = free_id) then
    raise exception 'Free letter must be signed, assigned a box and have no payment request';
  end if;
  begin
    insert into public.invoice_drafts (letter_id, payer, client_snapshot, concept, net_amount, vat_rate, vat_amount, total_amount, status)
    values (free_id, 'remitente', payer, 'Test', 100, 21, 21, 121, 'solicitud_pago');
    raise exception 'A free letter accepted an invoice';
  exception when others then
    if sqlerrm <> 'Una carta sin factura no admite solicitudes de pago ni facturas' then raise; end if;
  end;
  begin
    update public.carriage_letters set complimentary = false where id = free_id;
    raise exception 'A free letter was silently reclassified';
  exception when others then
    if sqlerrm <> 'No se puede cambiar la condición de una carta sin factura' then raise; end if;
  end;

  -- A paid admin letter can also be issued without sender, recipient or payer emails.
  animal := jsonb_set(animal, '{0,id}', '"40000000-0000-4000-8000-0000000000e2"');
  actions := '[{"id":"50000000-0000-4000-8000-0000000000e3","animal_id":"40000000-0000-4000-8000-0000000000e2","stop_id":"30000000-0000-4000-8000-0000000000e1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000e4","animal_id":"40000000-0000-4000-8000-0000000000e2","stop_id":"30000000-0000-4000-8000-0000000000e2","type":"entrega"}]';
  invoice_id := (public.create_paid_manual_carriage_letter(
    '20000000-0000-4000-8000-0000000000e1', 'PAID-TEST', contact, contact,
    'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente', payer,
    121, true, animal, actions, 14, 'Transferencia',
    '{"name":"Test issuer","taxId":"TEST","address":"Test"}', null
  ) ->> 'invoiceDraftId')::uuid;
  if not exists (select 1 from public.issued_invoices where invoice_draft_id = invoice_id) then
    raise exception 'Paid letter did not issue an invoice';
  end if;

  animal := jsonb_set(animal, '{0,id}', '"40000000-0000-4000-8000-0000000000e3"');
  actions := '[{"id":"50000000-0000-4000-8000-0000000000e5","animal_id":"40000000-0000-4000-8000-0000000000e3","stop_id":"30000000-0000-4000-8000-0000000000e1","type":"recogida"},{"id":"50000000-0000-4000-8000-0000000000e6","animal_id":"40000000-0000-4000-8000-0000000000e3","stop_id":"30000000-0000-4000-8000-0000000000e2","type":"entrega"}]';
  pending_id := public.create_manual_carriage_letter(
    '20000000-0000-4000-8000-0000000000e1', 'PENDING-TEST', contact, contact,
    'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'manual', payer,
    121, true, animal, actions, 15, null
  );
  if not exists (
    select 1 from public.invoice_drafts where letter_id = pending_id and status = 'solicitud_pago'
      and client_snapshot ->> 'email' = ''
  ) then raise exception 'An admin letter without email did not create a payment request'; end if;

  update public.profiles set role = 'transportista' where id = auth.uid();
  begin
    perform public.create_manual_carriage_letter(
      '20000000-0000-4000-8000-0000000000e1', 'UNAUTHORIZED-TEST', contact, contact,
      'Origen', 'Destino', 'Origen', 'Destino', array['microchip'], 'remitente', payer,
      0, true, animal, actions, 13, null, true
    );
    raise exception 'A non-admin created a free letter';
  exception when others then
    if sqlerrm <> 'Solo administración puede crear cartas de porte' then raise; end if;
  end;
end;
$$;
rollback;