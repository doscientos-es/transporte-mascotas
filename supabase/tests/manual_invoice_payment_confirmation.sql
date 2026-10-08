-- Run with a database-administrator connection. The test invoice is rolled back.
begin;

do $$
declare
  letter_id text := 'CARTA DE PORTE Nº COBRO-TEST';
  invoice_id uuid;
  payment_id uuid;
  issued_id uuid;
  invoice_status text;
  payment_status text;
  recorded_method text;
begin
  insert into public.carriage_letters (id, service_date, entry_source)
  values (letter_id, current_date, 'manual');

  insert into public.invoice_drafts (
    letter_id, payer, client_snapshot, concept, net_amount, vat_rate, vat_amount,
    total_amount, status
  ) values (
    letter_id, 'manual',
    '{"fullName":"Test","nif":"TEST","address":"Test address","postalCode":"00000","city":"Test city"}',
    'Prueba de cobro manual', 100, 21, 21, 121, 'solicitud_pago'
  ) returning id into invoice_id;

  insert into public.invoice_payments (invoice_id, provider, merchant_order, amount_cents)
  values (invoice_id, 'manual', 'TESTPAY00001', 12100)
  returning id into payment_id;

  issued_id := public.confirm_invoice_payment(
    payment_id,
    now(),
    '{"paymentMethod":"Transferencia"}',
    '{"name":"Test issuer","taxId":"TEST","address":"Test address"}'
  );

  select status into invoice_status from public.invoice_drafts where id = invoice_id;
  select status into payment_status from public.invoice_payments where id = payment_id;
  select fiscal_snapshot ->> 'payment_method'
  into recorded_method from public.issued_invoices where id = issued_id;

  if issued_id is null or invoice_status is distinct from 'emitida'
    or payment_status is distinct from 'pagado'
    or recorded_method is distinct from 'Transferencia' then
    raise exception 'Manual payment confirmation did not issue the invoice and record its payment';
  end if;
end;
$$;

rollback;