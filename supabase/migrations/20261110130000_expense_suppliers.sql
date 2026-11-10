-- The directory is independent of the fiscal snapshots stored on expenses.
create function public.expense_supplier_key(p_name text, p_nif text)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when regexp_replace(upper(btrim(coalesce(p_nif, ''))), '[^[:alnum:]]', '', 'g') <> ''
      then 'nif:' || regexp_replace(upper(btrim(p_nif)), '[^[:alnum:]]', '', 'g')
    else 'name:' || lower(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g'))
  end;
$$;

create table public.expense_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) <= 160),
  nif text not null default '' check (char_length(nif) <= 40),
  address text not null default '' check (char_length(address) <= 300),
  identity_key text generated always as (public.expense_supplier_key(name, nif)) stored unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expense_suppliers enable row level security;
create policy "expense suppliers admin read" on public.expense_suppliers
  for select to authenticated using (public.is_admin());
grant select on public.expense_suppliers to authenticated;

-- Prefer a non-empty address when an older expense has more complete data.
insert into public.expense_suppliers (name, nif, address)
select distinct on (public.expense_supplier_key(vendor, vendor_nif))
  btrim(vendor), btrim(vendor_nif), btrim(vendor_address)
from public.expenses
order by public.expense_supplier_key(vendor, vendor_nif),
  (btrim(vendor_address) <> '') desc, updated_at desc, id;

create function public.capture_expense_supplier()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.vendor, new.vendor_nif, new.vendor_address)
    is not distinct from (old.vendor, old.vendor_nif, old.vendor_address) then
    return new;
  end if;

  insert into public.expense_suppliers (name, nif, address)
  values (btrim(new.vendor), btrim(new.vendor_nif), btrim(new.vendor_address))
  on conflict (identity_key) do update set
    name = excluded.name,
    nif = coalesce(nullif(excluded.nif, ''), public.expense_suppliers.nif),
    address = coalesce(nullif(excluded.address, ''), public.expense_suppliers.address),
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.capture_expense_supplier() from public, anon, authenticated;
create trigger expenses_capture_supplier
after insert or update of vendor, vendor_nif, vendor_address on public.expenses
for each row execute function public.capture_expense_supplier();

create function public.search_expense_suppliers(p_query text)
returns table (id uuid, name text, nif text, address text)
language plpgsql stable security invoker
set search_path = ''
as $$
declare v_query text := lower(left(btrim(coalesce(p_query, '')), 160));
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede consultar proveedores';
  end if;
  if v_query = '' then return; end if;
  return query
    select supplier.id, supplier.name, supplier.nif, supplier.address
    from public.expense_suppliers supplier
    where strpos(lower(supplier.name), v_query) > 0
      or strpos(lower(supplier.nif), v_query) > 0
    order by supplier.name, supplier.id
    limit 10;
end;
$$;

revoke all on function public.search_expense_suppliers(text) from public, anon;
grant execute on function public.search_expense_suppliers(text) to authenticated;
notify pgrst, 'reload schema';