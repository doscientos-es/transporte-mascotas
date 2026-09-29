-- Generated documents are admin-only; backend functions use the service role.
drop policy if exists "authenticated read generated files" on storage.objects;

-- Transport requests are marked as paid only by the Redsys webhook.
revoke all on function public.confirm_transport_request_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_transport_request_payment(uuid, text) to service_role;
