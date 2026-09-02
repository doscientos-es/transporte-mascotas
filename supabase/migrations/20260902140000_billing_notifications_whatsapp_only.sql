-- Las solicitudes de pago y facturas se entregan exclusivamente por WhatsApp.
update public.invoice_drafts
set delivery_channel = 'whatsapp',
    delivery_email = '',
    delivery_phone = coalesce(nullif(btrim(delivery_phone), ''), nullif(btrim(client_snapshot ->> 'phone'), ''), '');

alter table public.invoice_drafts
  drop constraint if exists invoice_drafts_delivery_channel_check;

alter table public.invoice_drafts
  add constraint invoice_drafts_delivery_channel_check
  check (delivery_channel = 'whatsapp' and btrim(delivery_phone) <> '');

-- Conservar solo una notificación por documento cuando existían ambos canales.
delete from public.billing_notifications legacy
using public.billing_notifications whatsapp
where legacy.channel = 'email'
  and whatsapp.channel = 'whatsapp'
  and legacy.invoice_draft_id = whatsapp.invoice_draft_id
  and legacy.issued_invoice_id is not distinct from whatsapp.issued_invoice_id
  and legacy.kind = whatsapp.kind;

update public.billing_notifications notification
set channel = 'whatsapp',
    recipient = draft.delivery_phone
from public.invoice_drafts draft
where notification.invoice_draft_id = draft.id
  and notification.channel = 'email';

alter table public.billing_notifications
  drop constraint if exists billing_notifications_channel_check;

alter table public.billing_notifications
  add constraint billing_notifications_channel_check
  check (channel = 'whatsapp');

-- Los documentos ya creados se podrán reenviar por WhatsApp cuando se solicite.
insert into public.billing_notifications(invoice_draft_id, kind, channel, recipient)
select draft.id, 'solicitud_pago', 'whatsapp', draft.delivery_phone
from public.invoice_drafts draft
where draft.status = 'solicitud_pago'
on conflict do nothing;

insert into public.billing_notifications(invoice_draft_id, issued_invoice_id, kind, channel, recipient)
select draft.id, issued.id, 'factura_emitida', 'whatsapp', draft.delivery_phone
from public.invoice_drafts draft
join public.issued_invoices issued on issued.invoice_draft_id = draft.id
on conflict do nothing;