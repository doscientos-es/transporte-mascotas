-- Makes manual payment confirmations traceable in the same event log as gateway
-- payments. Every attempt of confirm-manual-transport-payment writes one row per
-- stage (see MANUAL_PAYMENT_ERRORS in that function for the error codes).
--   trace_id   groups all rows of a single attempt; it is also returned to the admin UI.
--   error_code stable machine-readable code ('' when there is no error).
--   actor_id   admin who triggered the action.
--   details    technical context (database error body, payment method, invoice id...).
alter table public.payment_transaction_events
  drop constraint payment_transaction_events_event_source_check,
  add constraint payment_transaction_events_event_source_check
    check (event_source in ('checkout_prepared', 'gateway_notification', 'admin_manual'));

alter table public.payment_transaction_events
  drop constraint payment_transaction_events_outcome_check,
  add constraint payment_transaction_events_outcome_check
    check (outcome in (
      'started', 'received', 'confirmation_pending', 'confirmed', 'declined',
      'review_required', 'retryable_error', 'ignored', 'completed_with_warning'
    ));

alter table public.payment_transaction_events
  add column trace_id uuid,
  add column error_code text not null default '',
  add column actor_id uuid references auth.users (id) on delete set null,
  add column details jsonb not null default '{}'::jsonb;

create index payment_transaction_events_trace_idx
  on public.payment_transaction_events (trace_id) where trace_id is not null;
create index payment_transaction_events_errors_idx
  on public.payment_transaction_events (created_at desc) where error_code <> '';

notify pgrst, 'reload schema';
