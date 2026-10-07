-- Manual letters stay pending until their linked payment request is paid.
create or replace function public.schedule_manual_carriage_letter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entry_source = 'manual' then new.status := 'pendiente'; end if;
  return new;
end;
$$;

create or replace function public.sync_carriage_letter_status(p_letter_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status public.letter_status;
  v_next_status public.letter_status;
  v_has_invoice boolean;
  v_is_paid boolean := false;
  v_all_animals_delivered boolean;
  v_route_started boolean;
begin
  select letter.status into v_current_status
  from public.carriage_letters letter
  where letter.id = p_letter_id
  for update;

  if not found or v_current_status = 'cancelada' then return; end if;

  select exists (
    select 1 from public.invoice_drafts invoice where invoice.letter_id = p_letter_id
  ) into v_has_invoice;

  if v_has_invoice then
    select exists (
      select 1 from public.invoice_drafts invoice
      where invoice.letter_id = p_letter_id and invoice.status = 'emitida'
    ) into v_is_paid;
    if not v_is_paid then
      v_next_status := 'pendiente';
    end if;
  end if;

  if v_next_status is null then
    select exists (
      select 1 from public.animals animal where animal.letter_id = p_letter_id
    ) and not exists (
      select 1
      from public.animals animal
      where animal.letter_id = p_letter_id
        and not exists (
          select 1
          from public.route_actions action
          where action.letter_id = p_letter_id
            and action.animal_id = animal.id
            and action.action_type = 'entrega'
            and action.status = 'completada'
        )
    ) into v_all_animals_delivered;

    if v_all_animals_delivered then
      v_next_status := 'entregada';
    else
      select exists (
        select 1
        from public.route_actions action
        join public.daily_routes route on route.id = action.daily_route_id
        where action.letter_id = p_letter_id
          and ((route.service_date + route.start_time) at time zone 'Europe/Madrid') <= now()
      ) into v_route_started;

      if v_route_started and (v_is_paid or v_current_status <> 'pendiente') then
        v_next_status := 'en_ruta';
      elsif v_is_paid or v_current_status in ('programada', 'en_ruta', 'revisada') then
        v_next_status := 'programada';
      else
        return;
      end if;
    end if;
  end if;

  if v_current_status is distinct from v_next_status then
    update public.carriage_letters set status = v_next_status where id = p_letter_id;
  end if;
end;
$$;

create or replace function public.sync_carriage_letter_status_from_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_carriage_letter_status(new.letter_id);
  return new;
end;
$$;

drop trigger if exists invoice_drafts_sync_carriage_letter_status on public.invoice_drafts;
create trigger invoice_drafts_sync_carriage_letter_status
after insert or update of status on public.invoice_drafts
for each row execute function public.sync_carriage_letter_status_from_invoice();

create or replace function public.sync_carriage_letter_status_from_route_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_carriage_letter_status(old.letter_id);
    return old;
  end if;

  perform public.sync_carriage_letter_status(new.letter_id);
  if tg_op = 'UPDATE' and old.letter_id is distinct from new.letter_id then
    perform public.sync_carriage_letter_status(old.letter_id);
  end if;
  return new;
end;
$$;

drop trigger if exists route_actions_sync_carriage_letter_status on public.route_actions;
create trigger route_actions_sync_carriage_letter_status
after insert or update or delete on public.route_actions
for each row execute function public.sync_carriage_letter_status_from_route_action();

create or replace function public.sync_carriage_letter_status_from_route_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_letter record;
begin
  for v_letter in
    select distinct action.letter_id
    from public.route_actions action
    where action.daily_route_id = new.id
  loop
    perform public.sync_carriage_letter_status(v_letter.letter_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists daily_routes_sync_carriage_letter_status on public.daily_routes;
create trigger daily_routes_sync_carriage_letter_status
after update of service_date, start_time on public.daily_routes
for each row execute function public.sync_carriage_letter_status_from_route_schedule();

create or replace function public.sync_due_carriage_letter_statuses()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_letter record;
begin
  for v_letter in
    select distinct action.letter_id
    from public.route_actions action
    join public.daily_routes route on route.id = action.daily_route_id
    join public.carriage_letters letter on letter.id = action.letter_id
    where letter.status = 'programada'
      and ((route.service_date + route.start_time) at time zone 'Europe/Madrid') <= now()
  loop
    perform public.sync_carriage_letter_status(v_letter.letter_id);
  end loop;
end;
$$;

revoke all on function public.sync_carriage_letter_status(text) from public, anon, authenticated;
revoke all on function public.sync_due_carriage_letter_statuses() from public, anon, authenticated;

-- Replace the old review state in existing letters, then derive invoice-backed
-- letter statuses from payment, route departure time, and completed deliveries.
update public.carriage_letters
set status = 'programada'
where status = 'revisada';

do $$
declare
  v_letter record;
begin
  for v_letter in select id from public.carriage_letters where status <> 'cancelada'
  loop
    perform public.sync_carriage_letter_status(v_letter.id);
  end loop;
end;
$$;

-- Start transitions happen without relying on an admin or transporter opening
-- the application at the scheduled departure time.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'sync-carriage-letter-lifecycle',
  '* * * * *',
  'select public.sync_due_carriage_letter_statuses();'
);

notify pgrst, 'reload schema';