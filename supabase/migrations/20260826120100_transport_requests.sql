-- Pet owners register themselves, so self-registration stops granting transportista.
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
  -- Every following self-registration is a client of the portal.
  select case when exists (select 1 from public.profiles) then 'cliente'::public.app_role else 'admin'::public.app_role end into assigned_role;
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

-- Single-row configuration: change these values to retune the automatic sizing.
create table public.animal_size_thresholds (
  id boolean primary key default true check (id),
  medium_min_weight_kg numeric(6,2) not null default 10,
  large_min_weight_kg numeric(6,2) not null default 25,
  medium_min_length_cm numeric(6,2) not null default 55,
  large_min_length_cm numeric(6,2) not null default 80,
  medium_min_height_cm numeric(6,2) not null default 40,
  large_min_height_cm numeric(6,2) not null default 60,
  updated_at timestamptz not null default now()
);

insert into public.animal_size_thresholds (id) values (true) on conflict (id) do nothing;

create trigger animal_size_thresholds_updated_at
before update on public.animal_size_thresholds for each row execute function public.set_updated_at();

-- The declared weight and each measurement are evaluated separately and the
-- largest resulting size wins, so an unusually long but light animal still fits.
create or replace function public.size_for_measurements(
  p_weight_kg numeric,
  p_length_cm numeric,
  p_height_cm numeric
)
returns public.animal_size language sql stable set search_path = '' as $$
  with config as (select * from public.animal_size_thresholds where id),
  ranks as (
    select greatest(
      case when p_weight_kg >= config.large_min_weight_kg then 2 when p_weight_kg >= config.medium_min_weight_kg then 1 else 0 end,
      case when p_length_cm >= config.large_min_length_cm then 2 when p_length_cm >= config.medium_min_length_cm then 1 else 0 end,
      case when p_height_cm >= config.large_min_height_cm then 2 when p_height_cm >= config.medium_min_height_cm then 1 else 0 end
    ) as rank
    from config
  )
  select case (select rank from ranks) when 2 then 'grande'::public.animal_size when 1 then 'mediano'::public.animal_size else 'pequeno'::public.animal_size end;
$$;

create type public.transport_request_status as enum (
  'pago_pendiente', 'por_verificar', 'confirmada', 'rechazada', 'en_ruta', 'entregada', 'cancelada'
);

create table public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  origin_text text not null,
  destination_text text not null,
  desired_date date not null,
  route_template_id uuid references public.route_templates(id) on delete set null,
  notes text not null default '',
  status public.transport_request_status not null default 'pago_pendiente',
  payment_reference text not null default '',
  paid_at timestamptz,
  admin_note text not null default '',
  letter_id text references public.carriage_letters(id) on delete set null,
  daily_route_id uuid references public.daily_routes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transport_requests_requester_idx on public.transport_requests(requester_id, created_at desc);
create index transport_requests_status_idx on public.transport_requests(status, desired_date);

create trigger transport_requests_updated_at
before update on public.transport_requests for each row execute function public.set_updated_at();

create table public.transport_request_animals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.transport_requests(id) on delete cascade,
  ordinal integer not null default 1 check (ordinal > 0),
  species text not null,
  breed text not null default '',
  weight_kg numeric(6,2) not null check (weight_kg > 0),
  length_cm numeric(6,2) not null check (length_cm > 0),
  height_cm numeric(6,2) not null check (height_cm > 0),
  width_cm numeric(6,2) not null check (width_cm > 0),
  size public.animal_size not null,
  unique (request_id, ordinal)
);

-- The client never chooses a size: it is always recalculated from the measurements.
create or replace function public.set_request_animal_size()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.size = public.size_for_measurements(new.weight_kg, new.length_cm, new.height_cm);
  return new;
end;
$$;

create trigger transport_request_animals_size
before insert or update of weight_kg, length_cm, height_cm
on public.transport_request_animals for each row execute function public.set_request_animal_size();

create table public.transport_request_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.transport_requests(id) on delete cascade,
  kind text not null check (kind in ('confirmacion', 'rechazo')),
  channel text not null check (channel in ('whatsapp', 'email')),
  recipient text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'enviada', 'fallida')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, kind, channel)
);
