begin;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'invoice_drafts_sync_carriage_letter_status',
        'route_actions_sync_carriage_letter_status',
        'daily_routes_sync_carriage_letter_status',
        'carriage_letters_schedule_manual_before_insert'
      )
  ) then
    raise exception 'A route-based carriage-letter status trigger is still installed';
  end if;

  if to_regprocedure('public.sync_carriage_letter_status(text)') is not null
    or to_regprocedure('public.sync_due_carriage_letter_statuses()') is not null then
    raise exception 'A carriage-letter lifecycle status function is still installed';
  end if;

  if to_regclass('cron.job') is not null and exists (
    select 1 from cron.job where jobname = 'sync-carriage-letter-lifecycle'
  ) then
    raise exception 'The carriage-letter lifecycle cron job is still scheduled';
  end if;
end;
$$;

rollback;