begin;

do $$
begin
  if exists (select 1 from public.profiles where role = 'cliente') then
    raise exception 'Cannot remove legacy role cliente while profiles still use it';
  end if;
end;
$$;

alter table public.profiles alter column role drop default;
alter type public.app_role rename to app_role_legacy;
create type public.app_role as enum ('admin', 'transportista', 'user');

alter table public.profiles
  alter column role type public.app_role using role::text::public.app_role,
  alter column role set default 'transportista'::public.app_role;

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
    case
      when new.raw_user_meta_data ->> 'account_type' = 'user' then 'user'::public.app_role
      else 'transportista'::public.app_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop type public.app_role_legacy;

commit;