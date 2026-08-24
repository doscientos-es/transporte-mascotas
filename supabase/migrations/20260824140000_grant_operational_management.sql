-- RLS authorizes administrators, but PostgREST also requires table privileges.
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.route_templates to authenticated;
grant select, insert, update, delete on public.route_template_stops to authenticated;
grant select, insert, update, delete on public.route_defaults to authenticated;
grant select, insert, update, delete on public.animal_size_rules to authenticated;
grant select, insert, update, delete on public.daily_routes to authenticated;
grant select, insert, update, delete on public.daily_route_stops to authenticated;
grant select, insert, update, delete on public.route_actions to authenticated;
grant select, insert, update, delete on public.van_assignments to authenticated;
grant select, insert, update, delete on public.invoice_drafts to authenticated;
grant select, insert, update, delete on public.audit_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Background functions authenticate with service_role and bypass RLS, but still
-- need explicit Data API privileges under the current Supabase defaults.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
