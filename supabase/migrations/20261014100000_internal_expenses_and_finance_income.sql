-- Internal expenses (gastos) and the income feed used to compute profit.
-- Income is never copied: it is read from issued invoices, so profit always
-- reflects the billing module.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  vendor text not null check (btrim(vendor) <> '' and char_length(vendor) <= 160),
  vendor_nif text not null default '' check (char_length(vendor_nif) <= 40),
  invoice_reference text not null default '' check (char_length(invoice_reference) <= 80),
  concept text not null check (btrim(concept) <> '' and char_length(concept) <= 240),
  category text not null default 'otros' check (category in (
    'combustible', 'vehiculo', 'peajes', 'seguros', 'suministros', 'material',
    'servicios_profesionales', 'suscripciones', 'impuestos', 'otros'
  )),
  net_amount numeric(12,2) not null check (net_amount >= 0),
  vat_rate numeric(5,2) not null default 21 check (vat_rate between 0 and 100),
  vat_amount numeric(12,2) generated always as (round(net_amount * vat_rate / 100, 2)) stored,
  total_amount numeric(12,2) generated always as (round(net_amount * (1 + vat_rate / 100), 2)) stored,
  notes text not null default '' check (char_length(notes) <= 1000),
  document_path text unique,
  document_name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((document_path is null) = (document_name is null))
);

create index expenses_expense_date_idx on public.expenses (expense_date desc);

create trigger expenses_updated_at
before update on public.expenses for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

create policy "expenses admin manage"
  on public.expenses
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.expenses to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-documents', 'expense-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "admins manage expense documents"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'expense-documents' and public.is_admin())
  with check (bucket_id = 'expense-documents' and public.is_admin());

-- Issued invoices in a date range (Madrid time), with amounts from the draft.
create or replace function public.list_finance_income(
  p_from date default null,
  p_to date default null
)
returns table (
  issued_invoice_id uuid,
  invoice_draft_id uuid,
  issued_on date,
  invoice_number text,
  client_name text,
  client_nif text,
  concept text,
  net_amount numeric,
  vat_amount numeric,
  total_amount numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acceso no permitido';
  end if;

  return query
  select issued.id,
         draft.id,
         (issued.issued_at at time zone 'Europe/Madrid')::date,
         coalesce(
           issued.fiscal_snapshot ->> 'number',
           concat(issued.series, '-', issued.fiscal_year, '-', lpad(issued.sequence_number::text, 6, '0'))
         ),
         coalesce(issued.fiscal_snapshot -> 'client' ->> 'fullName', draft.client_snapshot ->> 'fullName', ''),
         coalesce(issued.fiscal_snapshot -> 'client' ->> 'nif', draft.client_snapshot ->> 'nif', ''),
         draft.concept,
         draft.net_amount,
         draft.vat_amount,
         draft.total_amount
  from public.issued_invoices issued
  join public.invoice_drafts draft on draft.id = issued.invoice_draft_id
  where (p_from is null or (issued.issued_at at time zone 'Europe/Madrid')::date >= p_from)
    and (p_to is null or (issued.issued_at at time zone 'Europe/Madrid')::date <= p_to)
  order by issued.issued_at desc, issued.id;
end;
$$;

revoke all on function public.list_finance_income(date, date) from public, anon;
grant execute on function public.list_finance_income(date, date) to authenticated;

notify pgrst, 'reload schema';
