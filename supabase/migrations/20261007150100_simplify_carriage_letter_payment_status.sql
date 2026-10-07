-- Letter status is no longer derived from route progress. The dashboard reads
-- payment state directly from invoice_drafts, so route lifecycle jobs are redundant.
do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    for v_job_id in execute
      'select jobid from cron.job where jobname = $1'
      using 'sync-carriage-letter-lifecycle'
    loop
      execute 'select cron.unschedule($1)' using v_job_id;
    end loop;
  end if;
end;
$$;

drop trigger if exists invoice_drafts_sync_carriage_letter_status on public.invoice_drafts;
drop trigger if exists route_actions_sync_carriage_letter_status on public.route_actions;
drop trigger if exists daily_routes_sync_carriage_letter_status on public.daily_routes;
drop trigger if exists carriage_letters_schedule_manual_before_insert on public.carriage_letters;

drop function if exists public.sync_carriage_letter_status_from_invoice();
drop function if exists public.sync_carriage_letter_status_from_route_action();
drop function if exists public.sync_carriage_letter_status_from_route_schedule();
drop function if exists public.sync_due_carriage_letter_statuses();
drop function if exists public.sync_carriage_letter_status(text);
drop function if exists public.schedule_manual_carriage_letter();

notify pgrst, 'reload schema';