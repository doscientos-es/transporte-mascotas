-- Keep high-cardinality dashboard lists in Postgres instead of transferring
-- every row to the browser. The functions return one JSON document so the
-- total remains available even when a requested page is empty.
create index if not exists clients_directory_sort_idx
  on public.clients (full_name, id);
create index if not exists clients_city_sort_idx
  on public.clients (city, id);
create index if not exists clients_nif_trgm_idx
  on public.clients using gin (nif gin_trgm_ops);
create index if not exists clients_email_trgm_idx
  on public.clients using gin (email gin_trgm_ops);
create index if not exists clients_phone_trgm_idx
  on public.clients using gin (phone gin_trgm_ops);
create index if not exists clients_city_trgm_idx
  on public.clients using gin (city gin_trgm_ops);

create index if not exists invoice_drafts_letter_id_trgm_idx
  on public.invoice_drafts using gin (letter_id gin_trgm_ops);
create index if not exists invoice_drafts_concept_trgm_idx
  on public.invoice_drafts using gin (concept gin_trgm_ops);
create index if not exists invoice_drafts_client_name_trgm_idx
  on public.invoice_drafts using gin ((client_snapshot ->> 'fullName') gin_trgm_ops);
create index if not exists invoice_drafts_total_amount_idx
  on public.invoice_drafts (total_amount, id);
create index if not exists issued_invoices_number_trgm_idx
  on public.issued_invoices using gin ((fiscal_snapshot ->> 'number') gin_trgm_ops);

