-- Reassigning a cancelled letter is one transaction: a failed edit leaves it cancelled.
create function public.reassign_cancelled_carriage_letter(
  p_letter_id text, p_daily_route_id uuid, p_letter jsonb, p_animals jsonb,
  p_actions jsonb, p_box_number integer, p_signature_confirmed boolean, p_share_box boolean
)
returns public.letter_status language plpgsql security definer set search_path = '' as $$
declare
  v_route public.daily_routes%rowtype;
  v_status public.letter_status;
begin
  if not public.is_admin() then raise exception 'Solo administración puede reasignar cartas'; end if;
  select * into v_route from public.daily_routes where id = p_daily_route_id for update;
  if not found then raise exception 'La ruta diaria no existe'; end if;
  select status into v_status from public.carriage_letters where id = p_letter_id for update;
  if not found then raise exception 'La carta de porte no existe'; end if;
  if v_status <> 'cancelada' then raise exception 'La carta ya no está anulada'; end if;

  perform public.update_carriage_letter_atomically(
    p_letter_id, p_daily_route_id, p_letter, p_animals, p_actions,
    p_box_number, p_signature_confirmed, p_share_box
  );
  update public.carriage_letters
  set status = case when complimentary then 'programada'::public.letter_status else 'pendiente'::public.letter_status end
  where id = p_letter_id;
  perform public.sync_carriage_letter_status(p_letter_id);
  update public.transport_requests
  set status = 'confirmada', daily_route_id = v_route.id,
      route_template_id = v_route.route_template_id, desired_date = v_route.service_date
  where letter_id = p_letter_id and status = 'cancelada';
  select status into v_status from public.carriage_letters where id = p_letter_id;
  return v_status;
end;
$$;

revoke all on function public.reassign_cancelled_carriage_letter(text, uuid, jsonb, jsonb, jsonb, integer, boolean, boolean) from public, anon;
grant execute on function public.reassign_cancelled_carriage_letter(text, uuid, jsonb, jsonb, jsonb, integer, boolean, boolean) to authenticated;
notify pgrst, 'reload schema';