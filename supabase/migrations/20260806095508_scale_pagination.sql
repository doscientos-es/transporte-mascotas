create extension if not exists pg_trgm;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  normalized_name text generated always as (lower(regexp_replace(trim(full_name), '\s+', ' ', 'g'))) stored,
  nif text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  city text not null default '',
  postal_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

alter table public.invoice_drafts add column if not exists client_id uuid references public.clients(id) on delete restrict;
alter table public.clients enable row level security;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'clients_updated_at') then
    create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'clients' and policyname = 'clients admin manage') then
    create policy "clients admin manage" on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

grant select, insert, update, delete on public.clients to authenticated;

create index if not exists carriage_letters_imported_at_idx on public.carriage_letters (imported_at desc);
create index if not exists carriage_letters_status_imported_at_idx on public.carriage_letters (status, imported_at desc);
create index if not exists carriage_letters_id_trgm_idx on public.carriage_letters using gin (id gin_trgm_ops);
create index if not exists carriage_letters_sender_trgm_idx on public.carriage_letters using gin (sender_name gin_trgm_ops);
create index if not exists carriage_letters_recipient_trgm_idx on public.carriage_letters using gin (recipient_name gin_trgm_ops);
create index if not exists carriage_letters_origin_trgm_idx on public.carriage_letters using gin (origin_text gin_trgm_ops);
create index if not exists carriage_letters_destination_trgm_idx on public.carriage_letters using gin (destination_text gin_trgm_ops);
create index if not exists animals_letter_id_idx on public.animals (letter_id, ordinal);
create index if not exists daily_routes_service_date_idx on public.daily_routes (service_date desc, created_at desc);
create index if not exists daily_route_stops_route_sequence_idx on public.daily_route_stops (daily_route_id, sequence);
create index if not exists route_actions_route_stop_idx on public.route_actions (daily_route_id, daily_route_stop_id);
create index if not exists van_assignments_route_animal_idx on public.van_assignments (daily_route_id, animal_id);
create index if not exists clients_name_trgm_idx on public.clients using gin (full_name gin_trgm_ops);
create index if not exists invoice_drafts_client_created_idx on public.invoice_drafts (client_id, created_at desc);