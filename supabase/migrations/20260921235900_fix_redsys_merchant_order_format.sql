-- Redsys HMAC_SHA256_V1 requires the first four order characters to be numeric.
create or replace function public.prepare_transport_payment(p_request_id uuid, p_requester_id uuid)
returns table (public_token uuid, merchant_order text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  request public.transport_requests;
  next_order text;
begin
  select * into request from public.transport_requests
  where id = p_request_id and requester_id = p_requester_id for update;
  if request.id is null then raise exception 'Solicitud no encontrada'; end if;
  if request.status <> 'pago_pendiente' then raise exception 'Esta solicitud ya no admite pagos'; end if;
  if request.amount_cents <= 0 then raise exception 'El importe de la solicitud no es válido'; end if;

  if request.payment_merchant_order is null
    or request.payment_merchant_order !~ '^[0-9]{4}[A-Za-z0-9]{8}$' then
    loop
      next_order := lpad(floor(random() * 10000)::integer::text, 4, '0')
        || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      begin
        update public.transport_requests
        set payment_merchant_order = next_order
        where id = request.id
        returning * into request;
        exit;
      exception when unique_violation then
        -- Retry the very unlikely collision against the unique order index.
      end;
    end loop;
  end if;
  return query select request.payment_public_token, request.payment_merchant_order, request.payment_expires_at;
end;
$$;

revoke all on function public.prepare_transport_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_transport_payment(uuid, uuid) to service_role;