-- Keep a fiscal address snapshot alongside each expense's vendor details.
alter table public.expenses
  add column vendor_address text not null default ''
  check (char_length(vendor_address) <= 300);

notify pgrst, 'reload schema';