-- A client may only file a request in its initial state: everything past the
-- payment is decided server side.
drop policy if exists "requests owner insert" on public.transport_requests;
create policy "requests owner insert" on public.transport_requests
  for insert to authenticated with check (
    requester_id = (select auth.uid())
    and status = 'pago_pendiente'
    and letter_id is null
    and daily_route_id is null
  );

-- Payment confirmation is the only status change a client can trigger, and it
-- always lands on the admin inbox. Redsys will call this once the gateway is
-- wired: for now the portal confirms with a simulated reference.
create or replace function public.confirm_transport_request_payment(p_request_id uuid, p_reference text)
returns public.transport_request_status
language plpgsql security definer set search_path = '' as $$
declare
  next_status public.transport_request_status;
begin
  update public.transport_requests
  set status = 'por_verificar', payment_reference = p_reference, paid_at = now()
  where id = p_request_id
    and requester_id = auth.uid()
    and status = 'pago_pendiente'
  returning status into next_status;
  if next_status is null then
    raise exception 'Solicitud no encontrada o ya pagada';
  end if;
  return next_status;
end;
$$;

revoke all on function public.confirm_transport_request_payment(uuid, text) from public, anon;
grant execute on function public.confirm_transport_request_payment(uuid, text) to authenticated;
