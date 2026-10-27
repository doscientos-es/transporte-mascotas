create function public.create_paid_manual_carriage_letter(
  p_daily_route_id uuid, p_reference text, p_sender jsonb, p_recipient jsonb,
  p_origin_stop text, p_destination_stop text, p_origin_point text, p_destination_point text,
  p_accompanying_documents text[], p_billing_payer public.payer_type,
  p_billing_client jsonb, p_billing_total numeric, p_signature_confirmed boolean,
  p_animals jsonb, p_actions jsonb, p_box_number integer,
  p_payment_method text, p_issuer_snapshot jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_letter_id text;
  v_invoice_id uuid;
  v_payment_id uuid;
  v_issued_invoice_id uuid;
  v_total_cents integer;
  v_paid_at timestamptz := now();
begin
  if not public.is_admin() then raise exception 'Solo administración puede crear cartas de porte'; end if;
  if p_payment_method is null or p_payment_method not in ('Transferencia', 'Bizum', 'Tarjeta') then
    raise exception 'El método de cobro no es válido';
  end if;
  if coalesce(btrim(p_issuer_snapshot ->> 'name'), '') = ''
    or coalesce(btrim(p_issuer_snapshot ->> 'taxId'), '') = ''
    or coalesce(btrim(p_issuer_snapshot ->> 'address'), '') = '' then
    raise exception 'Faltan los datos fiscales del emisor';
  end if;

  v_letter_id := public.create_manual_carriage_letter(
    p_daily_route_id, p_reference, p_sender, p_recipient,
    p_origin_stop, p_destination_stop, p_origin_point, p_destination_point,
    p_accompanying_documents, p_billing_payer, p_billing_client, p_billing_total,
    p_signature_confirmed, p_animals, p_actions, p_box_number
  );

  select id, round(total_amount * 100)::integer
  into v_invoice_id, v_total_cents
  from public.invoice_drafts
  where letter_id = v_letter_id
  for update;
  if v_invoice_id is null or v_total_cents <= 0 then
    raise exception 'No se ha podido preparar la factura de la carta';
  end if;

  insert into public.invoice_payments (invoice_id, provider, merchant_order, amount_cents)
  values (
    v_invoice_id, 'manual',
    'M' || substring(replace(pg_catalog.gen_random_uuid()::text, '-', '') from 1 for 11),
    v_total_cents
  ) returning id into v_payment_id;

  v_issued_invoice_id := public.confirm_invoice_payment(
    v_payment_id,
    v_paid_at,
    jsonb_build_object('paymentMethod', p_payment_method, 'registeredAt', v_paid_at),
    p_issuer_snapshot
  );

  return jsonb_build_object(
    'letterId', v_letter_id,
    'invoiceDraftId', v_invoice_id,
    'issuedInvoiceId', v_issued_invoice_id
  );
end;
$$;

revoke all on function public.create_paid_manual_carriage_letter(
  uuid, text, jsonb, jsonb, text, text, text, text, text[], public.payer_type,
  jsonb, numeric, boolean, jsonb, jsonb, integer, text, jsonb
) from public, anon;
grant execute on function public.create_paid_manual_carriage_letter(
  uuid, text, jsonb, jsonb, text, text, text, text, text[], public.payer_type,
  jsonb, numeric, boolean, jsonb, jsonb, integer, text, jsonb
) to authenticated;

notify pgrst, 'reload schema';