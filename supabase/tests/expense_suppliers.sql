-- Run only on a disposable database after migrations. Everything is rolled back.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e3', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000e3', 'authenticated', 'authenticated',
  'supplier-test@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.profiles (id, display_name, role, active)
values ('00000000-0000-4000-8000-0000000000e3', 'Supplier test', 'admin', true)
on conflict (id) do update set role = 'admin', active = true;

do $$
declare
  first_expense uuid := gen_random_uuid();
  second_expense uuid := gen_random_uuid();
begin
  insert into public.expenses (id, expense_date, vendor, vendor_nif, vendor_address, concept, net_amount)
  values (first_expense, current_date, 'Proveedor test', 'B-123TEST', 'Dirección original', 'Test', 10);
  if not exists (select 1 from public.search_expense_suppliers('123test')
    where name = 'Proveedor test' and address = 'Dirección original') then
    raise exception 'Saving an expense must make the supplier searchable';
  end if;

  insert into public.expenses (id, expense_date, vendor, vendor_nif, vendor_address, concept, net_amount)
  values (second_expense, current_date, 'Proveedor renombrado', 'b123test', '', 'Test', 10);
  if (select count(*) from public.expense_suppliers where identity_key = public.expense_supplier_key('', 'B123TEST')) <> 1
    or not exists (select 1 from public.search_expense_suppliers('renombrado') where address = 'Dirección original') then
    raise exception 'NIF variants must identify one supplier without erasing the saved address';
  end if;

  update public.expenses set vendor_address = 'Dirección nueva' where id = second_expense;
  if not exists (select 1 from public.search_expense_suppliers('renombrado') where address = 'Dirección nueva')
    or (select vendor_address from public.expenses where id = first_expense) <> 'Dirección original' then
    raise exception 'Supplier updates must not change historical expense snapshots';
  end if;
  delete from public.expenses where id in (first_expense, second_expense);
  if not exists (select 1 from public.search_expense_suppliers('renombrado')) then
    raise exception 'Suppliers must remain after expenses are deleted';
  end if;
  if has_table_privilege('authenticated', 'public.expense_suppliers', 'INSERT') then
    raise exception 'The directory must not allow direct authenticated writes';
  end if;

  update public.profiles set role = 'user' where id = auth.uid();
  begin
    perform * from public.search_expense_suppliers('renombrado');
    raise exception 'Non-admin supplier lookup should fail';
  exception when others then
    if sqlerrm <> 'Solo administración puede consultar proveedores' then raise; end if;
  end;
end;
$$;
rollback;