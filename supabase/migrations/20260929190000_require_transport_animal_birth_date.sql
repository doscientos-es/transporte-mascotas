-- Every pet in a transport request must have a birth date. It is stored on the
-- request and copied to the carriage letter animals once the request is converted.
alter table public.transport_request_animals
  add column if not exists birth_date date;

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
    where case
      when coalesce(animal ->> 'birth_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        then (animal ->> 'birth_date')::date > current_date
      else true
    end
  ) then
    raise exception 'Indica una fecha de nacimiento válida para cada mascota';
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
  update public.transport_request_animals request_animal
  set birth_date = (animal.value ->> 'birth_date')::date
  from jsonb_array_elements(p_animals) with ordinality as animal(value, ordinality)
  where request_animal.request_id = v_request_id
    and request_animal.ordinal = animal.ordinality::integer;
  return v_request_id;
end;
$$;

-- Copy the birth dates onto the carriage letter animals once the request is converted.
create or replace function public.copy_transport_request_birth_dates_to_letter()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.letter_id is not null and new.letter_id is distinct from old.letter_id then
    update public.animals letter_animal
    set birth_date = request_animal.birth_date
    from public.transport_request_animals request_animal
    where request_animal.request_id = new.id
      and request_animal.birth_date is not null
      and letter_animal.letter_id = new.letter_id
      and letter_animal.ordinal = request_animal.ordinal;
  end if;
  return new;
end;
$$;

revoke all on function public.copy_transport_request_birth_dates_to_letter() from public, anon, authenticated;

drop trigger if exists copy_transport_request_birth_dates_to_letter on public.transport_requests;
create trigger copy_transport_request_birth_dates_to_letter
  after update of letter_id on public.transport_requests
  for each row execute function public.copy_transport_request_birth_dates_to_letter();

notify pgrst, 'reload schema';
