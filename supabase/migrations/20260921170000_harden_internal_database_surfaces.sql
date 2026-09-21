-- Trigger functions are implementation details, not public RPC endpoints.
revoke all on function public.audit_invoice_draft_created() from public, anon, authenticated;
revoke all on function public.audit_issued_invoice_created() from public, anon, authenticated;
revoke all on function public.prevent_closed_daily_route_itinerary_changes() from public, anon, authenticated;
revoke all on function public.prevent_issued_invoice_draft_mutation() from public, anon, authenticated;
revoke all on function public.queue_payment_request_notifications() from public, anon, authenticated;
revoke all on function public.snapshot_letter_stop_coordinates() from public, anon, authenticated;
revoke all on function public.snapshot_request_stop_coordinates() from public, anon, authenticated;

-- These tables are written by triggers and backend workers only.
revoke all on public.billing_notifications from public, anon, authenticated;
revoke all on public.daily_route_closure_notifications from public, anon, authenticated;
revoke all on public.invoice_payments from public, anon, authenticated;
revoke all on public.invoice_series_counters from public, anon, authenticated;
revoke all on public.transport_request_notifications from public, anon, authenticated;

-- Keep the backend-only intent explicit for future policy reviews.
create policy "billing notifications backend only" on public.billing_notifications
  for all to anon, authenticated using (false) with check (false);

create policy "daily route closure notifications backend only" on public.daily_route_closure_notifications
  for all to anon, authenticated using (false) with check (false);

create policy "invoice payments backend only" on public.invoice_payments
  for all to anon, authenticated using (false) with check (false);

create policy "invoice series counters backend only" on public.invoice_series_counters
  for all to anon, authenticated using (false) with check (false);

create policy "transport request notifications backend only" on public.transport_request_notifications
  for all to anon, authenticated using (false) with check (false);