-- RLS keeps issued invoices restricted to administrators; this grants the base
-- table permission required for the policy to be evaluated by authenticated users.
grant select on public.issued_invoices to authenticated;