create or replace function public.list_client_page(
  p_query text default null,
  p_sort text default 'name',
  p_direction text default 'asc',
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_query text := nullif(left(btrim(coalesce(p_query, '')), 120), '');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 12), 1), 50);
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede consultar clientes';
  end if;
  if coalesce(p_sort, '') not in ('name', 'city', 'created_at') then
    raise exception 'Orden de clientes no válido';
  end if;
  if coalesce(p_direction, '') not in ('asc', 'desc') then
    raise exception 'Dirección de orden no válida';
  end if;

  return (
    with filtered as (
      select client.id, client.full_name, client.nif, client.email, client.phone,
             client.address, client.city, client.postal_code, client.created_at
      from public.clients client
      where v_query is null
         or client.full_name ilike '%' || v_query || '%'
         or client.nif ilike '%' || v_query || '%'
         or client.email ilike '%' || v_query || '%'
         or client.phone ilike '%' || v_query || '%'
         or client.city ilike '%' || v_query || '%'
    ),
    page_rows as (
      select *
      from filtered
      order by
        case when p_sort = 'name' and p_direction = 'asc' then full_name end asc,
        case when p_sort = 'name' and p_direction = 'desc' then full_name end desc,
        case when p_sort = 'city' and p_direction = 'asc' then city end asc,
        case when p_sort = 'city' and p_direction = 'desc' then city end desc,
        case when p_sort = 'created_at' and p_direction = 'asc' then created_at end asc,
        case when p_sort = 'created_at' and p_direction = 'desc' then created_at end desc,
        id asc
      offset (v_page - 1) * v_page_size
      limit v_page_size
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'full_name', full_name,
          'nif', nif,
          'email', email,
          'phone', phone,
          'address', address,
          'city', city,
          'postal_code', postal_code,
          'created_at', created_at
        ))
        from page_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.list_invoice_page(
  p_query text default null,
  p_status text default null,
  p_client_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_sort text default 'date',
  p_direction text default 'desc',
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_query text := nullif(left(btrim(coalesce(p_query, '')), 120), '');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  -- The interactive list uses 12 rows. A larger explicit request is reserved
  -- for the administrator's filtered CSV export, still returned as one row.
  v_page_size integer := least(greatest(coalesce(p_page_size, 12), 1), 100000);
begin
  if p_status is not null and p_status not in ('solicitud_pago', 'emitida') then
    raise exception 'Estado de factura no válido';
  end if;
  if coalesce(p_sort, '') not in ('date', 'total', 'client', 'status') then
    raise exception 'Orden de facturas no válido';
  end if;
  if coalesce(p_direction, '') not in ('asc', 'desc') then
    raise exception 'Dirección de orden no válida';
  end if;

  return (
    with visible_invoices as (
      select draft.id,
             draft.letter_id,
             draft.client_id,
             draft.payer::text as payer,
             draft.concept,
             draft.total_amount,
             draft.status::text as status,
             draft.created_at,
             coalesce(draft.client_snapshot ->> 'fullName', client.full_name, '') as client_name,
             coalesce(
               issued.fiscal_snapshot -> 'client' ->> 'nif',
               draft.client_snapshot ->> 'nif',
               client.nif,
               ''
             ) as client_nif,
             issued.id as issued_invoice_id,
             coalesce(
               issued.fiscal_snapshot ->> 'number',
               concat(issued.series, '-', issued.fiscal_year, '-', lpad(issued.sequence_number::text, 6, '0'))
             ) as issued_number,
             issued.issued_at,
             issued.fiscal_snapshot
      from public.invoice_drafts draft
      left join public.clients client on client.id = draft.client_id
      left join public.issued_invoices issued on issued.invoice_draft_id = draft.id
      where public.is_admin()
        and draft.status in ('solicitud_pago', 'emitida')

      union all

      select invoice.id,
             invoice.letter_id,
             null::uuid,
             invoice.payer::text,
             invoice.concept,
             invoice.total_amount,
             invoice.status::text,
             invoice.created_at,
             ''::text,
             ''::text,
             null::uuid,
             null::text,
             null::timestamptz,
             null::jsonb
      from public.transporter_invoices invoice
      where not public.is_admin()
        and invoice.status in ('solicitud_pago', 'emitida')
    ),
    filtered as (
      select *, coalesce(issued_at, created_at) as display_date
      from visible_invoices
      where (p_status is null or status = p_status)
        and (p_client_id is null or client_id = p_client_id)
        and (p_from is null or coalesce(issued_at, created_at)::date >= p_from)
        and (p_to is null or coalesce(issued_at, created_at)::date <= p_to)
        and (
          v_query is null
          or letter_id ilike '%' || v_query || '%'
          or concept ilike '%' || v_query || '%'
          or client_name ilike '%' || v_query || '%'
          or coalesce(issued_number, '') ilike '%' || v_query || '%'
          or status ilike '%' || v_query || '%'
        )
    ),
    page_rows as (
      select *
      from filtered
      order by
        case when p_sort = 'date' and p_direction = 'asc' then display_date end asc,
        case when p_sort = 'date' and p_direction = 'desc' then display_date end desc,
        case when p_sort = 'total' and p_direction = 'asc' then total_amount end asc,
        case when p_sort = 'total' and p_direction = 'desc' then total_amount end desc,
        case when p_sort = 'client' and p_direction = 'asc' then client_name end asc,
        case when p_sort = 'client' and p_direction = 'desc' then client_name end desc,
        case when p_sort = 'status' and p_direction = 'asc' then status end asc,
        case when p_sort = 'status' and p_direction = 'desc' then status end desc,
        id asc
      offset (v_page - 1) * v_page_size
      limit v_page_size
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'letter_id', letter_id,
          'client_id', client_id,
          'payer', payer,
          'concept', concept,
          'total_amount', total_amount,
          'status', status,
          'created_at', created_at,
          'client_name', client_name,
          'client_nif', client_nif,
          'issued_invoice_id', issued_invoice_id,
          'issued_number', issued_number,
          'issued_at', issued_at,
          'fiscal_snapshot', fiscal_snapshot
        ))
        from page_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.list_client_page(text, text, text, integer, integer) from public, anon;
revoke all on function public.list_invoice_page(text, text, uuid, date, date, text, text, integer, integer) from public, anon;
grant execute on function public.list_client_page(text, text, text, integer, integer) to authenticated;
grant execute on function public.list_invoice_page(text, text, uuid, date, date, text, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
