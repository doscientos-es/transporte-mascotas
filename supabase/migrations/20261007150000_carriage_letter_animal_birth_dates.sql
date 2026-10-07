-- Include animal birth dates in the client's secure carriage-letter response.
create or replace function public.get_transport_request_carriage_letter(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_letter_id text;
  v_daily_route_id uuid;
  v_result jsonb;
begin
  select request.letter_id, request.daily_route_id
    into v_letter_id, v_daily_route_id
    from public.transport_requests request
   where request.id = p_request_id
     and (request.requester_id = (select auth.uid()) or public.is_admin());

  if not found then
    raise exception 'Solicitud no encontrada.';
  end if;
  if v_letter_id is null then
    raise exception 'La carta de porte estará disponible en cuanto confirmemos el pago.';
  end if;

  select jsonb_build_object(
    'id', letter.id,
    'service_date', letter.service_date,
    'sender_name', letter.sender_name,
    'sender_nif', letter.sender_nif,
    'sender_phone', letter.sender_phone,
    'sender_email', letter.sender_email,
    'sender_address', letter.sender_address,
    'sender_postal_code', letter.sender_postal_code,
    'sender_city', letter.sender_city,
    'sender_province', letter.sender_province,
    'recipient_name', letter.recipient_name,
    'recipient_nif', letter.recipient_nif,
    'recipient_phone', letter.recipient_phone,
    'recipient_email', letter.recipient_email,
    'recipient_address', letter.recipient_address,
    'recipient_postal_code', letter.recipient_postal_code,
    'recipient_city', letter.recipient_city,
    'recipient_province', letter.recipient_province,
    'origin_text', letter.origin_text,
    'destination_text', letter.destination_text,
    'origin_point', letter.origin_point,
    'destination_point', letter.destination_point,
    'accompanying_documents', letter.accompanying_documents,
    'transport_box_number', (
      select assignment.box_number
        from public.van_assignments assignment
       where assignment.daily_route_id = v_daily_route_id
         and assignment.letter_id = v_letter_id
       order by assignment.created_at desc
       limit 1
    ),
    'animals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ordinal', animal.ordinal,
        'species', animal.species,
        'breed', animal.breed,
        'identification', animal.identification,
        'birth_date', animal.birth_date,
        'weight_kg', animal.weight_kg,
        'length_cm', animal.length_cm,
        'height_cm', animal.height_cm,
        'width_cm', animal.width_cm,
        'shared_box', shared.group_number
      ) order by animal.ordinal)
      from public.animals animal
      left join (
        select request_animal.ordinal,
          dense_rank() over (order by request_animal.shared_box_group) as group_number
        from public.transport_request_animals request_animal
        join public.transport_requests request on request.id = request_animal.request_id
        where request.letter_id = letter.id and request_animal.shared_box_group is not null
      ) shared on shared.ordinal = animal.ordinal
      where animal.letter_id = letter.id
    ), '[]'::jsonb)
  )
    into v_result
    from public.carriage_letters letter
   where letter.id = v_letter_id;

  return v_result;
end;
$$;

revoke all on function public.get_transport_request_carriage_letter(uuid) from public, anon, authenticated;
grant execute on function public.get_transport_request_carriage_letter(uuid) to authenticated;