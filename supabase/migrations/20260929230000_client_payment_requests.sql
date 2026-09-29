-- Clients see the pending payment requests whose payer email matches their account email.
create or replace function public.list_my_payment_requests()
returns table (
  id uuid,
  letter_id text,
  concept text,
  total_amount numeric,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select draft.id, draft.letter_id, draft.concept, draft.total_amount, draft.created_at
    from public.invoice_drafts draft
   where draft.status = 'solicitud_pago'
     and nullif(btrim(draft.client_snapshot ->> 'email'), '') is not null
     and lower(btrim(draft.client_snapshot ->> 'email')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
   order by draft.created_at desc;
$$;

revoke all on function public.list_my_payment_requests() from public, anon;
grant execute on function public.list_my_payment_requests() to authenticated;

notify pgrst, 'reload schema';
