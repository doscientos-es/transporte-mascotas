## Linting and formatting

- After making code changes, run `npx oxlint --fix`, then run `npx oxfmt`.
- Before finishing, run `npx oxlint --deny-warnings --format=agent`.

## Supabase migrations

- Project: `transporte-mascotas`, ref `ajhooctikydsqimotogf`. It is only reachable through the MCP server `supabase backup04` (the CLI `supabase migration list --linked` hangs asking for credentials; other Supabase MCP servers do not see this project).
- Write every schema change as a file in `supabase/migrations/` named `YYYYMMDDHHMMSS_name.sql`.
- To apply a pending migration: compare `list_migrations` (MCP) with the files in `supabase/migrations/`, then run `apply_migration` with the file's SQL (drop `begin;`/`commit;`, the MCP wraps it in a transaction).
- `apply_migration` records the version as the current timestamp, not the file's version. Right after applying, align it so `supabase db push` does not see the file as pending:
  `update supabase_migrations.schema_migrations set version = '<file version>' where version = '<assigned version>' and name = '<name>';`
- Verify afterwards with `execute_sql` (objects exist, latest versions match the file names).
- Never apply a migration without the user asking for it.
