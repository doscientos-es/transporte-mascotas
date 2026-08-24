-- Operational layer for public bookings, manual payment confirmation and delivery outbox.
create type public.reservation_status as enum ('pending_review', 'pending_payment', 'confirmed', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'waived', 'refunded');
create type public.delivery_channel as enum ('email', 'whatsapp');
create type public.delivery_status as enum ('pending', 'sent', 'failed');
create type public.invoice_status as enum ('draft', 'issued', 'void', 'paid');
alter type public.payer_type add value if not exists 'third_party';
alter type public.invoice_draft_status add value if not exists 'pagado';

alter table public.carriage_letters
  add column if not exists sender_weight_kg numeric(6,2),
  add column if not exists recipient_weight_kg numeric(6,2),
  add column if not exists reservation_id uuid,
  add column if not exists box_number integer check (box_number between 1 and 72),
  add column if not exists document_path text;

alter table public.animals
  add column if not exists weight_kg numeric(6,2),
  add column if not exists microchip text not null default '',
  add column if not exists requested_category public.animal_size,
  add column if not exists recommended_category public.animal_size;

alter table public.daily_routes
  add column if not exists published boolean not null default false,
  add column if not exists starts_at timestamptz,
  add column if not exists reversed boolean not null default false;

alter table public.daily_route_stops
  add column if not exists active boolean not null default true,
  add column if not exists dwell_minutes integer not null default 15 check (dwell_minutes >= 0),
  add column if not exists eta timestamptz;

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  category public.animal_size not null unique,
  min_weight_kg numeric(6,2) not null default 0 check (min_weight_kg >= 0),
  max_weight_kg numeric(6,2),
  amount numeric(12,2) not null check (amount >= 0),
  dimensions_text text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (max_weight_kg is null or max_weight_kg >= min_weight_kg)
);

insert into public.pricing_rules (category, min_weight_kg, max_weight_kg, amount, dimensions_text)
values ('pequeno', 0, 2.5, 100, 'Consultar medidas del box'), ('mediano', 0, 14, 120, 'Consultar medidas del box'), ('grande', 0, null, 180, 'Consultar medidas del box')
on conflict (category) do nothing;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique default ('R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  daily_route_id uuid not null references public.daily_routes(id) on delete restrict,
  letter_id text unique references public.carriage_letters(id) on delete set null,
  status public.reservation_status not null default 'pending_review',
  payment_status public.payment_status not null default 'pending',
  sender jsonb not null,
  recipient jsonb not null,
  animal jsonb not null,
  origin_stop_id uuid references public.daily_route_stops(id) on delete set null,
  destination_stop_id uuid references public.daily_route_stops(id) on delete set null,
  requested_category public.animal_size not null,
  recommended_category public.animal_size not null,
  quoted_amount numeric(12,2) not null check (quoted_amount >= 0),
  notes text not null default '',
  confirmed_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_deliveries (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) on delete cascade,
  letter_id text references public.carriage_letters(id) on delete cascade,
  invoice_id uuid references public.invoice_drafts(id) on delete cascade,
  channel public.delivery_channel not null,
  recipient text not null,
  document_kind text not null check (document_kind in ('carriage_letter', 'invoice', 'route_sheet')),
  status public.delivery_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoice_drafts add column if not exists invoice_number text unique, add column if not exists payment_status public.payment_status not null default 'pending', add column if not exists delivery_status public.delivery_status not null default 'pending', add column if not exists document_path text;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id, name, public) values ('operational-documents', 'operational-documents', false) on conflict (id) do nothing;
  end if;
end;
$$;

create index reservations_route_status_idx on public.reservations(daily_route_id, status, payment_status);
create index deliveries_pending_idx on public.document_deliveries(status, created_at) where status in ('pending', 'failed');
create sequence public.carriage_letter_sequence start with 1;
create sequence public.invoice_number_sequence start with 1;

