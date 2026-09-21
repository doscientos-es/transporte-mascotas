-- Billing documents remain available to administration, but no customer
-- WhatsApp message should be queued or delivered.
alter table public.invoice_drafts
  drop constraint if exists invoice_drafts_delivery_channel_check;

update public.invoice_drafts
set delivery_channel = 'manual', delivery_email = '', delivery_phone = '';

alter table public.invoice_drafts
  add constraint invoice_drafts_delivery_channel_check
  check (delivery_channel = 'manual');

update public.billing_notifications
set status = 'cancelada',
    error_message = 'WhatsApp desactivado',
    processing_started_at = null
where channel = 'whatsapp'
  and status in ('pendiente', 'procesando', 'fallida');

notify pgrst, 'reload schema';