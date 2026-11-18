-- Internal cancellations preserve the issued document and payment. They are not
-- fiscal rectifications and do not refund money or change the original VAT.
create table public.manual_invoice_cancellations (
  issued_invoice_id uuid primary key references public.issued_invoices(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  cancelled_at timestamptz not null default now()
);
alter table public.manual_invoice_cancellations enable row level security;
create policy "manual invoice cancellations admin read" on public.manual_invoice_cancellations
  for select to authenticated using (public.is_admin());
revoke all on public.manual_invoice_cancellations from public, anon, authenticated;
grant select on public.manual_invoice_cancellations to authenticated;

create function public.cancel_manual_invoice(p_invoice_id uuid, p_expected_snapshot jsonb, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_invoice public.issued_invoices;
  v_draft public.invoice_drafts;
begin
  if auth.uid() is null or not public.is_admin() or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin' and active
  ) then
    raise exception 'Solo administración puede anular facturas libres.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Indica un motivo de entre 3 y 500 caracteres.';
  end if;
  -- Match the editor's lock order, so cancellation cannot race an invoice edit.
  select * into v_invoice from public.issued_invoices where invoice_draft_id = p_invoice_id for update;
  if not found then raise exception 'Factura no encontrada.'; end if;
  if v_invoice.fiscal_snapshot is distinct from p_expected_snapshot then
    raise exception 'La factura ha cambiado; actualiza la página.';
  end if;
  select * into v_draft from public.invoice_drafts where id = p_invoice_id for update;
  if v_draft.status is distinct from 'emitida' or v_draft.letter_id is not null
    or v_draft.payer::text <> 'manual'
    or not exists (select 1 from public.invoice_payments
      where invoice_id = p_invoice_id and provider = 'manual' and status = 'pagado') then
    raise exception 'Solo se pueden anular internamente facturas libres con cobro manual.';
  end if;
  if exists (select 1 from public.manual_invoice_cancellations where issued_invoice_id = v_invoice.id) then
    raise exception 'La factura ya está anulada internamente.';
  end if;
  insert into public.manual_invoice_cancellations (issued_invoice_id, actor_id, reason)
  values (v_invoice.id, auth.uid(), btrim(p_reason));
  insert into public.audit_logs (actor_id, event_type, entity_type, entity_id, data)
  values (auth.uid(), 'manual_invoice_cancelled_internally', 'issued_invoice', v_invoice.id::text,
    jsonb_build_object('invoice_draft_id', p_invoice_id, 'reason', btrim(p_reason)));
end;
$$;
revoke all on function public.cancel_manual_invoice(uuid, jsonb, text) from public, anon;
grant execute on function public.cancel_manual_invoice(uuid, jsonb, text) to authenticated;

create function public.prevent_cancelled_manual_invoice_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.issued_invoices i
    join public.manual_invoice_cancellations c on c.issued_invoice_id = i.id
    where i.invoice_draft_id = old.id) then
    raise exception 'Una factura anulada internamente no se puede modificar.';
  end if;
  return new;
end;
$$;
create trigger invoice_drafts_prevent_cancelled_edit before update on public.invoice_drafts
  for each row execute function public.prevent_cancelled_manual_invoice_edit();

-- Preserve the existing pagination and access checks while annotating each row.
alter function public.list_invoice_page(text, text, uuid, date, date, text, text, integer, integer)
  rename to list_invoice_page_before_internal_cancellations;
create function public.list_invoice_page(
  p_query text default null, p_status text default null, p_client_id uuid default null,
  p_from date default null, p_to date default null, p_sort text default 'date',
  p_direction text default 'desc', p_page integer default 1, p_page_size integer default 12
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with page as (
    select public.list_invoice_page_before_internal_cancellations(
      p_query, p_status, p_client_id, p_from, p_to, p_sort, p_direction, p_page, p_page_size
    ) as value
  )
  select jsonb_set(page.value, '{items}', coalesce((
    select jsonb_agg(item.value || jsonb_build_object('cancelled_at', c.cancelled_at, 'cancellation_reason', c.reason)
      order by item.ordinality)
    from jsonb_array_elements(page.value -> 'items') with ordinality as item(value, ordinality)
    left join public.manual_invoice_cancellations c on c.issued_invoice_id = (item.value ->> 'issued_invoice_id')::uuid
  ), '[]'::jsonb)) from page;
$$;
revoke all on function public.list_invoice_page(text, text, uuid, date, date, text, text, integer, integer) from public, anon;
grant execute on function public.list_invoice_page(text, text, uuid, date, date, text, text, integer, integer) to authenticated;

-- Keep cancelled invoices in the feed: their VAT still belongs to the original
-- invoice. The UI excludes them only from operational income and profit.
alter function public.list_finance_income(date, date) rename to list_finance_income_before_internal_cancellations;
create function public.list_finance_income(p_from date default null, p_to date default null)
returns table (
  issued_invoice_id uuid, invoice_draft_id uuid, issued_on date, invoice_number text,
  client_name text, client_nif text, concept text, net_amount numeric, vat_amount numeric,
  total_amount numeric, cancelled_at timestamptz
) language sql stable security invoker set search_path = '' as $$
  select income.*, c.cancelled_at
  from public.list_finance_income_before_internal_cancellations(p_from, p_to) income
  left join public.manual_invoice_cancellations c on c.issued_invoice_id = income.issued_invoice_id;
$$;
revoke all on function public.list_finance_income(date, date) from public, anon;
grant execute on function public.list_finance_income(date, date) to authenticated;
notify pgrst, 'reload schema';
