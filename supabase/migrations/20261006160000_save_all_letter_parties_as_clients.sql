-- Every person on a carriage letter (sender, recipient and a separate payer) must exist in the
-- clients directory the admin sees.

-- 1. Transport requests: the payer is the billing entity whenever one is given
--    (the payer_type enum only says sender/recipient, so a separate entity lives in billing_client).
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
  v_payer := public.upsert_client_from_party(
    r.billing_client ->> 'fullName', r.billing_client ->> 'nif', r.billing_client ->> 'email',
    r.billing_client ->> 'phone', r.billing_client ->> 'address', r.billing_client ->> 'city',
    r.billing_client ->> 'postalCode');
  if v_payer is null then
    v_payer := case r.billing_payer when 'destinatario' then v_recipient else v_sender end;
  end if;
  update public.transport_requests
  set sender_client_id = v_sender, recipient_client_id = v_recipient, payer_client_id = v_payer
  where id = p_request_id;
end;
$$;

revoke all on function public.link_transport_request_clients(uuid) from public, anon, authenticated;

-- 2. Manual carriage letters: save sender and recipient (the payer is already saved by
--    create_manual_carriage_letter).
create or replace function public.save_manual_letter_parties()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.entry_source = 'manual' then
    perform public.upsert_client_from_party(
      new.sender_name, new.sender_nif, new.sender_email, new.sender_phone,
      new.sender_address, new.sender_city, new.sender_postal_code);
    perform public.upsert_client_from_party(
      new.recipient_name, new.recipient_nif, new.recipient_email, new.recipient_phone,
      new.recipient_address, new.recipient_city, new.recipient_postal_code);
  end if;
  return new;
end;
$$;

revoke all on function public.save_manual_letter_parties() from public, anon, authenticated;

drop trigger if exists save_manual_letter_parties on public.carriage_letters;
create trigger save_manual_letter_parties
  after insert on public.carriage_letters
  for each row execute function public.save_manual_letter_parties();

-- 3. Existing data.
do $$
declare v_id uuid;
begin
  for v_id in select id from public.transport_requests loop
    perform public.link_transport_request_clients(v_id);
  end loop;
end $$;

select public.upsert_client_from_party(
  l.sender_name, l.sender_nif, l.sender_email, l.sender_phone,
  l.sender_address, l.sender_city, l.sender_postal_code)
from public.carriage_letters l where l.entry_source = 'manual';
select public.upsert_client_from_party(
  l.recipient_name, l.recipient_nif, l.recipient_email, l.recipient_phone,
  l.recipient_address, l.recipient_city, l.recipient_postal_code)
from public.carriage_letters l where l.entry_source = 'manual';
