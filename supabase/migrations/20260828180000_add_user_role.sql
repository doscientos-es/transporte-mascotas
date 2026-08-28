-- Kept separate from its usage because PostgreSQL requires an enum addition
-- to commit before the new value can be used by subsequent statements.
alter type public.app_role add value if not exists 'user';