-- Transport requests collect the identity of both the sender and the recipient
-- so the carriage letter generated after payment has the real parties.
alter table public.transport_requests
  add column if not exists sender_nif text not null default '',
  add column if not exists recipient_name text not null default '',
  add column if not exists recipient_nif text not null default '',
  add column if not exists recipient_phone text not null default '',
  add column if not exists recipient_email text not null default '';

create or replace function public.submit_transport_request(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb,
  p_billing_payer public.payer_type, p_billing_client jsonb,
  p_sender_nif text, p_recipient_name text, p_recipient_nif text,
  p_recipient_phone text, p_recipient_email text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
begin
  if coalesce(btrim(p_sender_nif), '') = '' or coalesce(btrim(p_recipient_name), '') = ''
    or coalesce(btrim(p_recipient_nif), '') = '' or coalesce(btrim(p_recipient_phone), '') = '' then
    raise exception 'Completa el DNI, nombre y teléfono de quien envía y de quien recibe';
  end if;
  if coalesce(btrim(p_recipient_email), '') <> ''
    and btrim(p_recipient_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'El correo de quien recibe no es válido';
  end if;
  if coalesce(jsonb_typeof(p_animals), '') <> 'array' or exists (
    select 1 from jsonb_array_elements(p_animals) as animal
    where nullif(btrim(animal ->> 'breed'), '') is null
  ) then
    raise exception 'Indica la raza de cada mascota';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) as animal
    where animal ->> 'requested_box_category' = 'paso_rueda'
      and coalesce((animal ->> 'weight_kg')::numeric, 0) > 35
  ) then
    raise exception 'El box de paso de rueda admite como máximo 35 kg';
  end if;

  v_request_id := public.submit_transport_request(
    p_contact_name, p_contact_phone, p_contact_email, p_daily_route_id,
    p_origin, p_destination, p_desired_date, p_notes, p_animals,
    p_billing_payer, p_billing_client
  );
  update public.transport_requests
  set sender_nif = btrim(p_sender_nif),
      recipient_name = btrim(p_recipient_name),
      recipient_nif = btrim(p_recipient_nif),
      recipient_phone = btrim(p_recipient_phone),
      recipient_email = coalesce(btrim(p_recipient_email), '')
  where id = v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.submit_transport_request_admin(
  p_contact_name text, p_contact_phone text, p_contact_email text, p_daily_route_id uuid,
  p_origin text, p_destination text, p_desired_date date, p_notes text, p_animals jsonb,
  p_billing_payer public.payer_type, p_billing_client jsonb,
  p_sender_nif text, p_recipient_name text, p_recipient_nif text,
  p_recipient_phone text, p_recipient_email text
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
    p_sender_nif, p_recipient_name, p_recipient_nif, p_recipient_phone, p_recipient_email
  );
  update public.transport_requests
  set status = 'por_verificar',
      payment_reference = 'admin_manual',
      admin_note = 'Creada manualmente por administración'
  where id = v_request_id;
  return v_request_id;
end;
$$;

-- Older overloads stay for internal use only; clients must send both parties.
revoke all on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb) from public, anon, authenticated;
revoke all on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb) from public, anon, authenticated;
revoke all on function public.submit_transport_request_admin(text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb) from public, anon, authenticated;

revoke all on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb, text, text, text, text, text) from public, anon;
grant execute on function public.submit_transport_request(text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb, text, text, text, text, text) to authenticated;
revoke all on function public.submit_transport_request_admin(text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb, text, text, text, text, text) from public, anon;
grant execute on function public.submit_transport_request_admin(text, text, text, uuid, text, text, date, text, jsonb, public.payer_type, jsonb, text, text, text, text, text) to authenticated;

-- Copy both parties onto the carriage letter once the request is converted.
create or replace function public.copy_transport_request_parties_to_letter()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.letter_id is not null and new.letter_id is distinct from old.letter_id
    and new.recipient_name <> '' then
    update public.carriage_letters
    set sender_nif = new.sender_nif,
        recipient_name = new.recipient_name,
        recipient_nif = new.recipient_nif,
        recipient_phone = new.recipient_phone,
        recipient_email = new.recipient_email
    where id = new.letter_id;
  end if;
  return new;
end;
$$;

revoke all on function public.copy_transport_request_parties_to_letter() from public, anon, authenticated;

drop trigger if exists copy_transport_request_parties_to_letter on public.transport_requests;
create trigger copy_transport_request_parties_to_letter
  after update of letter_id on public.transport_requests
  for each row execute function public.copy_transport_request_parties_to_letter();

notify pgrst, 'reload schema';
