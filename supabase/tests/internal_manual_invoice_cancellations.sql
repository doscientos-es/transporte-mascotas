-- Run on a disposable database after migrations. Everything is rolled back.
begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_invoice uuid := gen_random_uuid();
  v_transport_invoice uuid := gen_random_uuid();
  v_transport_issued uuid := gen_random_uuid();
  v_issued uuid;
  v_snapshot jsonb;
  v_result jsonb;
  v_page jsonb;
  v_failed boolean;
  v_letter text := 'CARTA DE PORTE Nº CANCEL-TEST-' || gen_random_uuid()::text;
  v_client jsonb := '{"fullName":"Test client","nif":"TEST","address":"Test","postalCode":"08001","city":"Test"}';
begin
  insert into auth.users(id) values (v_admin), (v_user);
  insert into public.profiles(id, display_name, role, active) values
    (v_admin, 'Test admin', 'admin', true), (v_user, 'Test user', 'user', true)
    on conflict (id) do update set role = excluded.role, active = true;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role', 'user_role', 'admin', 'sub', v_admin)::text, true);
  v_result := public.create_paid_manual_invoice(v_invoice, v_admin, v_client, 'Test', 121,
    current_date, 'Tarjeta', '{"name":"Issuer","taxId":"TEST","address":"Test"}');
  v_issued := (v_result ->> 'issuedInvoiceId')::uuid;
  select fiscal_snapshot into v_snapshot from public.issued_invoices where id = v_issued;

  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'user_role', 'user', 'sub', v_user)::text, true);
  v_failed := false;
  begin perform public.cancel_manual_invoice(v_invoice, v_snapshot, 'Duplicada');
  exception when insufficient_privilege then v_failed := true; end;
  if not v_failed then raise exception 'Non-admin cancellation accepted'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'user_role', 'admin', 'sub', v_admin)::text, true);

  v_failed := false;
  begin perform public.cancel_manual_invoice(v_invoice, v_snapshot || '{"concept":"Stale"}', 'Duplicada');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Stale invoice cancellation accepted'; end if;
  v_failed := false;
  begin perform public.cancel_manual_invoice(v_invoice, v_snapshot, '  ');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Empty reason accepted'; end if;

  insert into public.carriage_letters(id, original_filename, storage_path, service_date)
  values (v_letter, 'test.pdf', v_letter || '/test.pdf', current_date);
  insert into public.invoice_drafts(id, letter_id, payer, client_snapshot, concept, net_amount,
    vat_rate, vat_amount, total_amount, status, created_by)
  values (v_transport_invoice, v_letter, 'manual', v_client, 'Test', 100, 21, 21, 121, 'emitida', v_admin);
  insert into public.issued_invoices(id, invoice_draft_id, fiscal_year, sequence_number, issued_at, fiscal_snapshot)
  values (v_transport_issued, v_transport_invoice, 2099,
    (select coalesce(max(sequence_number), 0) + 1 from public.issued_invoices where series = 'F' and fiscal_year = 2099), now(), v_snapshot);
  insert into public.invoice_payments(invoice_id, provider, merchant_order, amount_cents, status)
  values (v_transport_invoice, 'manual', 'M' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 11), 12100, 'pagado');
  v_failed := false;
  begin perform public.cancel_manual_invoice(v_transport_invoice, v_snapshot, 'Duplicada');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Transport invoice cancellation accepted'; end if;

  perform public.cancel_manual_invoice(v_invoice, v_snapshot, '  Duplicada  ');
  if not exists (select 1 from public.manual_invoice_cancellations where issued_invoice_id = v_issued and actor_id = v_admin and reason = 'Duplicada')
    or not exists (select 1 from public.issued_invoices where id = v_issued and fiscal_snapshot = v_snapshot)
    or not exists (select 1 from public.invoice_payments where invoice_id = v_invoice and status = 'pagado' and amount_cents = 12100)
    or not exists (select 1 from public.audit_logs where entity_id = v_issued::text and event_type = 'manual_invoice_cancelled_internally')
    or not exists (select 1 from public.list_finance_income(null, null) where issued_invoice_id = v_issued and cancelled_at is not null and vat_amount = 21) then
    raise exception 'Cancellation must preserve the invoice, payment, VAT and audit history';
  end if;
  v_page := public.list_invoice_page(null, 'emitida', null, null, null, 'date', 'desc', 1, 100000);
  if not exists (select 1 from jsonb_array_elements(v_page -> 'items') row
    where row ->> 'issued_invoice_id' = v_issued::text and row ->> 'cancellation_reason' = 'Duplicada' and row ->> 'cancelled_at' is not null) then
    raise exception 'Cancelled invoice is missing from invoice history';
  end if;
  v_failed := false;
  begin perform public.cancel_manual_invoice(v_invoice, v_snapshot, 'Duplicada');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Duplicate cancellation accepted'; end if;
  v_failed := false;
  begin
    perform set_config('app.editing_invoice', 'true', true);
    update public.invoice_drafts set concept = 'Changed' where id = v_invoice;
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Cancelled invoice edit accepted'; end if;
end;
$$;
rollback;