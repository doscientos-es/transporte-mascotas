-- WhatsApp delivery for confirmed transport requests. The queue is durable so
-- an unavailable provider never loses a confirmation or a route reminder.
alter table public.transport_request_notifications
  drop constraint if exists transport_request_notifications_kind_check,
  drop constraint if exists transport_request_notifications_status_check;

alter table public.transport_request_notifications
  add column if not exists scheduled_for timestamptz not null default now(),
  add column if not exists provider_message_id text,
  add column if not exists attempts integer not null default 0 check (attempts >= 0),
  add column if not exists processing_started_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add constraint transport_request_notifications_kind_check
    check (kind in ('confirmacion', 'rechazo', 'recordatorio_ruta')),
  add constraint transport_request_notifications_status_check
    check (status in ('pendiente', 'procesando', 'enviada', 'fallida'));

create index if not exists transport_request_notifications_due_idx
  on public.transport_request_notifications (scheduled_for, created_at)
  where status in ('pendiente', 'fallida');

drop trigger if exists transport_request_notifications_updated_at on public.transport_request_notifications;
create trigger transport_request_notifications_updated_at
before update on public.transport_request_notifications
for each row execute function public.set_updated_at();

create or replace function public.claim_transport_request_notifications(p_request_id uuid default null)
returns setof public.transport_request_notifications
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with candidates as (
    select notification.id
    from public.transport_request_notifications notification
    where notification.channel = 'whatsapp'
      and notification.scheduled_for <= now()
      and (p_request_id is null or notification.request_id = p_request_id)
      and (
        notification.status in ('pendiente', 'fallida')
        or (
          notification.status = 'procesando'
          and notification.processing_started_at < now() - interval '10 minutes'
        )
      )
    order by notification.scheduled_for, notification.created_at
    for update skip locked
  )
  update public.transport_request_notifications notification
  set status = 'procesando',
      attempts = notification.attempts + 1,
      processing_started_at = now(),
      error_message = null
  from candidates
  where notification.id = candidates.id
  returning notification.*;
end;
$$;

revoke all on function public.claim_transport_request_notifications(uuid) from public, anon, authenticated;

create or replace function public.confirm_transport_request(
  p_request_id uuid,
  p_daily_route_id uuid,
  p_pickup_stop_id uuid,
  p_delivery_stop_id uuid,
  p_admin_note text default ''
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  request public.transport_requests;
  pickup_sequence integer;
  delivery_sequence integer;
  new_letter_id text;
  largest_size public.animal_size;
  chosen_box integer;
  created_animal_id uuid;
  first_animal_id uuid;
  animal record;
begin
  if not public.is_admin() then raise exception 'Solo administración puede confirmar solicitudes'; end if;
  select * into request from public.transport_requests where id = p_request_id for update;
  if request.id is null then raise exception 'Solicitud no encontrada'; end if;
  if request.status <> 'por_verificar' then raise exception 'La solicitud no está pendiente de verificación'; end if;

  select sequence into pickup_sequence from public.daily_route_stops
  where id = p_pickup_stop_id and daily_route_id = p_daily_route_id;
  select sequence into delivery_sequence from public.daily_route_stops
  where id = p_delivery_stop_id and daily_route_id = p_daily_route_id;
  if pickup_sequence is null or delivery_sequence is null then raise exception 'Las paradas indicadas no pertenecen a la ruta'; end if;
  if delivery_sequence <= pickup_sequence then raise exception 'La entrega debe ir después de la recogida'; end if;

  new_letter_id = 'CARTA DE PORTE Nº ' || to_char(request.desired_date, 'YYYY') || '-P'
    || lpad(nextval('public.transport_request_letter_seq')::text, 5, '0');
  insert into public.carriage_letters (
    id, service_date, default_route_template_id, sender_name, sender_phone, sender_email,
    recipient_name, recipient_phone, recipient_email, origin_text, destination_text, entry_source, imported_by
  )
  select new_letter_id, request.desired_date, route.route_template_id,
         request.contact_name, request.contact_phone, request.contact_email,
         request.contact_name, request.contact_phone, request.contact_email,
         request.origin_text, request.destination_text, 'manual', auth.uid()
  from public.daily_routes route where route.id = p_daily_route_id;

  for animal in select * from public.transport_request_animals where request_id = p_request_id order by ordinal loop
    insert into public.animals (letter_id, ordinal, species, breed, size, size_source)
    values (new_letter_id, animal.ordinal, animal.species, animal.breed, animal.size, 'regla')
    returning id into created_animal_id;
    if first_animal_id is null then first_animal_id = created_animal_id; end if;
    if largest_size is null or animal.size = 'grande'
      or (animal.size = 'mediano' and largest_size = 'pequeno') then largest_size = animal.size; end if;
    insert into public.route_actions (daily_route_id, daily_route_stop_id, letter_id, animal_id, action_type)
    values (p_daily_route_id, p_pickup_stop_id, new_letter_id, created_animal_id, 'recogida'),
           (p_daily_route_id, p_delivery_stop_id, new_letter_id, created_animal_id, 'entrega');
  end loop;

  if first_animal_id is null then raise exception 'La solicitud no tiene animales'; end if;
  chosen_box = public.suggest_free_box(p_daily_route_id, largest_size, pickup_sequence, delivery_sequence);
  if chosen_box is null then raise exception 'No queda ningún box libre para este tramo'; end if;
  insert into public.van_assignments (daily_route_id, letter_id, animal_id, box_number, pickup_sequence, delivery_sequence)
  values (p_daily_route_id, new_letter_id, first_animal_id, chosen_box, pickup_sequence, delivery_sequence);

  update public.transport_requests
  set status = 'confirmada', letter_id = new_letter_id,
      daily_route_id = p_daily_route_id, admin_note = coalesce(p_admin_note, '')
  where id = p_request_id;

  insert into public.transport_request_notifications (request_id, kind, channel, recipient, scheduled_for)
  values
    (p_request_id, 'confirmacion', 'whatsapp', request.contact_phone, now()),
    (p_request_id, 'recordatorio_ruta', 'whatsapp', request.contact_phone,
      ((request.desired_date - 1)::timestamp + time '10:00') at time zone 'Europe/Madrid')
  on conflict (request_id, kind, channel) do nothing;

  insert into public.audit_logs (actor_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'transport_request_confirmed', 'transport_request', p_request_id::text);
  return new_letter_id;
end;
$$;

revoke all on function public.confirm_transport_request(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.confirm_transport_request(uuid, uuid, uuid, uuid, text) to authenticated;