-- Customer WhatsApp is disabled for every operational flow. The explicit
-- WhatsApp test page remains available, but business operations must not queue
-- or dispatch messages.

alter table public.daily_route_closure_notifications
  drop constraint if exists daily_route_closure_notifications_status_check;

alter table public.daily_route_closure_notifications
  add constraint daily_route_closure_notifications_status_check
  check (status in ('pendiente', 'procesando', 'enviada', 'fallida', 'cancelada'));

update public.transport_request_notifications
set status = 'cancelada',
    error_message = 'WhatsApp transaccional desactivado',
    processing_started_at = null
where status in ('pendiente', 'procesando', 'fallida');

update public.carriage_letter_notifications
set status = 'cancelada',
    error_message = 'WhatsApp transaccional desactivado',
    processing_started_at = null
where status in ('pendiente', 'procesando', 'fallida');

update public.daily_route_closure_notifications
set status = 'cancelada',
    error_message = 'WhatsApp transaccional desactivado',
    processing_started_at = null
where status in ('pendiente', 'procesando', 'fallida');

-- Do not enqueue notifications when manual letters are inserted or updated.
create or replace function public.queue_carriage_letter_whatsapp_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

-- Route closure remains an atomic operational lock, without creating a message
-- queue as a side effect.
create or replace function public.close_daily_route(p_daily_route_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route public.daily_routes;
  v_closed_at timestamptz;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cerrar rutas'; end if;

  select * into v_route from public.daily_routes where id = p_daily_route_id for update;
  if v_route.id is null then raise exception 'No se ha encontrado la ruta'; end if;
  if v_route.closed_at is not null then
    return jsonb_build_object('closedAt', v_route.closed_at, 'notificationsQueued', 0);
  end if;
  if v_route.service_date <> ((now() at time zone 'Europe/Madrid')::date + 1) then
    raise exception 'La ruta solo se puede cerrar el día anterior a su realización';
  end if;
  if v_route.status in ('completada', 'cancelada') then
    raise exception 'No se puede cerrar una ruta completada o cancelada';
  end if;

  update public.daily_routes
  set closed_at = now(), closed_by = auth.uid()
  where id = p_daily_route_id
  returning closed_at into v_closed_at;

  insert into public.audit_logs (actor_id, event_type, entity_type, entity_id, data)
  values (
    auth.uid(),
    'daily_route_closed',
    'daily_route',
    p_daily_route_id::text,
    jsonb_build_object('notifications_queued', 0)
  );
  return jsonb_build_object('closedAt', v_closed_at, 'notificationsQueued', 0);
end;
$$;

-- Workers must not be able to reclaim historical or accidentally-created rows.
create or replace function public.claim_transport_request_notifications(p_request_id uuid default null)
returns setof public.transport_request_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;

create or replace function public.claim_carriage_letter_notifications(p_letter_id text default null)
returns setof public.carriage_letter_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;

create or replace function public.claim_billing_notifications(
  p_invoice_draft_id uuid default null,
  p_kind text default null
)
returns setof public.billing_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;

create or replace function public.claim_daily_route_closure_notifications(
  p_daily_route_id uuid default null
)
returns setof public.daily_route_closure_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;

-- The older manual-letter RPC must remain compatible with the manual-only
-- invoice delivery constraint introduced above.
create or replace function public.create_manual_carriage_letter(
  p_daily_route_id uuid, p_reference text, p_sender jsonb, p_recipient jsonb,
  p_origin_stop text, p_destination_stop text, p_origin_point text, p_destination_point text,
  p_accompanying_documents text[], p_billing_payer public.payer_type,
  p_billing_client jsonb, p_billing_total numeric, p_signature_confirmed boolean,
  p_animals jsonb, p_actions jsonb, p_box_number integer
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_letter_id text;
  v_template_id uuid;
  v_client_id uuid;
  v_pickup_sequence integer;
  v_delivery_sequence integer;
  v_first_animal_id uuid;
  v_total_cents integer;
  v_net_cents integer;
  v_billing_client jsonb;
begin
  if not public.is_admin() then raise exception 'Solo administración puede crear cartas de porte'; end if;
  if not p_signature_confirmed then raise exception 'Debes confirmar que firmas la carta de porte'; end if;
  if jsonb_typeof(p_sender) <> 'object' or jsonb_typeof(p_recipient) <> 'object' or jsonb_typeof(p_billing_client) <> 'object' then
    raise exception 'Los datos de contacto no son válidos';
  end if;
  if exists (
    select 1 from (values
      (p_sender ->> 'name'), (p_sender ->> 'nif'), (p_sender ->> 'email'), (p_sender ->> 'phone'), (p_sender ->> 'address'), (p_sender ->> 'postalCode'), (p_sender ->> 'city'),
      (p_recipient ->> 'name'), (p_recipient ->> 'nif'), (p_recipient ->> 'email'), (p_recipient ->> 'phone'), (p_recipient ->> 'address'), (p_recipient ->> 'postalCode'), (p_recipient ->> 'city'),
      (p_origin_stop), (p_destination_stop), (p_origin_point), (p_destination_point)
    ) as required(value) where nullif(btrim(value), '') is null
  ) then raise exception 'Completa los datos obligatorios de la carta'; end if;
  if exists (
    select 1 from (values
      (p_billing_client ->> 'fullName'), (p_billing_client ->> 'nif'), (p_billing_client ->> 'email'), (p_billing_client ->> 'phone'), (p_billing_client ->> 'address'), (p_billing_client ->> 'postalCode'), (p_billing_client ->> 'city')
    ) as required(value) where nullif(btrim(value), '') is null
  ) then raise exception 'Completa los datos fiscales del pagador'; end if;
  if p_billing_total is null or p_billing_total <= 0 or round(p_billing_total * 100) <> p_billing_total * 100 then
    raise exception 'El importe debe ser positivo y tener como máximo dos decimales';
  end if;
  if coalesce(cardinality(p_accompanying_documents), 0) = 0 then raise exception 'Selecciona al menos un documento que acompañe al animal'; end if;
  if exists (select 1 from unnest(coalesce(p_accompanying_documents, '{}')) document where document not in ('cartilla_sanitaria', 'microchip', 'pasaporte', 'tatuaje', 'anillo', 'cites', 'otro')) then
    raise exception 'La documentación indicada no es válida';
  end if;

  select route.route_template_id into v_template_id from public.daily_routes route where route.id = p_daily_route_id;
  if v_template_id is null then raise exception 'La ruta diaria no existe o no tiene plantilla'; end if;
  if jsonb_typeof(p_animals) <> 'array' or jsonb_array_length(p_animals) = 0 then raise exception 'La carta debe incluir al menos un animal'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) animal
    where nullif(btrim(animal.value ->> 'species'), '') is null
      or coalesce((animal.value ->> 'weight_kg')::numeric, 0) <= 0
      or coalesce((animal.value ->> 'length_cm')::numeric, 0) <= 0
      or coalesce((animal.value ->> 'height_cm')::numeric, 0) <= 0
      or coalesce((animal.value ->> 'width_cm')::numeric, 0) <= 0
  ) then raise exception 'Indica especie, peso y medidas para cada animal'; end if;
  if jsonb_typeof(p_actions) <> 'array' or jsonb_array_length(p_actions) <> jsonb_array_length(p_animals) * 2 then raise exception 'La carta debe incluir una recogida y una entrega por animal'; end if;

  v_letter_id := nullif(btrim(p_reference), '');
  if v_letter_id is null then v_letter_id := format('CARTA DE PORTE Nº %s-%s', to_char(current_date, 'YYYY'), nextval('public.manual_carriage_letter_number_seq'));
  elsif upper(v_letter_id) not like 'CARTA DE PORTE Nº%' then v_letter_id := 'CARTA DE PORTE Nº ' || v_letter_id; end if;

  insert into public.carriage_letters (
    id, service_date, default_route_template_id, sender_name, sender_nif, sender_email, sender_phone, sender_address, sender_postal_code, sender_city, sender_province,
    recipient_name, recipient_nif, recipient_email, recipient_phone, recipient_address, recipient_postal_code, recipient_city, recipient_province,
    origin_text, destination_text, origin_point, destination_point, accompanying_documents, billing_payer, billing_client, signed_at, signed_by, entry_source, imported_by
  ) select v_letter_id, route.service_date, v_template_id,
    btrim(p_sender ->> 'name'), btrim(p_sender ->> 'nif'), btrim(p_sender ->> 'email'), btrim(p_sender ->> 'phone'), btrim(p_sender ->> 'address'), btrim(p_sender ->> 'postalCode'), btrim(p_sender ->> 'city'), coalesce(btrim(p_sender ->> 'province'), ''),
    btrim(p_recipient ->> 'name'), btrim(p_recipient ->> 'nif'), btrim(p_recipient ->> 'email'), btrim(p_recipient ->> 'phone'), btrim(p_recipient ->> 'address'), btrim(p_recipient ->> 'postalCode'), btrim(p_recipient ->> 'city'), coalesce(btrim(p_recipient ->> 'province'), ''),
    btrim(p_origin_stop), btrim(p_destination_stop), btrim(p_origin_point), btrim(p_destination_point), coalesce(p_accompanying_documents, '{}'), p_billing_payer, p_billing_client, now(), auth.uid(), 'manual', auth.uid()
  from public.daily_routes route where route.id = p_daily_route_id;

  v_billing_client := jsonb_build_object(
    'fullName', btrim(p_billing_client ->> 'fullName'), 'nif', btrim(p_billing_client ->> 'nif'),
    'email', btrim(p_billing_client ->> 'email'), 'phone', btrim(p_billing_client ->> 'phone'),
    'address', btrim(p_billing_client ->> 'address'), 'city', btrim(p_billing_client ->> 'city'),
    'postalCode', btrim(p_billing_client ->> 'postalCode')
  );
  insert into public.clients (full_name, nif, email, phone, address, city, postal_code)
  values (v_billing_client ->> 'fullName', v_billing_client ->> 'nif', v_billing_client ->> 'email', v_billing_client ->> 'phone', v_billing_client ->> 'address', v_billing_client ->> 'city', v_billing_client ->> 'postalCode')
  on conflict (normalized_name) do update set
    nif = excluded.nif, email = excluded.email, phone = excluded.phone, address = excluded.address,
    city = excluded.city, postal_code = excluded.postal_code
  returning id into v_client_id;

  v_total_cents := round(p_billing_total * 100)::integer;
  v_net_cents := round(v_total_cents / 1.21)::integer;
  insert into public.invoice_drafts (
    letter_id, client_id, payer, client_snapshot, concept, net_amount, vat_rate, vat_amount,
    total_amount, status, delivery_channel, delivery_email, delivery_phone, created_by
  ) values (
    v_letter_id, v_client_id, p_billing_payer, v_billing_client, 'Servicio de transporte de mascota',
    v_net_cents / 100.0, 21, (v_total_cents - v_net_cents) / 100.0, v_total_cents / 100.0,
    'solicitud_pago', 'manual', '', '', auth.uid()
  );

  insert into public.animals (id, letter_id, ordinal, species, breed, birth_date, weight_kg, length_cm, height_cm, width_cm)
  select (animal.value ->> 'id')::uuid, v_letter_id, animal.ordinality::integer, btrim(animal.value ->> 'species'), coalesce(nullif(btrim(animal.value ->> 'breed'), ''), 'Sin clasificar'), nullif(btrim(animal.value ->> 'birth_date'), '')::date,
    (animal.value ->> 'weight_kg')::numeric, (animal.value ->> 'length_cm')::numeric, (animal.value ->> 'height_cm')::numeric, (animal.value ->> 'width_cm')::numeric
  from jsonb_array_elements(p_animals) with ordinality as animal(value, ordinality);

  if exists (select 1 from jsonb_array_elements(p_actions) action left join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid and stop.daily_route_id = p_daily_route_id where stop.id is null or (action.value ->> 'animal_id')::uuid not in (select (animal.value ->> 'id')::uuid from jsonb_array_elements(p_animals) animal) or action.value ->> 'type' not in ('recogida', 'entrega')) then
    raise exception 'Los servicios no corresponden a la ruta o a sus animales';
  end if;
  insert into public.route_actions (id, daily_route_id, daily_route_stop_id, letter_id, animal_id, action_type, status, dwell_minutes)
  select (action.value ->> 'id')::uuid, p_daily_route_id, (action.value ->> 'stop_id')::uuid, v_letter_id, (action.value ->> 'animal_id')::uuid, (action.value ->> 'type')::public.service_type, 'pendiente', 15 from jsonb_array_elements(p_actions) action;

  if p_box_number is not null then
    select (action.value ->> 'animal_id')::uuid, stop.sequence into v_first_animal_id, v_pickup_sequence from jsonb_array_elements(p_actions) action join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid where action.value ->> 'type' = 'recogida' order by stop.sequence limit 1;
    select stop.sequence into v_delivery_sequence from jsonb_array_elements(p_actions) action join public.daily_route_stops stop on stop.id = (action.value ->> 'stop_id')::uuid where action.value ->> 'type' = 'entrega' order by stop.sequence limit 1;
    perform public.assign_van_box(p_daily_route_id, v_letter_id, v_first_animal_id, p_box_number, v_pickup_sequence, greatest(v_pickup_sequence + 1, v_delivery_sequence));
  end if;
  return v_letter_id;
end;
$$;

notify pgrst, 'reload schema';