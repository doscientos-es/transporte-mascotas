-- Self-registration now belongs to pet owners, so the role has to exist before
-- any policy or function can reference it.
alter type public.app_role add value if not exists 'cliente';
