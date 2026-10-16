begin;

do $$
declare
  function_source text;
begin
  select prosrc into function_source
  from pg_proc
  where oid = 'public.create_manual_carriage_letter(uuid,text,jsonb,jsonb,text,text,text,text,text[],public.payer_type,jsonb,numeric,boolean,jsonb,jsonb,integer)'::regprocedure;

  if function_source is null then
    raise exception 'Manual carriage-letter creation function is not installed';
  end if;

  if position('v_billing_client ->> ''address'', v_billing_client ->> ''city'', v_billing_client ->> ''postalCode''' in function_source) = 0 then
    raise exception 'Manual carriage-letter client insert must include the city value';
  end if;
end;
$$;

rollback;