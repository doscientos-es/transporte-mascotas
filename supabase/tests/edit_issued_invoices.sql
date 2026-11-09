-- Run on a disposable database after migrations. Everything is rolled back.
begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_id uuid := gen_random_uuid();
  v_result jsonb;
  v_issued uuid;
  v_original jsonb;
  v_changed jsonb;
  v_inconsistent jsonb;
  v_failed boolean;
  v_extra_payment uuid;
  v_transport_invoice uuid := gen_random_uuid();
  v_transport_issued uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_letter text := 'CARTA DE PORTE Nº TEST-' || gen_random_uuid()::text;
  v_gateway jsonb := '{"amountCents":"12100","response":"0000"}';
  v_client jsonb := '{"fullName":"Test client","nif":"TEST","address":"Test","postalCode":"08001","city":"Test"}';
begin
  insert into auth.users(id) values (v_admin), (v_user);
  insert into public.profiles(id, display_name, role, active) values
    (v_admin, 'Test admin', 'admin', true), (v_user, 'Test user', 'user', true)
    on conflict (id) do update set role = excluded.role, active = true;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role', 'user_role', 'admin', 'sub', v_admin)::text, true);
  v_result := public.create_paid_manual_invoice(v_id, v_admin, v_client, 'Original', 121, current_date, 'Tarjeta', '{"name":"Issuer","taxId":"TEST","address":"Test"}');
  v_issued := (v_result ->> 'issuedInvoiceId')::uuid;
  select fiscal_snapshot into v_original from public.issued_invoices where id = v_issued;
  v_changed := v_original || '{"concept":"Updated","total_amount":242,"net_amount":200,"vat_amount":42}'::jsonb;
  v_inconsistent := v_changed || '{"vat_amount":21}'::jsonb;
  insert into public.invoice_documents(invoice_draft_id, issued_invoice_id, storage_path, file_name)
  values (v_id, v_issued, v_issued::text || '/original.pdf', 'original.pdf');

  v_failed := false;
  begin
    perform public.edit_issued_invoice(v_id, v_user, v_original, v_changed, v_issued::text || '/revisions/test/new.pdf', 'new.pdf');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Non-admin edit accepted'; end if;
  v_failed := false;
  begin
    perform public.edit_issued_invoice(v_id, v_admin, v_original, v_inconsistent, v_issued::text || '/revisions/test/new.pdf', 'new.pdf');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Inconsistent VAT accepted'; end if;

  update public.invoice_payments set amount_cents = 12000 where invoice_id = v_id;
  v_failed := false;
  begin
    perform public.edit_issued_invoice(v_id, v_admin, v_original, v_changed, v_issued::text || '/revisions/test/new.pdf', 'new.pdf');
  exception when others then
    if sqlerrm <> 'No se ha podido identificar un único cobro coincidente con la factura.' then raise; end if;
    v_failed := true;
  end;
  if not v_failed then raise exception 'Mismatched payment accepted'; end if;
  update public.invoice_payments set amount_cents = 12100 where invoice_id = v_id;
  insert into public.invoice_payments(invoice_id, provider, merchant_order, amount_cents, status)
  values (v_id, 'caixabank_cyberpac', 'T' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 11), 12100, 'pagado')
  returning id into v_extra_payment;
  v_failed := false;
  begin
    perform public.edit_issued_invoice(v_id, v_admin, v_original, v_changed, v_issued::text || '/revisions/test/new.pdf', 'new.pdf');
  exception when others then
    if sqlerrm <> 'No se ha podido identificar un único cobro coincidente con la factura.' then raise; end if;
    v_failed := true;
  end;
  if not v_failed then raise exception 'Ambiguous payments accepted'; end if;
  delete from public.invoice_payments where id = v_extra_payment;

  perform public.edit_issued_invoice(v_id, v_admin, v_original, v_changed, v_issued::text || '/revisions/test/new.pdf', 'new.pdf');
  if not exists (select 1 from public.invoice_revisions where issued_invoice_id = v_issued and fiscal_snapshot = v_original and storage_path = v_issued::text || '/original.pdf')
    or not exists (select 1 from public.issued_invoices where id = v_issued and fiscal_snapshot = v_changed)
    or not exists (select 1 from public.invoice_drafts where id = v_id and concept = 'Updated' and net_amount = 200 and vat_amount = 42 and total_amount = 242)
    or not exists (select 1 from public.invoice_payments where invoice_id = v_id and amount_cents = 24200 and status = 'pagado')
    or not exists (select 1 from public.audit_logs where entity_id = v_issued::text and event_type = 'invoice_edited'
      and data ->> 'previous_payment_cents' = '12100' and data ->> 'new_payment_cents' = '24200')
    or not exists (select 1 from public.invoice_documents where invoice_draft_id = v_id and storage_path = v_issued::text || '/revisions/test/new.pdf') then
    raise exception 'Edit did not preserve history and synchronize the payment and document';
  end if;
  v_failed := false;
  begin
    perform public.edit_issued_invoice(v_id, v_admin, v_original, v_changed, v_issued::text || '/revisions/test/other.pdf', 'other.pdf');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Stale edit accepted'; end if;
  v_failed := false;
  begin
    update public.invoice_documents set storage_path = v_issued::text || '/stale.pdf' where invoice_draft_id = v_id;
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Stale document replaced current PDF'; end if;

  -- A self-service transport invoice stores its confirmed payment on the request.
  insert into public.carriage_letters(id, original_filename, storage_path, service_date)
  values (v_letter, 'test.pdf', v_letter || '/test.pdf', current_date);
  insert into public.transport_requests(id, requester_id, origin_text, destination_text, desired_date,
    amount_cents, status, paid_at, payment_gateway_response, letter_id)
  values (v_request, v_admin, 'Origen', 'Destino', current_date, 12100, 'confirmada', now(), v_gateway, v_letter);
  insert into public.invoice_drafts(id, letter_id, payer, client_snapshot, concept, net_amount, vat_rate,
    vat_amount, total_amount, status, created_by, operation_date)
  values (v_transport_invoice, v_letter, 'manual', v_client, 'Original', 100, 21, 21, 121, 'emitida', v_admin, current_date);
  v_original := v_original || jsonb_build_object('gateway_response', v_gateway);
  insert into public.issued_invoices(id, invoice_draft_id, fiscal_year, sequence_number, issued_at, fiscal_snapshot)
  values (v_transport_issued, v_transport_invoice, 2099,
    (select coalesce(max(sequence_number), 0) + 1 from public.issued_invoices where series = 'F' and fiscal_year = 2099),
    now(), v_original);
  insert into public.invoice_documents(invoice_draft_id, issued_invoice_id, storage_path, file_name)
  values (v_transport_invoice, v_transport_issued, v_transport_issued::text || '/original.pdf', 'original.pdf');
  v_changed := v_original || '{"total_amount":242,"net_amount":200,"vat_amount":42}'::jsonb;
  v_failed := false;
  begin
    update public.transport_requests set amount_cents = 24200 where id = v_request;
  exception when others then
    if sqlerrm <> 'Una solicitud pagada no admite cambios de importe' then raise; end if;
    v_failed := true;
  end;
  if not v_failed then raise exception 'Direct update of a paid request accepted'; end if;
  perform public.edit_issued_invoice(v_transport_invoice, v_admin, v_original, v_changed,
    v_transport_issued::text || '/revisions/test/new.pdf', 'new.pdf');
  if not exists (select 1 from public.transport_requests where id = v_request and amount_cents = 24200
      and payment_gateway_response = v_gateway and paid_at is not null)
    or not exists (select 1 from public.audit_logs where entity_id = v_transport_issued::text
      and data ->> 'previous_payment_cents' = '12100' and data ->> 'new_payment_cents' = '24200') then
    raise exception 'Transport payment correction lost its bank response or audit history';
  end if;
  if has_function_privilege('authenticated', 'public.edit_issued_invoice(uuid,uuid,jsonb,jsonb,text,text)', 'execute')
    or has_function_privilege('anon', 'public.edit_issued_invoice(uuid,uuid,jsonb,jsonb,text,text)', 'execute') then
    raise exception 'Edit RPC is exposed to clients';
  end if;
end;
$$;
rollback;