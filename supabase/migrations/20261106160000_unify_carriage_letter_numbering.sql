-- Portal and manual letters must reserve numbers from the same sequence. Keep the
-- installed function bodies and privileges intact, changing only the number expression.
do $migration$
declare
  v_function regprocedure;
  v_source text;
  v_old_expression text;
  v_new_expression constant text := $new$format('CARTA DE PORTE Nº %s-%s', to_char(current_date, 'YYYY'), nextval('public.manual_carriage_letter_number_seq'))$new$;
begin
  for v_function, v_old_expression in
    select * from (values
      (
        'public.confirm_transport_request(uuid,uuid,uuid,uuid,text)'::regprocedure,
        $old$'CARTA DE PORTE Nº ' || to_char(request.desired_date, 'YYYY') || '-P' || lpad(nextval('public.transport_request_letter_seq')::text, 5, '0')$old$
      ),
      (
        'public.auto_finalize_paid_transport(uuid,timestamptz,jsonb,jsonb)'::regprocedure,
        $old$'CARTA DE PORTE Nº ' || to_char(request.desired_date, 'YYYY') || '-P' ||
    lpad(nextval('public.transport_request_letter_seq')::text, 5, '0')$old$
      )
    ) as expressions(function_id, old_expression)
  loop
    v_source := pg_get_functiondef(v_function);
    if (length(v_source) - length(replace(v_source, v_old_expression, ''))) / length(v_old_expression) <> 1 then
      raise exception 'Unexpected numbering expression in %; migration aborted', v_function;
    end if;
    execute replace(v_source, v_old_expression, v_new_expression);
  end loop;
end;
$migration$;