create trigger reservations_updated_at before update on public.reservations for each row execute function public.set_updated_at();
create trigger document_deliveries_updated_at before update on public.document_deliveries for each row execute function public.set_updated_at();

create function public.is_operator() returns boolean language sql stable set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and active and role in ('admin', 'transportista'));
$$;

create or replace function public.record_route_action(p_action_id uuid, p_status public.service_action_status, p_incident_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare target_route public.daily_routes;
begin
  if not public.is_operator() then raise exception 'Solo el personal operativo puede actualizar una ruta'; end if;
  select r.* into target_route from public.route_actions a join public.daily_routes r on r.id = a.daily_route_id where a.id = p_action_id;
  if target_route.id is null or target_route.status <> 'activa' then raise exception 'Acción no disponible'; end if;
  update public.route_actions set status = p_status, incident_note = coalesce(p_incident_note, ''), completed_at = case when p_status = 'completada' then now() else null end, completed_by = auth.uid() where id = p_action_id;
  insert into public.audit_logs(actor_id, event_type, entity_type, entity_id) values (auth.uid(), 'route_action_updated', 'route_action', p_action_id::text);
end;
$$;

create function public.submit_public_reservation(p_daily_route_id uuid, p_sender jsonb, p_recipient jsonb, p_animal jsonb, p_origin_stop_id uuid, p_destination_stop_id uuid, p_requested_category public.animal_size, p_recommended_category public.animal_size, p_quoted_amount numeric, p_notes text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_amount numeric;
begin
  if not exists (select 1 from public.daily_routes where id = p_daily_route_id and published and status in ('borrador', 'activa')) then raise exception 'La ruta ya no está disponible'; end if;
  if p_origin_stop_id = p_destination_stop_id then raise exception 'El origen y el destino deben ser distintos'; end if;
  if not exists (select 1 from public.daily_route_stops where id = p_origin_stop_id and daily_route_id = p_daily_route_id and active)
    or not exists (select 1 from public.daily_route_stops where id = p_destination_stop_id and daily_route_id = p_daily_route_id and active) then
    raise exception 'Los puntos de encuentro no pertenecen a la ruta publicada';
  end if;
  if (case p_requested_category when 'pequeno' then 0 when 'mediano' then 1 else 2 end) < (case p_recommended_category when 'pequeno' then 0 when 'mediano' then 1 else 2 end) then raise exception 'La categoría elegida no es apta para el animal'; end if;
  select amount into v_amount from public.pricing_rules where category = p_requested_category and active;
  if v_amount is null then raise exception 'La tarifa seleccionada no está disponible'; end if;
  insert into public.reservations(daily_route_id, sender, recipient, animal, origin_stop_id, destination_stop_id, requested_category, recommended_category, quoted_amount, notes, status)
  values (p_daily_route_id, p_sender, p_recipient, p_animal, p_origin_stop_id, p_destination_stop_id, p_requested_category, p_recommended_category, v_amount, coalesce(p_notes, ''), 'pending_review') returning id into v_id;
  return v_id;
end;
$$;

create function public.confirm_reservation_payment(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reservation public.reservations;
  v_letter_id text;
  v_animal_id uuid;
  v_client_id uuid;
  v_origin text;
  v_destination text;
  v_net numeric;
  v_invoice_id uuid;
  v_pickup_sequence integer;
  v_delivery_sequence integer;
  v_box_number integer;
begin
  if not public.is_admin() then raise exception 'Solo administración puede confirmar cobros'; end if;
  select * into v_reservation from public.reservations where id = p_reservation_id for update;
  if v_reservation.id is null or v_reservation.status not in ('pending_review', 'pending_payment') then raise exception 'La reserva no está disponible para confirmación'; end if;
  select locality into v_origin from public.daily_route_stops where id = v_reservation.origin_stop_id;
  select locality into v_destination from public.daily_route_stops where id = v_reservation.destination_stop_id;
  select sequence into v_pickup_sequence from public.daily_route_stops where id = v_reservation.origin_stop_id;
  select sequence into v_delivery_sequence from public.daily_route_stops where id = v_reservation.destination_stop_id;
  if v_pickup_sequence is null or v_delivery_sequence is null or v_pickup_sequence >= v_delivery_sequence then
    raise exception 'El punto de recogida debe ser anterior al de entrega en la ruta';
  end if;
  v_letter_id := format('CARTA DE PORTE Nº %s-%s', to_char(now(), 'YYYY'), lpad(nextval('public.carriage_letter_sequence')::text, 5, '0'));
  insert into public.carriage_letters(id, original_filename, storage_path, service_date, status, default_route_template_id, sender_name, sender_address, sender_city, sender_postal_code, sender_phone, sender_email, recipient_name, recipient_address, recipient_city, recipient_postal_code, recipient_phone, recipient_email, origin_text, destination_text, reservation_id)
  select v_letter_id, 'generada-desde-reserva.pdf', format('generated/%s/carta.pdf', v_reservation.id), r.service_date, 'revisada', r.route_template_id,
    coalesce(v_reservation.sender ->> 'name',''), coalesce(v_reservation.sender ->> 'address',''), coalesce(v_reservation.sender ->> 'city',''), coalesce(v_reservation.sender ->> 'postalCode',''), coalesce(v_reservation.sender ->> 'phone',''), coalesce(v_reservation.sender ->> 'email',''),
    coalesce(v_reservation.recipient ->> 'name',''), coalesce(v_reservation.recipient ->> 'address',''), coalesce(v_reservation.recipient ->> 'city',''), coalesce(v_reservation.recipient ->> 'postalCode',''), coalesce(v_reservation.recipient ->> 'phone',''), coalesce(v_reservation.recipient ->> 'email',''), coalesce(v_origin,''), coalesce(v_destination,''), v_reservation.id
  from public.daily_routes r where r.id = v_reservation.daily_route_id;
  insert into public.animals(letter_id, ordinal, species, breed, identification, microchip, size, requested_category, recommended_category, weight_kg)
  values (v_letter_id, 1, coalesce(v_reservation.animal ->> 'species','Perro'), coalesce(v_reservation.animal ->> 'breed',''), coalesce(v_reservation.animal ->> 'microchip',''), coalesce(v_reservation.animal ->> 'microchip',''), v_reservation.requested_category, v_reservation.requested_category, v_reservation.recommended_category, nullif(v_reservation.animal ->> 'weightKg','')::numeric)
  returning id into v_animal_id;
  select candidate into v_box_number
  from unnest(case v_reservation.requested_category
    when 'grande' then array[1,2,3,4,37,38,39,40]
    when 'mediano' then array[5,6,7,8,9,10,11,12,41,42,43,44,45,46,47,48]
    else array[13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72]
  end) as candidate
  where not exists (
    select 1 from public.van_assignments va
    where va.daily_route_id = v_reservation.daily_route_id and va.box_number = candidate
      and int4range(va.pickup_sequence, va.delivery_sequence, '[)') && int4range(v_pickup_sequence, v_delivery_sequence, '[)')
  ) limit 1;
  if v_box_number is null then raise exception 'No queda disponibilidad de box para este tramo'; end if;
  insert into public.van_assignments(daily_route_id, animal_id, box_number, pickup_sequence, delivery_sequence)
  values (v_reservation.daily_route_id, v_animal_id, v_box_number, v_pickup_sequence, v_delivery_sequence);
  insert into public.route_actions(daily_route_id, daily_route_stop_id, letter_id, animal_id, action_type)
  values (v_reservation.daily_route_id, v_reservation.origin_stop_id, v_letter_id, v_animal_id, 'recogida'),
    (v_reservation.daily_route_id, v_reservation.destination_stop_id, v_letter_id, v_animal_id, 'entrega');
  update public.carriage_letters set box_number = v_box_number where id = v_letter_id;
  insert into public.clients(full_name, phone, email, address, city, postal_code) values (coalesce(v_reservation.sender ->> 'name','Cliente'), coalesce(v_reservation.sender ->> 'phone',''), coalesce(v_reservation.sender ->> 'email',''), coalesce(v_reservation.sender ->> 'address',''), coalesce(v_reservation.sender ->> 'city',''), coalesce(v_reservation.sender ->> 'postalCode','')) on conflict (normalized_name) do update set phone = excluded.phone, email = excluded.email, address = excluded.address, city = excluded.city, postal_code = excluded.postal_code returning id into v_client_id;
  v_net := round(v_reservation.quoted_amount / 1.21, 2);
  insert into public.invoice_drafts(letter_id, client_id, payer, client_snapshot, concept, net_amount, status, invoice_number, payment_status)
  values (v_letter_id, v_client_id, 'remitente', v_reservation.sender, 'Servicio de transporte de mascota', v_net, 'pagado', format('F-%s-%s', to_char(now(), 'YYYY'), lpad(nextval('public.invoice_number_sequence')::text, 5, '0')), 'paid')
  returning id into v_invoice_id;
  update public.reservations set status = 'confirmed', payment_status = 'paid', paid_at = now(), confirmed_by = auth.uid(), letter_id = v_letter_id where id = p_reservation_id;
  insert into public.document_deliveries(reservation_id, letter_id, channel, recipient, document_kind)
  select v_reservation.id, v_letter_id, 'email', contact, 'carriage_letter' from unnest(array[v_reservation.sender ->> 'email', v_reservation.recipient ->> 'email']) as contact where coalesce(contact,'') <> '';
  insert into public.document_deliveries(reservation_id, letter_id, channel, recipient, document_kind)
  select v_reservation.id, v_letter_id, 'whatsapp', contact, 'carriage_letter' from unnest(array[v_reservation.sender ->> 'phone', v_reservation.recipient ->> 'phone']) as contact where coalesce(contact,'') <> '';
  insert into public.document_deliveries(reservation_id, invoice_id, channel, recipient, document_kind)
  select v_reservation.id, v_invoice_id, 'email', contact, 'invoice' from unnest(array[v_reservation.sender ->> 'email']) as contact where coalesce(contact,'') <> '';
  insert into public.document_deliveries(reservation_id, invoice_id, channel, recipient, document_kind)
  select v_reservation.id, v_invoice_id, 'whatsapp', contact, 'invoice' from unnest(array[v_reservation.sender ->> 'phone']) as contact where coalesce(contact,'') <> '';
  insert into public.audit_logs(actor_id, event_type, entity_type, entity_id, data) values (auth.uid(), 'reservation_paid', 'reservation', p_reservation_id::text, jsonb_build_object('letter_id', v_letter_id, 'animal_id', v_animal_id));
end;
$$;

alter table public.pricing_rules enable row level security;
alter table public.reservations enable row level security;
alter table public.document_deliveries enable row level security;
create policy "pricing public read" on public.pricing_rules for select to anon, authenticated using (active);
create policy "reservations admin manage" on public.reservations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "deliveries admin manage" on public.document_deliveries for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.pricing_rules to anon, authenticated;
grant select, insert, update, delete on public.reservations, public.document_deliveries to authenticated;
revoke all on function public.submit_public_reservation(uuid, jsonb, jsonb, jsonb, uuid, uuid, public.animal_size, public.animal_size, numeric, text) from public;
grant execute on function public.submit_public_reservation(uuid, jsonb, jsonb, jsonb, uuid, uuid, public.animal_size, public.animal_size, numeric, text) to anon, authenticated;
revoke all on function public.confirm_reservation_payment(uuid) from public;
grant execute on function public.confirm_reservation_payment(uuid) to authenticated;
