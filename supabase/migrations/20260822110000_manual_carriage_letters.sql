-- Manual entry no longer needs a PDF stored alongside the carriage letter.
alter table public.carriage_letters
  alter column original_filename drop not null,
  alter column storage_path drop not null,
  add column if not exists entry_source text not null default 'pdf'
    check (entry_source in ('pdf', 'manual'));