-- The public client flow creates the least-privileged `user` role. Existing
-- `cliente` records are kept compatible during the rollout and migrated here.
alter table public.profiles
  add column if not exists phone text not null default '';

update public.profiles set role = 'user' where role = 'cliente';

-- Staff registrations intentionally default to transportista. The only
-- client-controlled metadata accepted here can grant the lower-privileged
-- `user` role; administration remains an explicit backoffice action.
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
    case when new.raw_user_meta_data ->> 'account_type' = 'user'
      then 'user'::public.app_role else 'transportista'::public.app_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;