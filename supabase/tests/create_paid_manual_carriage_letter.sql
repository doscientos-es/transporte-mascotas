begin;

do $$
declare
  function_source text;
  function_signature regprocedure;
begin
  function_signature := to_regprocedure(
    'public.create_paid_manual_carriage_letter(uuid,text,jsonb,jsonb,text,text,text,text,text[],public.payer_type,jsonb,numeric,boolean,jsonb,jsonb,integer,text,jsonb)'
  );
  if function_signature is null then
    raise exception 'Paid manual carriage-letter function is not installed';
  end if;

  select prosrc into function_source from pg_proc where oid = function_signature;
  if position('public.is_admin()' in function_source) = 0
    or position('public.create_manual_carriage_letter' in function_source) = 0
    or position('public.confirm_invoice_payment' in function_source) = 0
    or position('public.invoice_payments' in function_source) = 0 then
    raise exception 'Paid letter creation must authorize admin, create the letter, record payment, and issue the invoice';
  end if;

  if not has_function_privilege('authenticated', function_signature, 'EXECUTE')
    or has_function_privilege('anon', function_signature, 'EXECUTE') then
    raise exception 'Paid letter creation must only be executable by authenticated users';
  end if;
end;
$$;

rollback;