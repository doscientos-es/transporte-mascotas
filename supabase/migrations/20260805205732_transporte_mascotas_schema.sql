create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'transportista');
create type public.animal_size as enum ('pequeno', 'mediano', 'grande');
create type public.letter_status as enum ('pendiente', 'revisada', 'programada', 'en_ruta', 'entregada', 'cancelada');
create type public.daily_route_status as enum ('borrador', 'activa', 'completada', 'cancelada');
create type public.service_type as enum ('recogida', 'entrega');
create type public.service_action_status as enum ('pendiente', 'completada', 'incidencia');
create type public.payer_type as enum ('remitente', 'destinatario');
create type public.invoice_draft_status as enum ('borrador', 'generado', 'anulado');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.app_role not null default 'transportista',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.route_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#2a4227',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.route_template_stops (
  id uuid primary key default gen_random_uuid(),
  route_template_id uuid not null references public.route_templates(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  sequence integer not null check (sequence > 0),
  locality text not null,
  meeting_point text not null default '',
  map_url text,
  minutes_to_next integer check (minutes_to_next is null or minutes_to_next >= 0),
  unique (route_template_id, sequence)
);

create table public.route_defaults (
  destination_location_id uuid primary key references public.locations(id) on delete cascade,
  route_template_id uuid not null references public.route_templates(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table public.carriage_letters (
  id text primary key check (id like 'CARTA DE PORTE Nº%'),
  original_filename text not null,
  storage_path text not null unique,
  service_date date not null,
  status public.letter_status not null default 'pendiente',
  default_route_template_id uuid references public.route_templates(id) on delete set null,
  sender_name text not null default '',
  sender_nif text not null default '',
  sender_address text not null default '',
  sender_city text not null default '',
  sender_postal_code text not null default '',
  sender_phone text not null default '',
  sender_email text not null default '',
  recipient_name text not null default '',
  recipient_nif text not null default '',
  recipient_address text not null default '',
  recipient_city text not null default '',
  recipient_postal_code text not null default '',
  recipient_phone text not null default '',
  recipient_email text not null default '',
  origin_text text not null default '',
  destination_text text not null default '',
  origin_location_id uuid references public.locations(id) on delete set null,
  destination_location_id uuid references public.locations(id) on delete set null,
  accompanying_documents text[] not null default '{}',
  extraction jsonb not null default '{}'::jsonb,
  imported_by uuid references public.profiles(id) on delete set null,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  letter_id text not null references public.carriage_letters(id) on delete cascade,
  ordinal integer not null default 1 check (ordinal > 0),
  species text not null,
  breed text not null default '',
  birth_date date,
  identification text not null default '',
  size public.animal_size not null,
  size_source text not null default 'manual' check (size_source in ('regla', 'manual')),
  unique (letter_id, ordinal)
);

create table public.animal_size_rules (
  id uuid primary key default gen_random_uuid(),
  species_normalized text not null,
  breed_normalized text not null,
  size public.animal_size not null,
  active boolean not null default true,
  unique (species_normalized, breed_normalized)
);

create table public.daily_routes (
  id uuid primary key default gen_random_uuid(),
  route_template_id uuid references public.route_templates(id) on delete set null,
  service_date date not null,
  status public.daily_route_status not null default 'borrador',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_template_id, service_date)
);

create table public.daily_route_stops (
  id uuid primary key default gen_random_uuid(),
  daily_route_id uuid not null references public.daily_routes(id) on delete cascade,
  template_stop_id uuid references public.route_template_stops(id) on delete set null,
  sequence integer not null check (sequence > 0),
  locality text not null,
  meeting_point text not null default '',
  map_url text,
  minutes_to_next integer check (minutes_to_next is null or minutes_to_next >= 0),
  unique (daily_route_id, sequence)
);

create table public.route_actions (
  id uuid primary key default gen_random_uuid(),
  daily_route_id uuid not null references public.daily_routes(id) on delete cascade,
  daily_route_stop_id uuid not null references public.daily_route_stops(id) on delete cascade,
  letter_id text not null references public.carriage_letters(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  action_type public.service_type not null,
  status public.service_action_status not null default 'pendiente',
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  incident_note text not null default '',
  unique (daily_route_id, animal_id, action_type)
);

create table public.van_assignments (
  id uuid primary key default gen_random_uuid(),
  daily_route_id uuid not null references public.daily_routes(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  box_number integer not null check (box_number between 1 and 72),
  pickup_sequence integer not null check (pickup_sequence > 0),
  delivery_sequence integer not null check (delivery_sequence >= pickup_sequence),
  created_at timestamptz not null default now(),
  unique (daily_route_id, animal_id)
);

create table public.invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  letter_id text not null references public.carriage_letters(id) on delete restrict,
  payer public.payer_type not null,
  client_snapshot jsonb not null,
  concept text not null,
  net_amount numeric(12,2) not null check (net_amount >= 0),
  vat_rate numeric(5,2) not null default 21 check (vat_rate between 0 and 100),
  vat_amount numeric(12,2) generated always as (round(net_amount * vat_rate / 100, 2)) stored,
  total_amount numeric(12,2) generated always as (round(net_amount * (1 + vat_rate / 100), 2)) stored,
  status public.invoice_draft_status not null default 'borrador',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger route_templates_updated_at before update on public.route_templates for each row execute function public.set_updated_at();
create trigger carriage_letters_updated_at before update on public.carriage_letters for each row execute function public.set_updated_at();
create trigger daily_routes_updated_at before update on public.daily_routes for each row execute function public.set_updated_at();

create function public.is_admin() returns boolean language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'user_role') = 'admin', false);
$$;

create function public.box_matches_animal_size(p_box integer, p_size public.animal_size) returns boolean language sql immutable set search_path = '' as $$
  select case p_size
    when 'grande' then p_box in (1,2,3,4,37,38,39,40)
    when 'mediano' then p_box between 5 and 12 or p_box between 41 and 48
    when 'pequeno' then p_box between 13 and 36 or p_box between 49 and 72
  end;
$$;

create function public.record_route_action(p_action_id uuid, p_status public.service_action_status, p_incident_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_route public.daily_routes;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select r.* into target_route from public.route_actions a join public.daily_routes r on r.id = a.daily_route_id where a.id = p_action_id;
  if target_route.id is null or target_route.status <> 'activa' then raise exception 'Acción no disponible'; end if;
  update public.route_actions set status = p_status, incident_note = coalesce(p_incident_note, ''), completed_at = case when p_status = 'completada' then now() else null end, completed_by = auth.uid() where id = p_action_id;
  insert into public.audit_logs(actor_id, event_type, entity_type, entity_id) values (auth.uid(), 'route_action_updated', 'route_action', p_action_id::text);
end;
$$;

revoke all on function public.record_route_action(uuid, public.service_action_status, text) from public;
grant execute on function public.record_route_action(uuid, public.service_action_status, text) to authenticated;

create function public.assign_van_box(p_daily_route_id uuid, p_animal_id uuid, p_box_number integer, p_pickup_sequence integer, p_delivery_sequence integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare assignment_id uuid; animal_size public.animal_size;
begin
  if not public.is_admin() then raise exception 'Solo administración puede asignar boxes'; end if;
  select size into animal_size from public.animals where id = p_animal_id;
  if animal_size is null or not public.box_matches_animal_size(p_box_number, animal_size) then raise exception 'El box no corresponde al tamaño del animal'; end if;
  if exists (select 1 from public.van_assignments where daily_route_id = p_daily_route_id and box_number = p_box_number and int4range(pickup_sequence, delivery_sequence, '[]') && int4range(p_pickup_sequence, p_delivery_sequence, '[]')) then raise exception 'El box está ocupado en este tramo'; end if;
  insert into public.van_assignments(daily_route_id, animal_id, box_number, pickup_sequence, delivery_sequence) values (p_daily_route_id, p_animal_id, p_box_number, p_pickup_sequence, p_delivery_sequence) returning id into assignment_id;
  return assignment_id;
end;
$$;

revoke all on function public.assign_van_box(uuid, uuid, integer, integer, integer) from public;
grant execute on function public.assign_van_box(uuid, uuid, integer, integer, integer) to authenticated;

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.route_templates enable row level security;
alter table public.route_template_stops enable row level security;
alter table public.route_defaults enable row level security;
alter table public.carriage_letters enable row level security;
alter table public.animals enable row level security;
alter table public.animal_size_rules enable row level security;
alter table public.daily_routes enable row level security;
alter table public.daily_route_stops enable row level security;
alter table public.route_actions enable row level security;
alter table public.van_assignments enable row level security;
alter table public.invoice_drafts enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles self or admin read" on public.profiles for select to authenticated using ((select auth.uid()) = id or public.is_admin());
create policy "profiles admin manage" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "reference read" on public.locations for select to authenticated using (true);
create policy "reference admin manage" on public.locations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "templates read" on public.route_templates for select to authenticated using (true);
create policy "templates admin manage" on public.route_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "template stops read" on public.route_template_stops for select to authenticated using (true);
create policy "template stops admin manage" on public.route_template_stops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "route defaults read" on public.route_defaults for select to authenticated using (true);
create policy "route defaults admin manage" on public.route_defaults for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "letters admin manage" on public.carriage_letters for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "animals admin manage" on public.animals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "animal rules read" on public.animal_size_rules for select to authenticated using (true);
create policy "animal rules admin manage" on public.animal_size_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "daily routes active or admin read" on public.daily_routes for select to authenticated using (status = 'activa' or public.is_admin());
create policy "daily routes admin manage" on public.daily_routes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "daily stops active or admin read" on public.daily_route_stops for select to authenticated using (public.is_admin() or exists (select 1 from public.daily_routes r where r.id = daily_route_id and r.status = 'activa'));
create policy "daily stops admin manage" on public.daily_route_stops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "actions active or admin read" on public.route_actions for select to authenticated using (public.is_admin() or exists (select 1 from public.daily_routes r where r.id = daily_route_id and r.status = 'activa'));
create policy "actions admin manage" on public.route_actions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "assignments active or admin read" on public.van_assignments for select to authenticated using (public.is_admin() or exists (select 1 from public.daily_routes r where r.id = daily_route_id and r.status = 'activa'));
create policy "assignments admin manage" on public.van_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "invoice drafts admin manage" on public.invoice_drafts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "audit admin read" on public.audit_logs for select to authenticated using (public.is_admin());

grant usage on schema public to authenticated;
grant select on public.locations, public.route_templates, public.route_template_stops, public.route_defaults, public.animal_size_rules to authenticated;
grant select, insert, update, delete on public.profiles, public.carriage_letters, public.animals, public.daily_routes, public.daily_route_stops, public.route_actions, public.van_assignments, public.invoice_drafts, public.audit_logs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carriage-letters', 'carriage-letters', false, 10485760, array['application/pdf']), ('generated-documents', 'generated-documents', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "admins manage carriage letters files" on storage.objects for all to authenticated using (bucket_id = 'carriage-letters' and public.is_admin()) with check (bucket_id = 'carriage-letters' and public.is_admin());
create policy "authenticated read generated files" on storage.objects for select to authenticated using (bucket_id = 'generated-documents');
create policy "admins manage generated files" on storage.objects for all to authenticated using (bucket_id = 'generated-documents' and public.is_admin()) with check (bucket_id = 'generated-documents' and public.is_admin());
