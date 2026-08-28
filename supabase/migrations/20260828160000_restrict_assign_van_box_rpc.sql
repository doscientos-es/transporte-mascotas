-- The application uses the six-argument function, which verifies the caller is an admin.
-- Retire the prior per-animal RPC so it cannot bypass the one-box-per-letter rule.
revoke all on function public.assign_van_box(uuid, uuid, integer, integer, integer)
  from public, anon, authenticated;

-- Keep the current RPC accessible only to signed-in users; its implementation
-- performs the administrator check before changing assignments.
revoke all on function public.assign_van_box(uuid, text, uuid, integer, integer, integer)
  from public, anon;
grant execute on function public.assign_van_box(uuid, text, uuid, integer, integer, integer)
  to authenticated;
