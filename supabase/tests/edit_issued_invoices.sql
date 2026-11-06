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
  v_failed boolean;
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
  v_changed := jsonb_set(v_original, '{concept}', '"Updated"');
  insert into public.invoice_documents(invoice_draft_id, issued_invoice_id, storage_path, file_name)
  values (v_id, v_issued, v_issued::text || '/original.pdf', 'original.pdf');

  v_failed := false;
  begin
    perform public.edit_issued_invoice(v_id, v_user, v_original, v_changed, v_issued::text || '/revisions/test/new.pdf', 'new.pdf');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Non-admin edit accepted'; end if;
  v_failed := false;
  begin
    perform public.edit_issued_invoice(v_id, v_admin, v_original, jsonb_set(v_changed, '{total_amount}', '200'), v_issued::text || '/revisions/test/new.pdf', 'new.pdf');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Changed payment amount accepted'; end if;

  perform public.edit_issued_invoice(v_id, v_admin, v_original, v_changed, v_issued::text || '/revisions/test/new.pdf', 'new.pdf');
  if not exists (select 1 from public.invoice_revisions where issued_invoice_id = v_issued and fiscal_snapshot = v_original and storage_path = v_issued::text || '/original.pdf')
    or not exists (select 1 from public.issued_invoices where id = v_issued and fiscal_snapshot = v_changed)
    or not exists (select 1 from public.invoice_drafts where id = v_id and concept = 'Updated' and total_amount = 121)
    or not exists (select 1 from public.invoice_payments where invoice_id = v_id and amount_cents = 12100 and status = 'pagado')
    or not exists (select 1 from public.invoice_documents where invoice_draft_id = v_id and storage_path = v_issued::text || '/revisions/test/new.pdf') then
    raise exception 'Edit did not preserve history and payment or update the canonical document';
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
  if has_function_privilege('authenticated', 'public.edit_issued_invoice(uuid,uuid,jsonb,jsonb,text,text)', 'execute')
    or has_function_privilege('anon', 'public.edit_issued_invoice(uuid,uuid,jsonb,jsonb,text,text)', 'execute') then
    raise exception 'Edit RPC is exposed to clients';
  end if;
end;
$$;
rollback;