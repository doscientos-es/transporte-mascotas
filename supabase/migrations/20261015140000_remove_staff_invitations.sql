begin;

-- Admins are now chosen from the settings screen (set_user_role), so invitations
-- are no longer used. New accounts always start as 'user'.
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
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

drop trigger if exists accept_staff_invitation_after_email_confirmation on auth.users;
drop table if exists public.staff_invitations;
drop function if exists public.accept_staff_invitation_on_email_confirmation();
drop function if exists public.accept_staff_invitation_for_existing_user();
drop function if exists private.accept_staff_invitation(uuid, text);

commit;
