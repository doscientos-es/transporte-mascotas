-- A route removal is atomic and never deletes the letter, animals or billing documents.
create or replace function public.remove_letter_from_daily_route(p_daily_route_id uuid, p_letter_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_remaining_route record;
begin
  if not public.is_admin() then raise exception 'Solo administración puede quitar cartas de una ruta'; end if;
  perform 1 from public.daily_routes where id = p_daily_route_id for update;
  if not found then raise exception 'Ruta no encontrada'; end if;
  perform 1 from public.carriage_letters where id = p_letter_id for update;
  if not found then raise exception 'Carta de porte no encontrada'; end if;
  if not exists (select 1 from public.route_actions where daily_route_id = p_daily_route_id and letter_id = p_letter_id and action_type = 'recogida') then
    raise exception 'La carta ya no está asignada a esta ruta';
  end if;

  delete from public.van_assignments where daily_route_id = p_daily_route_id and letter_id = p_letter_id;
  delete from public.route_actions where daily_route_id = p_daily_route_id and letter_id = p_letter_id;

  select route.id, route.route_template_id, route.service_date into v_remaining_route
  from public.route_actions action join public.daily_routes route on route.id = action.daily_route_id
  where action.letter_id = p_letter_id order by route.service_date desc, route.id limit 1;

  update public.carriage_letters
  set default_route_template_id = v_remaining_route.route_template_id,
      service_date = coalesce(v_remaining_route.service_date, service_date),
      status = case when v_remaining_route.id is null and status <> 'cancelada' then 'pendiente'::public.letter_status else status end
  where id = p_letter_id;
  update public.transport_requests
  set daily_route_id = v_remaining_route.id, route_template_id = v_remaining_route.route_template_id
  where letter_id = p_letter_id and daily_route_id = p_daily_route_id;

  if v_remaining_route.id is null then
    update public.carriage_letter_notifications set status = 'cancelada', processing_started_at = null
    where letter_id = p_letter_id and status in ('pendiente', 'procesando', 'fallida');
    update public.transport_request_notifications set status = 'cancelada', processing_started_at = null
    where request_id in (select id from public.transport_requests where letter_id = p_letter_id)
      and kind in ('confirmacion', 'recordatorio_ruta') and status in ('pendiente', 'procesando', 'fallida');
  end if;
end;
$$;

revoke all on function public.remove_letter_from_daily_route(uuid, text) from public, anon, authenticated;
grant execute on function public.remove_letter_from_daily_route(uuid, text) to authenticated;

-- A paid letter without a route must not become scheduled again when its invoice changes.
create or replace function public.sync_carriage_letter_status(p_letter_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_current_status public.letter_status;
  v_route_template_id uuid;
  v_next_status public.letter_status;
  v_has_invoice boolean;
  v_is_paid boolean := false;
  v_all_animals_delivered boolean;
  v_route_started boolean;
begin
  select letter.status, letter.default_route_template_id into v_current_status, v_route_template_id
  from public.carriage_letters letter where letter.id = p_letter_id for update;
  if not found or v_current_status = 'cancelada' then return; end if;

  if v_route_template_id is null and not exists (select 1 from public.route_actions where letter_id = p_letter_id) then
    v_next_status := 'pendiente';
  else
    select exists (select 1 from public.invoice_drafts invoice where invoice.letter_id = p_letter_id) into v_has_invoice;
    if v_has_invoice then
      select exists (select 1 from public.invoice_drafts invoice where invoice.letter_id = p_letter_id and invoice.status = 'emitida') into v_is_paid;
      if not v_is_paid then v_next_status := 'pendiente'; end if;
    end if;
    if v_next_status is null then
      select exists (select 1 from public.animals animal where animal.letter_id = p_letter_id)
        and not exists (
          select 1 from public.animals animal where animal.letter_id = p_letter_id
          and not exists (select 1 from public.route_actions action where action.letter_id = p_letter_id
            and action.animal_id = animal.id and action.action_type = 'entrega' and action.status = 'completada')
        ) into v_all_animals_delivered;
      if v_all_animals_delivered then
        v_next_status := 'entregada';
      else
        select exists (select 1 from public.route_actions action join public.daily_routes route on route.id = action.daily_route_id
          where action.letter_id = p_letter_id and ((route.service_date + route.start_time) at time zone 'Europe/Madrid') <= now()) into v_route_started;
        if v_route_started and (v_is_paid or v_current_status <> 'pendiente') then
          v_next_status := 'en_ruta';
        elsif v_is_paid or v_current_status in ('programada', 'en_ruta', 'revisada') then
          v_next_status := 'programada';
        else
          return;
        end if;
      end if;
    end if;
  end if;
  if v_current_status is distinct from v_next_status then
    update public.carriage_letters set status = v_next_status where id = p_letter_id;
  end if;
end;
$$;

notify pgrst, 'reload schema';