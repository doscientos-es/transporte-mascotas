-- An administrator can mark a transport request as paid when the customer paid
-- outside the payment link (transfer, cash, bizum...) or when the gateway
-- notification never updated the request. The request moves to the admin inbox
-- ("por_verificar") and the action is traceable in the audit log.
-- Called only by the confirm-manual-transport-payment edge function (service
-- role), which then finalizes the request and emails the customer.
create or replace function public.record_manual_transport_payment(
  p_request_id uuid,
  p_payment_method text,
  p_actor_id uuid,
  p_note text default ''
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.transport_requests;
  v_method text := nullif(btrim(coalesce(p_payment_method, '')), '');
begin
  if v_method is null then
    raise exception 'Indica el método de cobro';
  end if;

  select * into request from public.transport_requests where id = p_request_id for update;
  if request.id is null then raise exception 'Solicitud no encontrada'; end if;
  if request.status <> 'pago_pendiente' then
    raise exception 'La solicitud no está pendiente de pago';
  end if;

  update public.transport_requests
  set status = 'por_verificar',
      paid_at = coalesce(paid_at, now()),
      payment_reference = 'admin_manual:' || v_method,
      payment_attempt_status = 'confirmed',
      payment_gateway_response = coalesce(payment_gateway_response, '{}'::jsonb)
        || jsonb_build_object(
          'manualConfirmation', true,
          'paymentMethod', v_method,
          'note', coalesce(p_note, ''),
          'previousAttemptStatus', request.payment_attempt_status,
          'confirmedBy', p_actor_id,
          'confirmedAt', now()
        )
  where id = request.id;

  insert into public.audit_logs (actor_id, event_type, entity_type, entity_id)
  values (p_actor_id, 'transport_request_payment_confirmed_manually', 'transport_request', request.id::text);
end;
$$;

revoke all on function public.record_manual_transport_payment(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_manual_transport_payment(uuid, text, uuid, text) to service_role;

notify pgrst, 'reload schema';
