alter type public.invoice_draft_status add value if not exists 'pagada';

create type public.invoice_payment_status as enum ('pendiente', 'pagado', 'fallido', 'caducado');

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoice_drafts(id) on delete restrict,
  provider text not null default 'caixabank_cyberpac' check (provider = 'caixabank_cyberpac'),
  merchant_order text not null unique check (merchant_order ~ '^[A-Za-z0-9]{4,12}$'),
  public_token uuid not null unique default gen_random_uuid(),
  amount_cents integer not null check (amount_cents > 0),
  status public.invoice_payment_status not null default 'pendiente',
  gateway_response jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoice_payments_invoice_id_idx on public.invoice_payments(invoice_id, created_at desc);
create index invoice_payments_pending_idx on public.invoice_payments(status, expires_at) where status = 'pendiente';

create trigger invoice_payments_updated_at
before update on public.invoice_payments for each row execute function public.set_updated_at();

alter table public.invoice_payments enable row level security;
revoke all on public.invoice_payments from public, anon, authenticated;