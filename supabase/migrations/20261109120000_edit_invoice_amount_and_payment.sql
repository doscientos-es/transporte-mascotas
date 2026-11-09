-- A registered amount may be corrected by the invoice editor, but the bank's
-- original response remains untouched and the previous amounts are audited.
create or replace function public.validate_transport_request_payment_amount()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_received_amount text;
begin
  if new.amount_cents is distinct from old.amount_cents then
    if old.paid_at is not null then
      if current_setting('app.adjusting_transport_payment', true) = old.id::text
        and new.paid_at is not distinct from old.paid_at
        and new.payment_gateway_response is not distinct from old.payment_gateway_response
        and new.status is not distinct from old.status then
        return new;
      end if;
      raise exception 'Una solicitud pagada no admite cambios de importe';
    end if;
    if new.status not in ('pago_pendiente', 'por_verificar') then
      raise exception 'La solicitud ya no admite cambios de importe';
    end if;
    if new.amount_cents <> public.transport_request_total_cents(new.id) then
      raise exception 'El importe de la solicitud no coincide con los boxes asignados';
    end if;
  end if;
  if new.paid_at is not null and (
    new.paid_at is distinct from old.paid_at
    or new.payment_gateway_response is distinct from old.payment_gateway_response
  ) then
    if not coalesce(new.payment_gateway_response ? 'amountCents', false) then
      raise exception 'El importe confirmado no coincide con el importe de la solicitud';
    end if;
    v_received_amount := new.payment_gateway_response ->> 'amountCents';
    if coalesce(v_received_amount, '') !~ '^[0-9]+$' then
      raise exception 'El importe confirmado no coincide con el importe de la solicitud';
    end if;
    if v_received_amount::numeric <> new.amount_cents then
      raise exception 'El importe confirmado no coincide con el importe de la solicitud';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.edit_issued_invoice(
  p_invoice_id uuid, p_actor_id uuid, p_expected_snapshot jsonb, p_snapshot jsonb,
  p_storage_path text, p_file_name text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_invoice public.issued_invoices;
  v_draft public.invoice_drafts;
  v_document public.invoice_documents;
  v_client jsonb := p_snapshot -> 'client';
  v_total numeric;
  v_net numeric;
  v_vat numeric;
  v_payment record;
  v_payment_id uuid;
  v_request_id uuid;
  v_payment_count integer := 0;
  v_previous_cents integer;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin' and active) then
    raise exception 'Solo administración puede editar facturas.';
  end if;
  select * into v_invoice from public.issued_invoices where invoice_draft_id = p_invoice_id for update;
  if v_invoice.id is null then raise exception 'Factura no encontrada.'; end if;
  if v_invoice.fiscal_snapshot is distinct from p_expected_snapshot then
    raise exception 'La factura ha cambiado; actualiza la página.';
  end if;
  if (p_snapshot - array['client', 'concept', 'operation_date', 'net_amount', 'vat_amount', 'total_amount']) is distinct from
     (v_invoice.fiscal_snapshot - array['client', 'concept', 'operation_date', 'net_amount', 'vat_amount', 'total_amount']) then
    raise exception 'No se pueden modificar los datos de cobro ni el tipo de IVA.';
  end if;
  if jsonb_typeof(v_client) is distinct from 'object' or
    coalesce(btrim(v_client ->> 'fullName'), '') = '' or coalesce(btrim(v_client ->> 'nif'), '') = '' or
    coalesce(btrim(v_client ->> 'address'), '') = '' or coalesce(btrim(v_client ->> 'postalCode'), '') = '' or
    coalesce(btrim(v_client ->> 'city'), '') = '' or length(coalesce(p_snapshot ->> 'concept', '')) not between 1 and 500 or
    coalesce(btrim(p_snapshot ->> 'concept'), '') = '' or coalesce(p_snapshot ->> 'operation_date', '') !~ '^\d{4}-\d{2}-\d{2}$' or
    jsonb_typeof(p_snapshot -> 'total_amount') is distinct from 'number' or
    jsonb_typeof(p_snapshot -> 'net_amount') is distinct from 'number' or
    jsonb_typeof(p_snapshot -> 'vat_amount') is distinct from 'number' then
    raise exception 'Datos de factura no válidos.';
  end if;
  perform (p_snapshot ->> 'operation_date')::date;
  select * into v_draft from public.invoice_drafts where id = p_invoice_id and status = 'emitida' for update;
  if v_draft.id is null then raise exception 'Factura no disponible.'; end if;
  v_total := (p_snapshot ->> 'total_amount')::numeric;
  v_net := (p_snapshot ->> 'net_amount')::numeric;
  v_vat := (p_snapshot ->> 'vat_amount')::numeric;
  if v_total <= 0 or v_total > 999999.99 or v_total <> round(v_total, 2)
    or v_net < 0 or v_vat < 0 or v_net + v_vat <> v_total then
    raise exception 'Importe de factura no válido.';
  end if;
  if v_total is distinct from v_draft.total_amount then
    if v_net <> round(v_total / (1 + v_draft.vat_rate / 100), 2)
      or v_vat <> v_total - v_net then
      raise exception 'El desglose del IVA no coincide con el total.';
    end if;
    for v_payment in select id, amount_cents from public.invoice_payments
      where invoice_id = p_invoice_id and status = 'pagado' for update loop
      v_payment_count := v_payment_count + 1;
      v_payment_id := v_payment.id;
      v_previous_cents := v_payment.amount_cents;
    end loop;
    if v_invoice.fiscal_snapshot ? 'gateway_response' and v_draft.letter_id is not null then
      for v_payment in select id, amount_cents from public.transport_requests
        where letter_id = v_draft.letter_id and paid_at is not null for update loop
        v_payment_count := v_payment_count + 1;
        v_request_id := v_payment.id;
        v_previous_cents := v_payment.amount_cents;
      end loop;
    end if;
    if v_payment_count <> 1 or v_previous_cents is distinct from round(v_draft.total_amount * 100)::integer then
      raise exception 'No se ha podido identificar un único cobro coincidente con la factura.';
    end if;
  elsif v_net is distinct from v_draft.net_amount or v_vat is distinct from v_draft.vat_amount then
    raise exception 'El desglose de la factura no coincide con el importe.';
  end if;
  select * into v_document from public.invoice_documents where invoice_draft_id = p_invoice_id for update;
  if v_document.issued_invoice_id is distinct from v_invoice.id then raise exception 'Falta el PDF anterior.'; end if;
  if p_storage_path not like v_invoice.id::text || '/revisions/%' or coalesce(p_file_name, '') = '' then
    raise exception 'Documento no válido.';
  end if;
  insert into public.invoice_revisions(issued_invoice_id, actor_id, fiscal_snapshot, storage_path, file_name)
  values (v_invoice.id, p_actor_id, v_invoice.fiscal_snapshot, v_document.storage_path, v_document.file_name);
  perform set_config('app.editing_invoice', 'true', true);
  update public.invoice_drafts set client_snapshot = v_client, concept = p_snapshot ->> 'concept',
    operation_date = (p_snapshot ->> 'operation_date')::date, net_amount = v_net,
    vat_amount = v_vat, total_amount = v_total where id = p_invoice_id;
  if v_payment_id is not null then
    update public.invoice_payments set amount_cents = (v_total * 100)::integer where id = v_payment_id;
  elsif v_request_id is not null then
    perform set_config('app.adjusting_transport_payment', v_request_id::text, true);
    update public.transport_requests set amount_cents = (v_total * 100)::integer where id = v_request_id;
    perform set_config('app.adjusting_transport_payment', '', true);
  end if;
  update public.issued_invoices set fiscal_snapshot = p_snapshot where id = v_invoice.id;
  update public.invoice_documents set storage_path = p_storage_path, file_name = p_file_name,
    generated_by = p_actor_id, generated_at = now() where invoice_draft_id = p_invoice_id;
  insert into public.audit_logs(actor_id, event_type, entity_type, entity_id, data)
  values (p_actor_id, 'invoice_edited', 'issued_invoice', v_invoice.id::text,
    jsonb_build_object('invoice_draft_id', p_invoice_id, 'payment_id', v_payment_id,
      'transport_request_id', v_request_id, 'previous_payment_cents', v_previous_cents,
      'new_payment_cents', case when v_previous_cents is null then null else (v_total * 100)::integer end));
  perform set_config('app.editing_invoice', 'false', true);
end;
$$;