-- Run only on a disposable database after migrations. Everything is rolled back.
begin;
do $$
declare
  expense_id uuid := gen_random_uuid();
  saved public.expenses%rowtype;
begin
  insert into public.expenses (id, expense_date, vendor, concept, lines)
  values (expense_id, current_date, 'Partidas test', 'Test', '[
    {"description":"Servicio","netAmount":100,"vatRate":21},
    {"description":"Material","netAmount":50,"vatRate":10},
    {"description":"Redondeo","netAmount":0.05,"vatRate":10}
  ]'::jsonb);
  select * into saved from public.expenses where id = expense_id;
  if (saved.net_amount, saved.vat_amount, saved.total_amount) <> (150.05, 26.01, 176.06) then
    raise exception 'Multiple tax lines must be rounded and summed correctly';
  end if;

  update public.expenses set notes = 'Edited' where id = expense_id;
  if (select jsonb_array_length(lines) from public.expenses where id = expense_id) <> 3 then
    raise exception 'Unrelated updates must preserve lines';
  end if;

  update public.expenses set lines = '[{"description":"Nueva","netAmount":10,"vatRate":4}]'
    where id = expense_id;
  select * into saved from public.expenses where id = expense_id;
  if (saved.net_amount, saved.vat_rate, saved.vat_amount, saved.total_amount) <> (10, 4, 0.40, 10.40) then
    raise exception 'Editing lines must recalculate totals';
  end if;

  update public.expenses set net_amount = 20, vat_rate = 10 where id = expense_id;
  select * into saved from public.expenses where id = expense_id;
  if (saved.net_amount, saved.vat_amount, saved.total_amount) <> (20, 2, 22)
    or (saved.lines->0->>'netAmount')::numeric <> 20 then
    raise exception 'Legacy updates must remain supported';
  end if;

  begin
    update public.expenses set lines = '[{"description":"","netAmount":10,"vatRate":101}]'
      where id = expense_id;
    raise exception 'Invalid VAT must be rejected';
  exception when raise_exception then
    if sqlerrm = 'Invalid VAT must be rejected' then raise; end if;
  end;
end;
$$;
rollback;
