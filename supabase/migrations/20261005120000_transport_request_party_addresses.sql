-- Store complete sender and recipient addresses on every portal request.
alter table public.transport_requests
  add column if not exists sender_address text not null default '',
  add column if not exists sender_postal_code text not null default '',
  add column if not exists sender_city text not null default '',
  add column if not exists sender_province text not null default '',
  add column if not exists recipient_address text not null default '',
  add column if not exists recipient_postal_code text not null default '',
  add column if not exists recipient_city text not null default '',
  add column if not exists recipient_province text not null default '';

-- New overload requires both complete party addresses. Older callable overloads
-- are revoked below so new requests cannot bypass address validation.
create or replace function public.submit_transport_request(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb,
  p_billing_payer public.payer_type, p_billing_client jsonb,
  p_sender_nif text, p_recipient_name text, p_recipient_nif text,
  p_recipient_phone text, p_recipient_email text,
  p_sender_address text, p_sender_postal_code text, p_sender_city text, p_sender_province text,
  p_recipient_address text, p_recipient_postal_code text, p_recipient_city text, p_recipient_province text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
  v_billing_client jsonb;
begin
  if exists (
    select 1 from (values
      (p_sender_address), (p_sender_postal_code), (p_sender_city), (p_sender_province),
      (p_recipient_address), (p_recipient_postal_code), (p_recipient_city), (p_recipient_province)
    ) as required(value) where nullif(btrim(value), '') is null
  ) then
    raise exception 'Completa la dirección, el código postal, la localidad y la provincia de ambas personas';
  end if;
  if coalesce(btrim(p_recipient_email), '') = ''
    or btrim(p_recipient_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Escribe un correo válido para quien recibe';
  end if;

  if p_billing_payer = 'remitente' then
    v_billing_client := jsonb_build_object(
      'fullName', btrim(p_contact_name), 'nif', btrim(p_sender_nif),
      'email', btrim(p_contact_email), 'phone', btrim(p_contact_phone),
      'address', btrim(p_sender_address), 'city', btrim(p_sender_city),
      'postalCode', btrim(p_sender_postal_code)
    );
  elsif p_billing_payer = 'destinatario' then
    v_billing_client := jsonb_build_object(
      'fullName', btrim(p_recipient_name), 'nif', btrim(p_recipient_nif),
      'email', btrim(p_recipient_email), 'phone', btrim(p_recipient_phone),
      'address', btrim(p_recipient_address), 'city', btrim(p_recipient_city),
      'postalCode', btrim(p_recipient_postal_code)
    );
  elsif p_billing_payer = 'manual' then
    v_billing_client := p_billing_client;
  else
    raise exception 'El pagador indicado no es válido';
  end if;

  v_request_id := public.submit_transport_request(
    p_contact_name, p_contact_phone, p_contact_email, p_daily_route_id,
    p_origin, p_destination, p_desired_date, p_notes, p_animals,
    p_billing_payer, v_billing_client,
    p_sender_nif, p_recipient_name, p_recipient_nif, p_recipient_phone, p_recipient_email
  );
  update public.transport_requests
  set sender_address = btrim(p_sender_address),
      sender_postal_code = btrim(p_sender_postal_code),
      sender_city = btrim(p_sender_city),
      sender_province = btrim(p_sender_province),
      recipient_address = btrim(p_recipient_address),
      recipient_postal_code = btrim(p_recipient_postal_code),
      recipient_city = btrim(p_recipient_city),
      recipient_province = btrim(p_recipient_province)
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
  p_recipient_address text, p_recipient_postal_code text, p_recipient_city text, p_recipient_province text
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
    p_recipient_address, p_recipient_postal_code, p_recipient_city, p_recipient_province
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
  text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.submit_transport_request_admin(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text
) from public, anon, authenticated;

revoke all on function public.submit_transport_request(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.submit_transport_request(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;
revoke all on function public.submit_transport_request_admin(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.submit_transport_request_admin(
  text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

-- The finalization flows link a carriage letter to the request; copy the exact
-- party addresses at that point so the transport document has complete details.
create or replace function public.copy_transport_request_parties_to_letter()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.letter_id is not null and new.letter_id is distinct from old.letter_id
    and new.recipient_name <> '' then
    update public.carriage_letters
    set sender_nif = new.sender_nif,
        sender_address = new.sender_address,
        sender_postal_code = new.sender_postal_code,
        sender_city = new.sender_city,
        sender_province = new.sender_province,
        recipient_name = new.recipient_name,
        recipient_nif = new.recipient_nif,
        recipient_phone = new.recipient_phone,
        recipient_email = new.recipient_email,
        recipient_address = new.recipient_address,
        recipient_postal_code = new.recipient_postal_code,
        recipient_city = new.recipient_city,
        recipient_province = new.recipient_province
    where id = new.letter_id;
  end if;
  return new;
end;
$$;

revoke all on function public.copy_transport_request_parties_to_letter() from public, anon, authenticated;
notify pgrst, 'reload schema';