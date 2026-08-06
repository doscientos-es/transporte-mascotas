create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (btrim(full_name) <> ''),
  normalized_name text generated always as (lower(btrim(full_name))) stored unique,
  nif text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  city text not null default '',
  postal_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoice_drafts
  add column client_id uuid references public.clients(id) on delete restrict;

create unique index invoice_drafts_one_per_letter_idx
  on public.invoice_drafts(letter_id);

create index invoice_drafts_client_id_idx on public.invoice_drafts(client_id);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "clients admin manage"
  on public.clients for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.clients to authenticated;
