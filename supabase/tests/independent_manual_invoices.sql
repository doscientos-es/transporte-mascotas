-- Run only in a test database, after migrations, as a database administrator.
-- All fixtures, invoice numbers, payments and audit events are rolled back.
begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_driver uuid := gen_random_uuid();
  v_id uuid := gen_random_uuid();
  v_other_id uuid := gen_random_uuid();
  v_client jsonb := '{"fullName":"Free invoice test","nif":"FREE-TEST","address":"Test address","postalCode":"08001","city":"Test city"}';
  v_issuer jsonb := '{"name":"Test issuer","taxId":"TEST","address":"Test address"}';
  v_first jsonb;
  v_second jsonb;
  v_snapshot jsonb;
  v_list jsonb;
  v_counter integer;
  v_failed boolean;
begin
  insert into auth.users (id) values (v_admin), (v_driver);
  insert into public.profiles (id, display_name, role, active)
  values (v_admin, 'Invoice test admin', 'admin', true), (v_driver, 'Invoice test driver', 'transportista', true)
  on conflict (id) do update set role = excluded.role, active = true;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role', 'user_role', 'admin', 'sub', v_admin)::text, true);

  v_first := public.create_paid_manual_invoice(v_id, v_admin, v_client, 'Servicio extra', 121, current_date, 'Transferencia', v_issuer);
  select fiscal_snapshot into v_snapshot from public.issued_invoices where id = (v_first ->> 'issuedInvoiceId')::uuid;
  if not exists (select 1 from public.invoice_drafts where id = v_id and letter_id is null
    and status = 'emitida' and net_amount = 100 and vat_amount = 21 and total_amount = 121)
    or not exists (select 1 from public.invoice_payments where invoice_id = v_id and status = 'pagado' and amount_cents = 12100)
    or v_snapshot ->> 'operation_date' is distinct from current_date::text
    or v_snapshot ->> 'payment_method' is distinct from 'Transferencia'
    or coalesce(v_snapshot ->> 'number', '') = '' then
    raise exception 'Free invoice did not persist its fiscal snapshot and paid status';
  end if;

  v_list := public.list_invoice_page(p_status := 'emitida', p_client_id := (
    select client_id from public.invoice_drafts where id = v_id
  ));
  if not exists (select 1 from jsonb_array_elements(v_list -> 'items') item
    where item ->> 'id' = v_id::text and item -> 'letter_id' = 'null'::jsonb
      and item ->> 'issued_number' = v_snapshot ->> 'number') then
    raise exception 'Issued free invoice is missing from the invoice/client listing';
  end if;

  select last_number into v_counter from public.invoice_series_counters
  where series = 'F' and fiscal_year = extract(year from now() at time zone 'Europe/Madrid');
  v_second := public.create_paid_manual_invoice(v_id, v_admin, v_client, 'Servicio extra', 121, current_date, 'Transferencia', v_issuer);
  if v_first is distinct from v_second
    or (select count(*) from public.invoice_payments where invoice_id = v_id) <> 1
    or (select count(*) from public.issued_invoices where invoice_draft_id = v_id) <> 1
    or (select last_number from public.invoice_series_counters where series = 'F'
      and fiscal_year = extract(year from now() at time zone 'Europe/Madrid')) is distinct from v_counter then
    raise exception 'Retry duplicated the payment, invoice or sequence number';
  end if;

  -- A reused id cannot silently confirm different fiscal data.
  v_failed := false;
  begin
    perform public.create_paid_manual_invoice(v_id, v_admin, v_client, 'Changed', 121, current_date, 'Transferencia', v_issuer);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Accepted changed data for an existing invoice'; end if;

  -- Independent invoices use the same immutable fiscal document protections.
  v_failed := false;
  begin
    update public.invoice_drafts set concept = 'Changed' where id = v_id;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Issued invoice was mutable'; end if;

  -- A second free invoice for the same client is allowed (NULL letter uniqueness).
  perform public.create_paid_manual_invoice(v_other_id, v_admin, v_client, 'Otro extra', 0.01, current_date, 'Bizum', v_issuer);
  if not exists (select 1 from public.invoice_drafts where id = v_other_id and total_amount = net_amount + vat_amount) then
    raise exception 'Second free invoice or cent rounding failed';
  end if;

  -- An issuance failure must roll back draft, client changes, payment and number.
  v_other_id := gen_random_uuid();
  v_failed := false;
  begin
    perform public.create_paid_manual_invoice(v_other_id, v_admin, v_client, 'Bad issuer', 121, current_date, 'Tarjeta', '{}');
  exception when others then v_failed := true;
  end;
  if not v_failed or exists (select 1 from public.invoice_drafts where id = v_other_id)
    or exists (select 1 from public.invoice_payments where invoice_id = v_other_id) then
    raise exception 'Failed issuance left partial records';
  end if;

  v_failed := false;
  begin
    perform public.create_paid_manual_invoice(gen_random_uuid(), v_driver, v_client, 'Unauthorized', 121, current_date, 'Tarjeta', v_issuer);
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'Non-admin actor created an invoice'; end if;

  v_failed := false;
  begin
    perform public.create_paid_manual_invoice(gen_random_uuid(), v_admin, v_client, 'Invalid amount', 1.001, current_date, 'Tarjeta', v_issuer);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Server accepted more than two decimals'; end if;

  v_failed := false;
  begin
    perform public.create_paid_manual_invoice(gen_random_uuid(), v_admin, v_client - 'nif', 'Missing fiscal data', 121, current_date, 'Tarjeta', v_issuer);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Server accepted missing fiscal data'; end if;

  if has_function_privilege('anon', 'public.create_paid_manual_invoice(uuid,uuid,jsonb,text,numeric,date,text,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.create_paid_manual_invoice(uuid,uuid,jsonb,text,numeric,date,text,jsonb)', 'execute') then
    raise exception 'Free invoice RPC is exposed outside the server';
  end if;
end;
$$;

rollback;