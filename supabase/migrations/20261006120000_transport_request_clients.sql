-- Every person named on a transport request (sender, recipient and payer) is
-- saved in the clients directory, so we can count how many services each one
-- has sent, received or paid, whoever ended up paying.
alter table public.transport_requests
  add column if not exists sender_client_id uuid references public.clients(id) on delete set null,
  add column if not exists recipient_client_id uuid references public.clients(id) on delete set null,
  add column if not exists payer_client_id uuid references public.clients(id) on delete set null;

create index if not exists transport_requests_sender_client_idx on public.transport_requests (sender_client_id);
create index if not exists transport_requests_recipient_client_idx on public.transport_requests (recipient_client_id);
create index if not exists transport_requests_payer_client_idx on public.transport_requests (payer_client_id);

-- Finds a client by NIF (or by name) and creates it when missing. Existing data
-- is never overwritten: only blank fields are completed.
create or replace function public.upsert_client_from_party(
  p_name text, p_nif text, p_email text, p_phone text,
  p_address text, p_city text, p_postal_code text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_nif text := upper(btrim(coalesce(p_nif, '')));
  v_id uuid;
begin
  if v_name = '' then
    return null;
  end if;
  if v_nif <> '' then
    select id into v_id from public.clients
    where upper(btrim(nif)) = v_nif order by created_at limit 1;
  end if;
  if v_id is null then
    insert into public.clients (full_name, nif, email, phone, address, city, postal_code)
    values (v_name, v_nif, btrim(coalesce(p_email, '')), btrim(coalesce(p_phone, '')),
      btrim(coalesce(p_address, '')), btrim(coalesce(p_city, '')), btrim(coalesce(p_postal_code, '')))
    on conflict (normalized_name) do update set full_name = public.clients.full_name
    returning id into v_id;
  end if;
  update public.clients set
    nif = case when nif = '' then v_nif else nif end,
    email = case when email = '' then btrim(coalesce(p_email, '')) else email end,
    phone = case when phone = '' then btrim(coalesce(p_phone, '')) else phone end,
    address = case when address = '' then btrim(coalesce(p_address, '')) else address end,
    city = case when city = '' then btrim(coalesce(p_city, '')) else city end,
    postal_code = case when postal_code = '' then btrim(coalesce(p_postal_code, '')) else postal_code end
  where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.upsert_client_from_party(text, text, text, text, text, text, text)
  from public, anon, authenticated;

-- Saves sender, recipient and payer of one request and links them to it.
create or replace function public.link_transport_request_clients(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.transport_requests%rowtype;
  v_sender uuid;
  v_recipient uuid;
  v_payer uuid;
begin
  select * into r from public.transport_requests where id = p_request_id;
  if not found then
    return;
  end if;
  v_sender := public.upsert_client_from_party(
    r.contact_name, r.sender_nif, r.contact_email, r.contact_phone,
    r.sender_address, r.sender_city, r.sender_postal_code);
  v_recipient := public.upsert_client_from_party(
    r.recipient_name, r.recipient_nif, r.recipient_email, r.recipient_phone,
    r.recipient_address, r.recipient_city, r.recipient_postal_code);
  v_payer := case r.billing_payer
    when 'remitente' then v_sender
    when 'destinatario' then v_recipient
    else public.upsert_client_from_party(
      r.billing_client ->> 'fullName', r.billing_client ->> 'nif', r.billing_client ->> 'email',
      r.billing_client ->> 'phone', r.billing_client ->> 'address', r.billing_client ->> 'city',
      r.billing_client ->> 'postalCode')
  end;
  update public.transport_requests
  set sender_client_id = v_sender, recipient_client_id = v_recipient, payer_client_id = v_payer
  where id = p_request_id;
end;
$$;

revoke all on function public.link_transport_request_clients(uuid) from public, anon, authenticated;

-- Link the parties as soon as the request is stored (admin variant delegates here).
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
  perform public.link_transport_request_clients(v_request_id);
  return v_request_id;
end;
$$;

-- Existing requests.
do $$
declare v_id uuid;
begin
  for v_id in select id from public.transport_requests where payer_client_id is null loop
    perform public.link_transport_request_clients(v_id);
  end loop;
end $$;

-- How many services a client has sent, received and paid (cancelled and rejected excluded).
create or replace function public.client_service_counts(p_client_id uuid)
returns table (sent bigint, received bigint, paid bigint)
language sql stable security definer set search_path = '' as $$
  select
    count(*) filter (where sender_client_id = p_client_id),
    count(*) filter (where recipient_client_id = p_client_id),
    count(*) filter (where payer_client_id = p_client_id)
  from public.transport_requests
  where public.is_admin()
    and status not in ('cancelada', 'rechazada')
    and p_client_id in (sender_client_id, recipient_client_id, payer_client_id);
$$;

revoke all on function public.client_service_counts(uuid) from public, anon;
grant execute on function public.client_service_counts(uuid) to authenticated;

notify pgrst, 'reload schema';
