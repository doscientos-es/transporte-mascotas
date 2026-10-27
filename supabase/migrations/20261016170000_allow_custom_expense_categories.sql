-- Allow finance users to enter categories beyond the suggested values.
alter table public.expenses
  drop constraint if exists expenses_category_check;

alter table public.expenses
  add constraint expenses_category_nonempty_check check (btrim(category) <> '');