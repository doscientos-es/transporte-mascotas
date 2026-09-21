-- Keep the payer and fiscal snapshot with the portal request so the CRM can
-- invoice the same customer after the administrator confirms the booking.
alter table public.transport_requests
  add column if not exists billing_payer public.payer_type not null default 'remitente',
  add column if not exists billing_client jsonb not null default '{}'::jsonb;

-- This overload preserves the existing RPC for already deployed clients while
-- allowing the portal to submit the fiscal data atomically with the booking.
create or replace function public.submit_transport_request(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb,
  p_billing_payer public.payer_type, p_billing_client jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
  v_billing_client jsonb;
begin
  if p_billing_payer not in ('remitente', 'destinatario', 'manual') then
    raise exception 'El pagador indicado no es válido';
  end if;
  if coalesce(jsonb_typeof(p_billing_client), '') <> 'object' then
    raise exception 'Los datos fiscales no son válidos';
  end if;
  if exists (
    select 1 from (values
      (p_billing_client ->> 'fullName'), (p_billing_client ->> 'nif'),
      (p_billing_client ->> 'email'), (p_billing_client ->> 'phone'),
      (p_billing_client ->> 'address'), (p_billing_client ->> 'city'),
      (p_billing_client ->> 'postalCode')
    ) as required(value) where nullif(btrim(value), '') is null
  ) then
    raise exception 'Completa todos los datos fiscales del pagador';
  end if;
  v_billing_client := jsonb_build_object(
    'fullName', btrim(p_billing_client ->> 'fullName'),
    'nif', btrim(p_billing_client ->> 'nif'),
    'email', btrim(p_billing_client ->> 'email'),
    'phone', btrim(p_billing_client ->> 'phone'),
    'address', btrim(p_billing_client ->> 'address'),
    'city', btrim(p_billing_client ->> 'city'),
    'postalCode', btrim(p_billing_client ->> 'postalCode')
  );
  v_request_id := public.submit_transport_request(
    p_contact_name, p_contact_phone, p_contact_email, p_daily_route_id,
    p_origin, p_destination, p_desired_date, p_notes, p_animals
  );
  update public.transport_requests
  set billing_payer = p_billing_payer, billing_client = v_billing_client
  where id = v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb) from public, anon;
grant execute on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb) to authenticated;

create or replace function public.confirm_transport_request(
  p_request_id uuid, p_daily_route_id uuid, p_pickup_stop_id uuid,
  p_delivery_stop_id uuid, p_admin_note text default ''
) returns text language plpgsql security definer set search_path = '' as $$
declare
  request public.transport_requests;
  selected_route public.daily_routes;
  pickup_sequence integer;
  delivery_sequence integer;
  new_letter_id text;
  largest_size public.animal_size;
  chosen_box integer;
  created_animal_id uuid;
  first_animal_id uuid;
  animal record;
  operational_category text;
  billing_client jsonb;
  client_id uuid;
  total_cents integer;
  net_cents integer;
