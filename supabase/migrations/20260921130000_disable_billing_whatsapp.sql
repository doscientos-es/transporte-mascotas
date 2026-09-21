-- Billing documents remain available to administration, but no customer
-- WhatsApp message should be queued or delivered. Already issued invoices
-- remain immutable and retain their historical delivery channel.
alter table public.invoice_drafts
  drop constraint if exists invoice_drafts_delivery_channel_check;

update public.invoice_drafts draft
set delivery_channel = 'manual', delivery_email = '', delivery_phone = ''
where not exists (
  select 1 from public.issued_invoices issued
  where issued.invoice_draft_id = draft.id
);

alter table public.invoice_drafts
  add constraint invoice_drafts_delivery_channel_check
  check (delivery_channel = 'manual' or status = 'emitida');

update public.billing_notifications
set status = 'cancelada',
    error_message = 'WhatsApp desactivado',
    processing_started_at = null
where channel = 'whatsapp'
  and status in ('pendiente', 'procesando', 'fallida');

notify pgrst, 'reload schema';