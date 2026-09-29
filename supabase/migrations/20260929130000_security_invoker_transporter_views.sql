-- Public views run with the caller's permissions. The restricted projections
-- for transportistas live in a schema that is not exposed through the API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.transporter_invoices()
returns table (
  id uuid,
  letter_id text,
  payer public.payer_type,
  concept text,
  total_amount numeric,
  status public.invoice_draft_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select invoice.id, invoice.letter_id, invoice.payer, invoice.concept, invoice.total_amount, invoice.status, invoice.created_at
  from public.invoice_drafts invoice
  where exists (
    select 1
    from public.route_actions action
    join public.daily_routes route on route.id = action.daily_route_id
    where action.letter_id = invoice.letter_id
      and route.transporter_id = auth.uid()
  );
$$;

create or replace function private.transporter_route_actions()
returns table (
  id uuid,
  daily_route_id uuid,
  daily_route_stop_id uuid,
  letter_id text,
  animal_id uuid,
  action_type public.service_type,
  status public.service_action_status,
  dwell_minutes integer,
  customer_name text,
  customer_phone text,
  animal_breed text,
  animal_species text,
  box_number integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select action.id,
         action.daily_route_id,
         action.daily_route_stop_id,
         action.letter_id,
         action.animal_id,
         action.action_type,
         action.status,
         action.dwell_minutes,
         case when action.action_type = 'recogida' then letter.sender_name else letter.recipient_name end,
         case when action.action_type = 'recogida' then letter.sender_phone else letter.recipient_phone end,
         animal.breed,
         animal.species,
         assignment.box_number
  from public.route_actions action
  join public.daily_routes route on route.id = action.daily_route_id
  join public.carriage_letters letter on letter.id = action.letter_id
  join public.animals animal on animal.id = action.animal_id
  left join lateral (
    select candidate.box_number
    from public.van_assignments candidate
    where candidate.daily_route_id = action.daily_route_id
      and candidate.letter_id = action.letter_id
    order by candidate.created_at desc
    limit 1
  ) assignment on true
  where public.is_admin() or route.transporter_id = auth.uid();
$$;

revoke all on function private.transporter_invoices() from public, anon;
revoke all on function private.transporter_route_actions() from public, anon;
grant execute on function private.transporter_invoices() to authenticated;
grant execute on function private.transporter_route_actions() to authenticated;

create or replace view public.transporter_invoices
with (security_invoker = true) as
  select invoice.id,
         invoice.letter_id,
         invoice.payer,
         invoice.concept,
         invoice.total_amount::numeric(12, 2) as total_amount,
         invoice.status,
         invoice.created_at
  from private.transporter_invoices() invoice;

create or replace view public.transporter_route_actions
with (security_invoker = true) as
  select * from private.transporter_route_actions();

revoke all on public.transporter_invoices from public, anon, authenticated;
revoke all on public.transporter_route_actions from public, anon, authenticated;
grant select on public.transporter_invoices to authenticated;
grant select on public.transporter_route_actions to authenticated;

notify pgrst, 'reload schema';
