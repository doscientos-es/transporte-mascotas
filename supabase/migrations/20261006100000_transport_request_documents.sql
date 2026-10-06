-- Keep the documents the client will provide with the transport request.
alter table public.transport_requests
  add column if not exists accompanying_documents text[] not null default '{}'::text[]
  check (accompanying_documents <@ array[
    'cartilla_sanitaria', 'microchip', 'pasaporte', 'tatuaje', 'anillo', 'cites', 'otro'
  ]::text[]);

create or replace function public.submit_transport_request(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb,
  p_billing_payer public.payer_type, p_billing_client jsonb,
  p_sender_nif text, p_recipient_name text, p_recipient_nif text,
  p_recipient_phone text, p_recipient_email text,
  p_sender_address text, p_sender_postal_code text, p_sender_city text, p_sender_province text,
  p_recipient_address text, p_recipient_postal_code text, p_recipient_city text,
  p_recipient_province text, p_accompanying_documents text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
begin
  if p_accompanying_documents is null or cardinality(p_accompanying_documents) = 0
    or not p_accompanying_documents <@ array[
      'cartilla_sanitaria', 'microchip', 'pasaporte', 'tatuaje', 'anillo', 'cites', 'otro'
    ]::text[] then
    raise exception 'Selecciona al menos un documento válido para el viaje';
  end if;

  v_request_id := public.submit_transport_request(
    p_contact_name, p_contact_phone, p_contact_email, p_daily_route_id,
    p_origin, p_destination, p_desired_date, p_notes, p_animals,
    p_billing_payer, p_billing_client,
    p_sender_nif, p_recipient_name, p_recipient_nif, p_recipient_phone, p_recipient_email,
    p_sender_address, p_sender_postal_code, p_sender_city, p_sender_province,
    p_recipient_address, p_recipient_postal_code, p_recipient_city, p_recipient_province
  );
  update public.transport_requests
  set accompanying_documents = p_accompanying_documents
  where id = v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.submit_transport_request_admin(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb,
  p_billing_payer public.payer_type, p_billing_client jsonb,
  p_sender_nif text, p_recipient_name text, p_recipient_nif text,
  p_recipient_phone text, p_recipient_email text,
  p_sender_address text, p_sender_postal_code text, p_sender_city text, p_sender_province text,
  p_recipient_address text, p_recipient_postal_code text, p_recipient_city text,
  p_recipient_province text, p_accompanying_documents text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede crear solicitudes manuales';
  end if;
  v_request_id := public.submit_transport_request(
    p_contact_name, p_contact_phone, p_contact_email, p_daily_route_id,
    p_origin, p_destination, p_desired_date, p_notes, p_animals,
    p_billing_payer, p_billing_client,
    p_sender_nif, p_recipient_name, p_recipient_nif, p_recipient_phone, p_recipient_email,
    p_sender_address, p_sender_postal_code, p_sender_city, p_sender_province,
    p_recipient_address, p_recipient_postal_code, p_recipient_city, p_recipient_province,
    p_accompanying_documents
  );
  update public.transport_requests
  set status = 'por_verificar',
      payment_reference = 'admin_manual',
      admin_note = 'Creada manualmente por administración'
  where id = v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.submit_transport_request(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.submit_transport_request_admin(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

revoke all on function public.submit_transport_request(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text, text[]
) from public, anon;
grant execute on function public.submit_transport_request(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text, text[]
) to authenticated;
revoke all on function public.submit_transport_request_admin(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text, text[]
) from public, anon;
grant execute on function public.submit_transport_request_admin(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text, text[]
) to authenticated;

notify pgrst, 'reload schema';