begin
  if not public.is_admin() then raise exception 'Solo administración puede confirmar solicitudes'; end if;
  select * into request from public.transport_requests where id = p_request_id for update;
  if request.id is null then raise exception 'Solicitud no encontrada'; end if;
  if request.status <> 'por_verificar' then raise exception 'La solicitud no está pendiente de verificación'; end if;
  if coalesce(jsonb_typeof(request.billing_client), '') <> 'object' or exists (
    select 1 from (values
      (request.billing_client ->> 'fullName'), (request.billing_client ->> 'nif'),
      (request.billing_client ->> 'email'), (request.billing_client ->> 'phone'),
      (request.billing_client ->> 'address'), (request.billing_client ->> 'city'),
      (request.billing_client ->> 'postalCode')
    ) as required(value) where nullif(btrim(value), '') is null
  ) then raise exception 'La solicitud no tiene completos los datos fiscales del pagador'; end if;
  select * into selected_route from public.daily_routes route
  where route.id = p_daily_route_id and route.id = request.daily_route_id
    and route.service_date = request.desired_date and route.status = 'activa' for update;
  if selected_route.id is null then raise exception 'La salida elegida ya no está activa o no coincide con la solicitud'; end if;
  select sequence into pickup_sequence from public.daily_route_stops where id = p_pickup_stop_id and daily_route_id = p_daily_route_id;
  select sequence into delivery_sequence from public.daily_route_stops where id = p_delivery_stop_id and daily_route_id = p_daily_route_id;
  if pickup_sequence is null or delivery_sequence is null then raise exception 'Las paradas indicadas no pertenecen a la ruta'; end if;
  if delivery_sequence <= pickup_sequence then raise exception 'La entrega debe ir después de la recogida'; end if;

  billing_client := jsonb_build_object(
    'fullName', btrim(request.billing_client ->> 'fullName'), 'nif', btrim(request.billing_client ->> 'nif'),
    'email', btrim(request.billing_client ->> 'email'), 'phone', btrim(request.billing_client ->> 'phone'),
    'address', btrim(request.billing_client ->> 'address'), 'city', btrim(request.billing_client ->> 'city'),
    'postalCode', btrim(request.billing_client ->> 'postalCode')
  );
  new_letter_id := 'CARTA DE PORTE Nº ' || to_char(request.desired_date, 'YYYY') || '-P' || lpad(nextval('public.transport_request_letter_seq')::text, 5, '0');
  insert into public.carriage_letters (
    id, service_date, status, default_route_template_id, sender_name, sender_phone, sender_email,
    recipient_name, recipient_phone, recipient_email, origin_text, destination_text,
    billing_payer, billing_client, entry_source, imported_by
  ) values (
    new_letter_id, request.desired_date, 'programada', selected_route.route_template_id,
    request.contact_name, request.contact_phone, request.contact_email,
    request.contact_name, request.contact_phone, request.contact_email, request.origin_text,
    request.destination_text, request.billing_payer, billing_client, 'portal', auth.uid()
  );
  for animal in select * from public.transport_request_animals where request_id = p_request_id order by ordinal loop
    operational_category := coalesce(animal.assigned_box_category, animal.requested_box_category, animal.minimum_box_category);
    if operational_category = 'paso_rueda' then operational_category := 'grande'; end if;
    insert into public.animals (letter_id, ordinal, species, breed, size, size_source, box_category)
    values (new_letter_id, animal.ordinal, animal.species, animal.breed, operational_category::public.animal_size, 'regla', coalesce(animal.assigned_box_category, animal.requested_box_category, animal.minimum_box_category)) returning id into created_animal_id;
    if first_animal_id is null then first_animal_id = created_animal_id; end if;
    if largest_size is null or public.box_category_rank(operational_category) > public.box_category_rank(largest_size::text) then largest_size = operational_category::public.animal_size; end if;
    insert into public.route_actions (daily_route_id, daily_route_stop_id, letter_id, animal_id, action_type)
    values (p_daily_route_id, p_pickup_stop_id, new_letter_id, created_animal_id, 'recogida'), (p_daily_route_id, p_delivery_stop_id, new_letter_id, created_animal_id, 'entrega');
  end loop;
  if first_animal_id is null then raise exception 'La solicitud no tiene animales'; end if;
  chosen_box := public.suggest_free_box(p_daily_route_id, largest_size, pickup_sequence, delivery_sequence);
  if chosen_box is null then raise exception 'No queda ningún box libre para este tramo'; end if;
  insert into public.van_assignments (daily_route_id, letter_id, animal_id, box_number, pickup_sequence, delivery_sequence)
  values (p_daily_route_id, new_letter_id, first_animal_id, chosen_box, pickup_sequence, delivery_sequence);

  insert into public.clients (full_name, nif, email, phone, address, city, postal_code)
  values (billing_client ->> 'fullName', billing_client ->> 'nif', billing_client ->> 'email', billing_client ->> 'phone', billing_client ->> 'address', billing_client ->> 'city', billing_client ->> 'postalCode')
  on conflict (normalized_name) do update set nif = excluded.nif, email = excluded.email, phone = excluded.phone, address = excluded.address, city = excluded.city, postal_code = excluded.postal_code
  returning id into client_id;
  total_cents := request.amount_cents;
  net_cents := round(total_cents / 1.21)::integer;
  insert into public.invoice_drafts (letter_id, client_id, payer, client_snapshot, concept, net_amount, vat_amount, total_amount, vat_rate, status, delivery_channel, delivery_email, delivery_phone, created_by)
  values (new_letter_id, client_id, request.billing_payer, billing_client, 'Servicio de transporte de mascota', net_cents / 100.0, (total_cents - net_cents) / 100.0, total_cents / 100.0, 21, 'solicitud_pago', 'manual', '', '', auth.uid());
  update public.transport_requests set status = 'confirmada', letter_id = new_letter_id, daily_route_id = p_daily_route_id, admin_note = coalesce(p_admin_note, '') where id = p_request_id;
  insert into public.audit_logs (actor_id, event_type, entity_type, entity_id) values (auth.uid(), 'transport_request_confirmed', 'transport_request', p_request_id::text);
  return new_letter_id;
end;
$$;

revoke all on function public.confirm_transport_request(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.confirm_transport_request(uuid, uuid, uuid, uuid, text) to authenticated;
notify pgrst, 'reload schema';