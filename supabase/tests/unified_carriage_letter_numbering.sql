-- Run after migrations on a disposable database. No numbers are consumed.
begin;

do $test$
declare
  v_function regprocedure;
  v_source text;
  v_expected constant text := $expected$format('CARTA DE PORTE Nº %s-%s', to_char(current_date, 'YYYY'), nextval('public.manual_carriage_letter_number_seq'))$expected$;
begin
  for v_function in
    select unnest(array[
      'public.confirm_transport_request(uuid,uuid,uuid,uuid,text)'::regprocedure,
      'public.auto_finalize_paid_transport(uuid,timestamptz,jsonb,jsonb)'::regprocedure,
      'public.create_manual_carriage_letter(uuid,text,jsonb,jsonb,text,text,text,text,text[],public.payer_type,jsonb,numeric,boolean,jsonb,jsonb,integer,text,boolean)'::regprocedure
    ])
  loop
    v_source := pg_get_functiondef(v_function);
    if position(v_expected in v_source) = 0
      or position('public.transport_request_letter_seq' in v_source) > 0 then
      raise exception '% does not use the shared carriage-letter sequence', v_function;
    end if;
  end loop;

  if not has_function_privilege('authenticated', 'public.confirm_transport_request(uuid,uuid,uuid,uuid,text)', 'execute')
    or has_function_privilege('anon', 'public.confirm_transport_request(uuid,uuid,uuid,uuid,text)', 'execute')
    or has_function_privilege('authenticated', 'public.auto_finalize_paid_transport(uuid,timestamptz,jsonb,jsonb)', 'execute')
    or not has_function_privilege('service_role', 'public.auto_finalize_paid_transport(uuid,timestamptz,jsonb,jsonb)', 'execute') then
    raise exception 'Portal function privileges changed';
  end if;
end;
$test$;

rollback;