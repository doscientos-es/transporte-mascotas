create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role public.app_role;
begin
  -- In a newly created project the first account is the bootstrap administrator.
  -- Every following self-registration is deliberately limited to transportista.
  select case when exists (select 1 from public.profiles) then 'transportista'::public.app_role else 'admin'::public.app_role end into assigned_role;
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    assigned_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
