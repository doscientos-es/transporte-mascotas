-- Run against a disposable database after migrations. Invalid requests must fail before insertion.
begin;
do $$
declare
  animals jsonb := '[{"name":"Test","species":"perro","breed":"mestizo","birth_date":"2020-01-01","weight_kg":1}]';
  payer jsonb := '{"fullName":"Test","nif":"TEST","email":"","phone":"600000000","address":"Test","city":"Test","postalCode":"00000"}';
  contact_email text;
  recipient_email text;
  payer_type public.payer_type;
  expected_error text;
begin
  for contact_email, recipient_email, payer_type, expected_error in
    values
      ('', 'recipient@example.test', 'remitente'::public.payer_type, 'Completa todos los datos fiscales del pagador'),
      ('sender@example.test', '', 'remitente'::public.payer_type, 'Escribe un correo válido para quien recibe'),
      ('sender@example.test', 'recipient@example.test', 'manual'::public.payer_type, 'Completa todos los datos fiscales del pagador')
  loop
    begin
      perform public.submit_transport_request(
        'Test', '600000000', contact_email, null, 'Origen', 'Destino', current_date, '', animals,
        payer_type, payer, 'TEST', 'Test', 'TEST', '600000001', recipient_email,
        'Test', '00000', 'Test', 'Test', 'Test', '00000', 'Test', 'Test', array['microchip']
      );
      raise exception 'A portal request without a required email was accepted';
    exception when others then
      if sqlerrm <> expected_error then raise; end if;
    end;
  end loop;
end;
$$;
rollback;