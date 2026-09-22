-- Administration can create the same transport request as the client portal
-- without sending it through the payment gateway.
create or replace function public.submit_transport_request_admin(
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text,
  p_daily_route_id uuid,
  p_origin text,
  p_destination text,
  p_desired_date date,
  p_notes text,
  p_animals jsonb,
  p_billing_payer public.payer_type,
  p_billing_client jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede crear solicitudes manuales';
  end if;

  v_request_id := public.submit_transport_request(
    p_contact_name,
    p_contact_phone,
    p_contact_email,
    p_daily_route_id,
    p_origin,
    p_destination,
    p_desired_date,
    p_notes,
    p_animals,
    p_billing_payer,
    p_billing_client
  );

  update public.transport_requests
  set status = 'por_verificar',
      payment_reference = 'admin_manual',
      admin_note = 'Creada manualmente por administración'
  where id = v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.submit_transport_request_admin(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb
) from public, anon;
grant execute on function public.submit_transport_request_admin(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb
) to authenticated;

notify pgrst, 'reload schema';