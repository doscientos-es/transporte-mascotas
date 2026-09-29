-- Staff accounts are granted only through admin invitations tied to a confirmed email.
create table public.staff_invitations (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%._%'),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

alter table public.staff_invitations enable row level security;

create policy "admins manage staff invitations" on public.staff_invitations
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on table public.staff_invitations from public, anon, authenticated;
grant select, insert, delete on table public.staff_invitations to authenticated;

create or replace function private.accept_staff_invitation(target_user uuid, target_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user is null or nullif(btrim(coalesce(target_email, '')), '') is null then
    return;
  end if;
  update public.staff_invitations
  set accepted_at = now(), accepted_by = target_user
  where email = lower(btrim(target_email)) and accepted_at is null;
  if found then
    update public.profiles set role = 'transportista' where id = target_user and role = 'user';
  end if;
end;
$$;

revoke all on function private.accept_staff_invitation(uuid, text) from public, anon, authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'user'::public.app_role
  )
  on conflict (id) do nothing;
  if not coalesce(new.is_anonymous, false) and new.email_confirmed_at is not null then
    perform private.accept_staff_invitation(new.id, new.email);
  end if;
  return new;
end;
$$;

create or replace function public.accept_staff_invitation_on_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(new.is_anonymous, false)
    and new.email_confirmed_at is not null
    and (old.email_confirmed_at is null or old.email is distinct from new.email)
  then
    perform private.accept_staff_invitation(new.id, new.email);
  end if;
  return new;
end;
$$;

create or replace function public.accept_staff_invitation_for_existing_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_user uuid;
begin
  select id into existing_user
  from auth.users
  where lower(email) = new.email
    and email_confirmed_at is not null
    and not coalesce(is_anonymous, false)
  limit 1;
  perform private.accept_staff_invitation(existing_user, new.email);
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.accept_staff_invitation_on_email_confirmation() from public, anon, authenticated;
revoke all on function public.accept_staff_invitation_for_existing_user() from public, anon, authenticated;

drop trigger if exists accept_staff_invitation_after_email_confirmation on auth.users;
create trigger accept_staff_invitation_after_email_confirmation
  after update of email_confirmed_at, email on auth.users
  for each row execute function public.accept_staff_invitation_on_email_confirmation();

create trigger accept_staff_invitation_after_insert
  after insert on public.staff_invitations
  for each row execute function public.accept_staff_invitation_for_existing_user();
