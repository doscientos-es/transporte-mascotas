alter table public.invoice_drafts
  drop constraint if exists invoice_drafts_delivery_channel_check;

alter table public.invoice_drafts
  add constraint invoice_drafts_delivery_channel_check
  check (delivery_channel in ('manual', 'email', 'whatsapp', 'both'));
