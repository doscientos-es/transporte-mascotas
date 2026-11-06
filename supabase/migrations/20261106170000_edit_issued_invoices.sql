-- Preserve the fiscal snapshot and PDF path for every change. Payments are never updated.
create table public.invoice_revisions (
  id bigint generated always as identity primary key,
  issued_invoice_id uuid not null references public.issued_invoices(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  fiscal_snapshot jsonb not null,
  storage_path text not null,
  file_name text not null,
  changed_at timestamptz not null default now()
);
alter table public.invoice_revisions enable row level security;
create policy "invoice revisions admin read" on public.invoice_revisions for select to authenticated using (public.is_admin());
revoke all on public.invoice_revisions from public, anon, authenticated;
grant select on public.invoice_revisions to authenticated;

-- A delayed PDF generation must not replace a more recent edited document.
create function public.protect_canonical_invoice_document() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.issued_invoice_id is not null and current_setting('app.editing_invoice', true) is distinct from 'true'
    and (new.storage_path is distinct from old.storage_path or new.issued_invoice_id is distinct from old.issued_invoice_id) then
    raise exception 'El documento de la factura ya ha cambiado.';
  end if;
  return new;
end;
$$;
create trigger invoice_documents_protect_canonical before update on public.invoice_documents
for each row execute function public.protect_canonical_invoice_document();

create or replace function public.prevent_issued_invoice_draft_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.status = 'emitida' then
    raise exception 'Una factura emitida no se puede eliminar; emite una rectificativa o anulación.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'emitida' then
    if current_setting('app.editing_invoice', true) = 'true' then return new; end if;
    raise exception 'Una factura emitida es inmutable; emite una rectificativa o anulación.';
  end if;
  if tg_op = 'UPDATE' and new.status = 'emitida' and current_setting('app.confirming_invoice_payment', true) is distinct from 'true' then
    raise exception 'La emisión debe realizarse desde la confirmación de cobro.';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.invoice_payments where invoice_id = old.id) and (
    new.client_id is distinct from old.client_id or new.payer is distinct from old.payer or new.client_snapshot is distinct from old.client_snapshot or
    new.concept is distinct from old.concept or new.net_amount is distinct from old.net_amount or new.vat_rate is distinct from old.vat_rate or
    new.vat_amount is distinct from old.vat_amount or new.total_amount is distinct from old.total_amount
  ) then raise exception 'No se pueden modificar datos fiscales después de iniciar el cobro.'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create function public.edit_issued_invoice(
  p_invoice_id uuid, p_actor_id uuid, p_expected_snapshot jsonb, p_snapshot jsonb,
  p_storage_path text, p_file_name text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_invoice public.issued_invoices;
  v_document public.invoice_documents;
  v_client jsonb := p_snapshot -> 'client';
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin' and active) then
    raise exception 'Solo administración puede editar facturas.';
  end if;
  select * into v_invoice from public.issued_invoices where invoice_draft_id = p_invoice_id for update;
  if v_invoice.id is null then raise exception 'Factura no encontrada.'; end if;
  if v_invoice.fiscal_snapshot is distinct from p_expected_snapshot then
    raise exception 'La factura ha cambiado; actualiza la página.';
  end if;
  if (p_snapshot - array['client', 'concept', 'operation_date']) is distinct from
     (v_invoice.fiscal_snapshot - array['client', 'concept', 'operation_date']) then
    raise exception 'No se pueden modificar el importe ni los datos de cobro.';
  end if;
  if jsonb_typeof(v_client) is distinct from 'object' or
    coalesce(btrim(v_client ->> 'fullName'), '') = '' or coalesce(btrim(v_client ->> 'nif'), '') = '' or
    coalesce(btrim(v_client ->> 'address'), '') = '' or coalesce(btrim(v_client ->> 'postalCode'), '') = '' or
    coalesce(btrim(v_client ->> 'city'), '') = '' or length(coalesce(p_snapshot ->> 'concept', '')) not between 1 and 500 or
    coalesce(btrim(p_snapshot ->> 'concept'), '') = '' or coalesce(p_snapshot ->> 'operation_date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Datos de factura no válidos.';
  end if;
  perform (p_snapshot ->> 'operation_date')::date;
  select * into v_document from public.invoice_documents where invoice_draft_id = p_invoice_id for update;
  if v_document.issued_invoice_id is distinct from v_invoice.id then raise exception 'Falta el PDF anterior.'; end if;
  if p_storage_path not like v_invoice.id::text || '/revisions/%' or coalesce(p_file_name, '') = '' then
    raise exception 'Documento no válido.';
  end if;
  insert into public.invoice_revisions(issued_invoice_id, actor_id, fiscal_snapshot, storage_path, file_name)
  values (v_invoice.id, p_actor_id, v_invoice.fiscal_snapshot, v_document.storage_path, v_document.file_name);
  perform set_config('app.editing_invoice', 'true', true);
  update public.invoice_drafts set client_snapshot = v_client, concept = p_snapshot ->> 'concept',
    operation_date = (p_snapshot ->> 'operation_date')::date where id = p_invoice_id and status = 'emitida';
  if not found then raise exception 'Factura no disponible.'; end if;
  update public.issued_invoices set fiscal_snapshot = p_snapshot where id = v_invoice.id;
  update public.invoice_documents set storage_path = p_storage_path, file_name = p_file_name,
    generated_by = p_actor_id, generated_at = now() where invoice_draft_id = p_invoice_id;
  insert into public.audit_logs(actor_id, event_type, entity_type, entity_id, data)
  values (p_actor_id, 'invoice_edited', 'issued_invoice', v_invoice.id::text, jsonb_build_object('invoice_draft_id', p_invoice_id));
  perform set_config('app.editing_invoice', 'false', true);
end;
$$;
revoke all on function public.edit_issued_invoice(uuid, uuid, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.edit_issued_invoice(uuid, uuid, jsonb, jsonb, text, text) to service_role;