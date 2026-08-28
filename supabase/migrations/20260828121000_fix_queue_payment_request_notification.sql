create or replace function public.queue_payment_request_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'solicitud_pago' then return new; end if;
  if new.delivery_channel in ('email', 'both') and btrim(new.delivery_email) <> '' then
    insert into public.billing_notifications(invoice_draft_id, kind, channel, recipient)
    values (new.id, 'solicitud_pago', 'email', new.delivery_email)
    on conflict do nothing;
  end if;
  if new.delivery_channel in ('whatsapp', 'both') and btrim(new.delivery_phone) <> '' then
    insert into public.billing_notifications(invoice_draft_id, kind, channel, recipient)
    values (new.id, 'solicitud_pago', 'whatsapp', new.delivery_phone)
    on conflict do nothing;
  end if;
  return new;
end;
$$;