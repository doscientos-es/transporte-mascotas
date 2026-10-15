begin;

-- Administrators can see every account and choose who is admin, without depending
-- on invitation emails. Role changes happen only here, inside the database.
create or replace function public.list_user_roles(p_query text default null)
returns table (id uuid, email text, display_name text, role public.app_role, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede ver los usuarios';
  end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where v_query is null
      or u.email ilike '%' || v_query || '%'
      or p.display_name ilike '%' || v_query || '%'
    order by (p.role = 'admin') desc, p.display_name, u.email
    limit 50;
end;
$$;

create or replace function public.set_user_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede cambiar roles';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'No puedes cambiar tu propio rol';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
  insert into public.audit_logs (actor_id, event_type, entity_type, entity_id, data)
  values ((select auth.uid()), 'set_user_role', 'profile', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

revoke all on function public.list_user_roles(text) from public, anon;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.list_user_roles(text) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

commit;
