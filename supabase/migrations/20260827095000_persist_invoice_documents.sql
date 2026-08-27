create table if not exists public.invoice_documents (
  invoice_draft_id uuid primary key references public.invoice_drafts(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id) on delete set null
);

alter table public.invoice_documents enable row level security;

create policy "invoice documents admin manage"
  on public.invoice_documents
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.invoice_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
