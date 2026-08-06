alter table public.daily_routes
  add column if not exists transporter_id uuid references public.profiles(id) on delete set null;

create index if not exists daily_routes_transporter_id_idx
  on public.daily_routes(transporter_id);

-- An active route must be explicitly assigned before a transportista can read it.
drop policy if exists "daily routes active or admin read" on public.daily_routes;
create policy "daily routes assigned transportista read" on public.daily_routes
  for select to authenticated
  using (public.is_admin() or transporter_id = auth.uid());

drop policy if exists "daily stops active or admin read" on public.daily_route_stops;
create policy "daily stops assigned transportista read" on public.daily_route_stops
  for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.daily_routes route
    where route.id = daily_route_id and route.transporter_id = auth.uid()
  ));

drop policy if exists "actions active or admin read" on public.route_actions;
create policy "actions assigned transportista read" on public.route_actions
  for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.daily_routes route
    where route.id = daily_route_id and route.transporter_id = auth.uid()
  ));

drop policy if exists "assignments active or admin read" on public.van_assignments;
create policy "assignments assigned transportista read" on public.van_assignments
  for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.daily_routes route
    where route.id = daily_route_id and route.transporter_id = auth.uid()
  ));

-- Invoice records retain their private client snapshot and remain admin-only.
-- Transportistas use the restricted view defined below.
drop policy if exists "invoice drafts admin manage" on public.invoice_drafts;
create policy "invoice drafts admin manage" on public.invoice_drafts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "invoice drafts assigned transportista read" on public.invoice_drafts;

create or replace view public.transporter_invoices as
  select invoice.id,
         invoice.letter_id,
         invoice.payer,
         invoice.concept,
         invoice.total_amount,
         invoice.status,
         invoice.created_at
  from public.invoice_drafts invoice
  where exists (
    select 1
    from public.route_actions action
    join public.daily_routes route on route.id = action.daily_route_id
    where action.letter_id = invoice.letter_id
      and route.transporter_id = auth.uid()
  );

revoke all on public.transporter_invoices from public, anon;
grant select on public.transporter_invoices to authenticated;

-- Exposes only the operational contact needed at each assigned stop.
create or replace view public.transporter_route_actions as
  select action.id,
         action.daily_route_id,
         action.daily_route_stop_id,
         action.letter_id,
         action.animal_id,
         action.action_type,
         action.status,
         action.dwell_minutes,
         case when action.action_type = 'recogida' then letter.sender_name else letter.recipient_name end as customer_name,
         case when action.action_type = 'recogida' then letter.sender_phone else letter.recipient_phone end as customer_phone,
         animal.breed as animal_breed,
         animal.species as animal_species,
         assignment.box_number
  from public.route_actions action
  join public.daily_routes route on route.id = action.daily_route_id
  join public.carriage_letters letter on letter.id = action.letter_id
  join public.animals animal on animal.id = action.animal_id
  left join public.van_assignments assignment on assignment.daily_route_id = action.daily_route_id and assignment.animal_id = action.animal_id
  where public.is_admin() or route.transporter_id = auth.uid();

revoke all on public.transporter_route_actions from public, anon;
grant select on public.transporter_route_actions to authenticated;

create or replace function public.record_route_action(p_action_id uuid, p_status public.service_action_status, p_incident_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_route public.daily_routes;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select route.* into target_route
  from public.route_actions action
  join public.daily_routes route on route.id = action.daily_route_id
  where action.id = p_action_id;
  if target_route.id is null
    or target_route.status <> 'activa'
    or not (public.is_admin() or target_route.transporter_id = auth.uid()) then
    raise exception 'Acción no disponible';
  end if;
  update public.route_actions
  set status = p_status,
      incident_note = coalesce(p_incident_note, ''),
      completed_at = case when p_status = 'completada' then now() else null end,
      completed_by = auth.uid()
  where id = p_action_id;
  insert into public.audit_logs(actor_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'route_action_updated', 'route_action', p_action_id::text);
end;
$$;

revoke all on function public.record_route_action(uuid, public.service_action_status, text) from public, anon;
grant execute on function public.record_route_action(uuid, public.service_action_status, text) to authenticated;
