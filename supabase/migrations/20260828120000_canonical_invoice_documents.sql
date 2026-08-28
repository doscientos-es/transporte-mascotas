-- A document is only canonical when it was rendered from this immutable issued invoice.
-- Existing rows remain intact but have no issued_invoice_id, so the application will
-- safely regenerate them on the next access instead of serving a pre-issue document.
alter table public.invoice_documents
  add column if not exists issued_invoice_id uuid references public.issued_invoices(id) on delete restrict;

create unique index if not exists invoice_documents_issued_invoice_id_idx
  on public.invoice_documents(issued_invoice_id)
  where issued_invoice_id is not null;