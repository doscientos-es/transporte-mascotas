-- Store all tax bases together so each expense is saved atomically.
alter table public.expenses
  add column lines jsonb,
  alter column vat_amount drop expression,
  alter column total_amount drop expression;

update public.expenses
set lines = jsonb_build_array(jsonb_build_object(
  'description', '', 'netAmount', net_amount, 'vatRate', vat_rate
));

alter table public.expenses alter column lines set not null;

create function public.calculate_expense_lines()
returns trigger language plpgsql set search_path = '' as $$
declare
  line jsonb;
  line_net numeric;
  line_rate numeric;
  net_sum numeric := 0;
  vat_sum numeric := 0;
begin
  -- Preserve writes from older clients that only send the original fields.
  if new.lines is null or (tg_op = 'UPDATE' and new.lines = old.lines
      and (new.net_amount, new.vat_rate) is distinct from (old.net_amount, old.vat_rate)) then
    new.lines := jsonb_build_array(jsonb_build_object(
      'description', '', 'netAmount', new.net_amount, 'vatRate', new.vat_rate
    ));
  end if;
  if jsonb_typeof(new.lines) <> 'array' then
    raise exception 'Las partidas del gasto no son válidas';
  end if;
  if jsonb_array_length(new.lines) not between 1 and 100 then
    raise exception 'El gasto debe tener entre 1 y 100 partidas';
  end if;
  for line in select value from jsonb_array_elements(new.lines) loop
    if jsonb_typeof(line) <> 'object'
      or jsonb_typeof(line->'description') is distinct from 'string'
      or char_length(line->>'description') > 240
      or jsonb_typeof(line->'netAmount') is distinct from 'number'
      or jsonb_typeof(line->'vatRate') is distinct from 'number' then
      raise exception 'La partida del gasto no es válida';
    end if;
    line_net := (line->>'netAmount')::numeric;
    line_rate := (line->>'vatRate')::numeric;
    if line_net < 0 or line_net > 9999999999.99 or line_net <> round(line_net, 2)
      or line_rate < 0 or line_rate > 100 or line_rate <> round(line_rate, 2) then
      raise exception 'La base o el IVA de la partida no son válidos';
    end if;
    net_sum := net_sum + line_net;
    vat_sum := vat_sum + round(line_net * line_rate / 100, 2);
  end loop;
  new.net_amount := net_sum;
  -- The legacy field is retained for older clients; lines contain the real rates.
  new.vat_rate := (new.lines->0->>'vatRate')::numeric;
  new.vat_amount := vat_sum;
  new.total_amount := net_sum + vat_sum;
  return new;
end;
$$;

create trigger expenses_calculate_lines
before insert or update on public.expenses
for each row execute function public.calculate_expense_lines();

notify pgrst, 'reload schema';