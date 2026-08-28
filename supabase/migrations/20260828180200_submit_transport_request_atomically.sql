-- A request and all of its animals are one business operation: never persist a
-- request without its animals if a validation or database step fails.
drop policy if exists "requests owner insert" on public.transport_requests;
drop policy if exists "request animals owner insert" on public.transport_request_animals;
revoke insert on public.transport_requests, public.transport_request_animals from authenticated;

create or replace function public.submit_transport_request(
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text,
  p_origin text,
  p_destination text,
  p_desired_date date,
  p_notes text,
  p_animals jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para enviar una solicitud';
  end if;

  if btrim(p_contact_name) = '' or btrim(p_contact_phone) = ''
    or btrim(p_contact_email) = '' or btrim(p_origin) = '' or btrim(p_destination) = '' then
    raise exception 'Completa los datos de contacto y del trayecto';
  end if;
  if p_desired_date is null or p_desired_date < current_date then
    raise exception 'La fecha solicitada no es válida';
  end if;
  if jsonb_typeof(p_animals) <> 'array' or jsonb_array_length(p_animals) = 0 then
    raise exception 'Incluye al menos una mascota';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_animals) as animal(value)
    where jsonb_typeof(animal.value) <> 'object'
      or coalesce(nullif(btrim(animal.value ->> 'species'), ''), '') = ''
  ) then
    raise exception 'Los datos de las mascotas no son válidos';
  end if;

  insert into public.transport_requests (
    requester_id, contact_name, contact_phone, contact_email,
    origin_text, destination_text, desired_date, notes
  ) values (
    auth.uid(), btrim(p_contact_name), btrim(p_contact_phone), btrim(p_contact_email),
    btrim(p_origin), btrim(p_destination), p_desired_date, coalesce(btrim(p_notes), '')
  ) returning id into v_request_id;

  insert into public.transport_request_animals (
    request_id, ordinal, species, breed, weight_kg, length_cm, height_cm, width_cm
  )
  select v_request_id,
         animal.ordinality::integer,
         btrim(animal.value ->> 'species'),
         coalesce(btrim(animal.value ->> 'breed'), ''),
         (animal.value ->> 'weight_kg')::numeric,
         (animal.value ->> 'length_cm')::numeric,
         (animal.value ->> 'height_cm')::numeric,
         (animal.value ->> 'width_cm')::numeric
  from jsonb_array_elements(p_animals) with ordinality as animal(value, ordinality);

  return v_request_id;
end;
$$;

revoke all on function public.submit_transport_request(text, text, text, text, text, date, text, jsonb) from public, anon;
grant execute on function public.submit_transport_request(text, text, text, text, text, date, text, jsonb) to authenticated;