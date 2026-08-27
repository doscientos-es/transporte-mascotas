alter table public.invoice_drafts
  add column if not exists delivery_channel text not null default 'manual',
  add column if not exists delivery_email text not null default '',
  add column if not exists delivery_phone text not null default '';

alter table public.invoice_drafts
  drop constraint if exists invoice_drafts_delivery_channel_check;

alter table public.invoice_drafts
  add constraint invoice_drafts_delivery_channel_check
  check (delivery_channel in ('manual', 'email', 'whatsapp', 'both'));
