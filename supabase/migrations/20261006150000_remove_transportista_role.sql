begin;

-- Only two roles remain: admin (staff) and user (client).
-- Invited staff become admin directly; leftover transportistas lose staff access.
update public.profiles set role = 'user' where role = 'transportista';
update public.daily_routes set transporter_id = null where transporter_id is not null;

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
    update public.profiles set role = 'admin' where id = target_user and role = 'user';
  end if;
end;
$$;

revoke all on function private.accept_staff_invitation(uuid, text) from public, anon, authenticated;

alter table public.profiles alter column role drop default;
alter type public.app_role rename to app_role_with_transportista;
create type public.app_role as enum ('admin', 'user');

alter table public.profiles
  alter column role type public.app_role using role::text::public.app_role,
  alter column role set default 'user'::public.app_role;

drop type public.app_role_with_transportista;

commit;
