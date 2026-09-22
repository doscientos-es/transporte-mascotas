-- The self-service transport flow issues its invoice from the payment webhook.
-- Mark the transaction as an invoice-payment confirmation before changing the
-- draft status so the invoice integrity trigger allows the transition.
create or replace function public.auto_finalize_paid_transport(
  p_request_id uuid,
  p_paid_at timestamptz,
  p_gateway_response jsonb,
  p_issuer_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.transport_requests;
  route public.daily_routes;
  pickup public.daily_route_stops;
  delivery public.daily_route_stops;
  new_letter_id text;
  client_id uuid;
  invoice_id uuid;
  issued_id uuid;
  first_animal_id uuid;
  created_animal_id uuid;
  largest_size public.animal_size;
  operational_category text;
  chosen_box integer;
  next_number integer;
  issued_year integer := extract(year from p_paid_at at time zone 'Europe/Madrid');
  billing_client jsonb;
  total_cents integer;
  net_cents integer;
  animal record;
begin
  select * into request from public.transport_requests where id = p_request_id for update;
  if request.id is null then raise exception 'Solicitud no encontrada'; end if;
  if request.status = 'confirmada' or request.status = 'en_ruta' or request.status = 'entregada' then
    select id into issued_id from public.issued_invoices where invoice_draft_id in (
      select id from public.invoice_drafts where letter_id = request.letter_id
    );
    return issued_id;
  end if;
  if request.status <> 'por_verificar' then raise exception 'La solicitud no está pagada'; end if;
  if coalesce(jsonb_typeof(request.billing_client), '') <> 'object' then
    raise exception 'La solicitud no tiene datos fiscales';
  end if;

  select * into route from public.daily_routes
  where id = request.daily_route_id and service_date = request.desired_date and status = 'activa'
  for update;
  if route.id is null then raise exception 'La salida elegida ya no está disponible'; end if;

  select * into pickup from public.daily_route_stops
  where daily_route_id = route.id and locality = request.origin_text
  order by sequence limit 1;
  select * into delivery from public.daily_route_stops
  where daily_route_id = route.id and locality = request.destination_text
    and sequence > coalesce(pickup.sequence, 0)
  order by sequence limit 1;
  if pickup.id is null or delivery.id is null then
    raise exception 'El trayecto elegido ya no está disponible';
  end if;

  billing_client := jsonb_build_object(
    'fullName', btrim(request.billing_client ->> 'fullName'),
    'nif', btrim(request.billing_client ->> 'nif'),
    'email', btrim(request.billing_client ->> 'email'),
    'phone', btrim(request.billing_client ->> 'phone'),
    'address', btrim(request.billing_client ->> 'address'),
    'city', btrim(request.billing_client ->> 'city'),
    'postalCode', btrim(request.billing_client ->> 'postalCode')
  );
  if exists (select 1 from jsonb_each_text(billing_client) where nullif(btrim(value), '') is null) then
    raise exception 'Faltan datos fiscales del pagador';
  end if;

  new_letter_id := 'CARTA DE PORTE Nº ' || to_char(request.desired_date, 'YYYY') || '-P' ||
    lpad(nextval('public.transport_request_letter_seq')::text, 5, '0');
  insert into public.carriage_letters (
    id, service_date, status, default_route_template_id, sender_name, sender_phone, sender_email,
    recipient_name, recipient_phone, recipient_email, origin_text, destination_text,
    billing_payer, billing_client, entry_source, imported_by
  ) values (
    new_letter_id, request.desired_date, 'programada', route.route_template_id,
    request.contact_name, request.contact_phone, request.contact_email,
    request.contact_name, request.contact_phone, request.contact_email,
    request.origin_text, request.destination_text, request.billing_payer, billing_client,
    'portal', request.requester_id
  );

  for animal in select * from public.transport_request_animals where request_id = request.id order by ordinal loop
    operational_category := coalesce(animal.assigned_box_category, animal.requested_box_category, animal.minimum_box_category);
    if operational_category = 'paso_rueda' then operational_category := 'grande'; end if;
    insert into public.animals (letter_id, ordinal, species, breed, size, size_source, box_category)
    values (new_letter_id, animal.ordinal, animal.species, animal.breed, operational_category::public.animal_size, 'regla', operational_category)
    returning id into created_animal_id;
    if first_animal_id is null then first_animal_id := created_animal_id; end if;
    if largest_size is null or public.box_category_rank(operational_category) > public.box_category_rank(largest_size::text) then
      largest_size := operational_category::public.animal_size;
    end if;
    insert into public.route_actions (daily_route_id, daily_route_stop_id, letter_id, animal_id, action_type)
    values (route.id, pickup.id, new_letter_id, created_animal_id, 'recogida'),
      (route.id, delivery.id, new_letter_id, created_animal_id, 'entrega');
  end loop;
  if first_animal_id is null then raise exception 'La solicitud no tiene animales'; end if;
  chosen_box := public.suggest_free_box(route.id, largest_size, pickup.sequence, delivery.sequence);
  if chosen_box is null then raise exception 'No queda ningún box libre para este trayecto'; end if;
  insert into public.van_assignments (daily_route_id, letter_id, animal_id, box_number, pickup_sequence, delivery_sequence)
  values (route.id, new_letter_id, first_animal_id, chosen_box, pickup.sequence, delivery.sequence);

  insert into public.clients (full_name, nif, email, phone, address, city, postal_code)
  values (billing_client ->> 'fullName', billing_client ->> 'nif', billing_client ->> 'email', billing_client ->> 'phone', billing_client ->> 'address', billing_client ->> 'city', billing_client ->> 'postalCode')
  on conflict (normalized_name) do update set nif = excluded.nif, email = excluded.email, phone = excluded.phone, address = excluded.address, city = excluded.city, postal_code = excluded.postal_code
  returning id into client_id;
  total_cents := request.amount_cents;
  net_cents := round(total_cents / 1.21)::integer;
  insert into public.invoice_drafts (letter_id, client_id, payer, client_snapshot, concept, net_amount, vat_amount, total_amount, vat_rate, status, delivery_channel, delivery_email, delivery_phone, created_by)
  values (new_letter_id, client_id, request.billing_payer, billing_client, 'Servicio de transporte de mascota', net_cents / 100.0, (total_cents - net_cents) / 100.0, total_cents / 100.0, 21, 'solicitud_pago', 'manual', '', '', request.requester_id)
  returning id into invoice_id;

  insert into public.invoice_series_counters(series, fiscal_year, last_number)
  values ('F', issued_year, 1)
  on conflict (series, fiscal_year) do update set last_number = public.invoice_series_counters.last_number + 1
  returning last_number into next_number;
  insert into public.issued_invoices(invoice_draft_id, fiscal_year, sequence_number, issued_at, fiscal_snapshot)
  values (invoice_id, issued_year, next_number, p_paid_at, jsonb_build_object(
    'issuer', p_issuer_snapshot, 'number', concat('F-', issued_year::text, '-', lpad(next_number::text, 6, '0')),
    'client', billing_client, 'concept', 'Servicio de transporte de mascota',
    'net_amount', net_cents / 100.0, 'vat_rate', 21, 'vat_amount', (total_cents - net_cents) / 100.0,
    'total_amount', total_cents / 100.0, 'payment_method', 'Tarjeta', 'payment_date', p_paid_at,
    'gateway_response', p_gateway_response
  )) returning id into issued_id;
  perform set_config('app.confirming_invoice_payment', 'true', true);
  update public.invoice_drafts set status = 'emitida' where id = invoice_id;
  update public.transport_requests set status = 'confirmada', letter_id = new_letter_id, paid_at = p_paid_at,
    payment_reference = coalesce(payment_reference, ''), payment_gateway_response = p_gateway_response
  where id = request.id;
  return issued_id;
end;
$$;

revoke all on function public.auto_finalize_paid_transport(uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.auto_finalize_paid_transport(uuid, timestamptz, jsonb, jsonb) to service_role;