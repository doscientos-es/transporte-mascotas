create or replace function public.cancel_invoice_payment_request(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.invoice_draft_status;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo administración puede quitar solicitudes de pago.'
      using errcode = '42501';
  end if;

  select draft.status into v_status
  from public.invoice_drafts draft
  where draft.id = p_invoice_id
  for update;

  if not found or v_status <> 'solicitud_pago' then
    raise exception 'La solicitud de pago ya no está pendiente.';
  end if;

  if exists (
    select 1
    from public.invoice_payments payment
    where payment.invoice_id = p_invoice_id
      and payment.status in ('pendiente', 'pagado')
  ) then
    raise exception 'No se puede quitar una solicitud con un cobro iniciado o confirmado.';
  end if;

  update public.invoice_drafts
  set status = 'anulado'
  where id = p_invoice_id;

  insert into public.audit_logs(actor_id, event_type, entity_type, entity_id, data)
  values (
    auth.uid(),
    'invoice_payment_request_cancelled',
    'invoice_draft',
    p_invoice_id::text,
    jsonb_build_object('previous_status', v_status, 'status', 'anulado')
  );
end;
$$;

revoke all on function public.cancel_invoice_payment_request(uuid) from public, anon;
grant execute on function public.cancel_invoice_payment_request(uuid) to authenticated;

notify pgrst, 'reload schema';