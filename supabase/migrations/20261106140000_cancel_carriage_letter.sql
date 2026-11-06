-- Cancellation removes operational assignments but retains financial and client records.
create or replace function public.cancel_carriage_letter(p_letter_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Solo administración puede anular cartas'; end if;

  -- Match route operations' lock order and serialize changes to affected routes.
  perform 1 from public.daily_routes
  where id in (
    select daily_route_id from public.route_actions where letter_id = p_letter_id
    union select daily_route_id from public.van_assignments where letter_id = p_letter_id
  ) order by id for update;
  perform 1 from public.carriage_letters where id = p_letter_id for update;
  if not found then raise exception 'Carta de porte no encontrada'; end if;

  delete from public.van_assignments where letter_id = p_letter_id;
  delete from public.route_actions where letter_id = p_letter_id;
  update public.carriage_letters set status = 'cancelada', default_route_template_id = null
  where id = p_letter_id;
  update public.transport_requests set status = 'cancelada', daily_route_id = null, route_template_id = null
  where letter_id = p_letter_id;
  update public.carriage_letter_notifications set status = 'cancelada', processing_started_at = null
  where letter_id = p_letter_id and status in ('pendiente', 'procesando', 'fallida');
  update public.transport_request_notifications set status = 'cancelada', processing_started_at = null
  where request_id in (select id from public.transport_requests where letter_id = p_letter_id)
    and status in ('pendiente', 'procesando', 'fallida');
end;
$$;

revoke all on function public.cancel_carriage_letter(text) from public, anon, authenticated;
grant execute on function public.cancel_carriage_letter(text) to authenticated;
notify pgrst, 'reload schema';