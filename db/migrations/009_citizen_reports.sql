begin;

-- New accounts are followers. Administrators are explicitly configured through LINE_ADMIN_USER_IDS.
alter table public.app_users alter column permissions set default '["dashboard:view","reports:create"]'::jsonb;
update public.app_users set permissions = permissions || '["reports:create"]'::jsonb
where role = 'viewer' and not permissions @> '["reports:create"]'::jsonb;

create table if not exists public.citizen_reports (
  id uuid primary key default gen_random_uuid(),
  submission_key uuid not null,
  reporter_id uuid not null references public.app_users(id),
  kind text not null check (kind in ('flood', 'help', 'receded')),
  place text not null check (char_length(place) between 3 and 150),
  latitude double precision,
  longitude double precision,
  observed_at timestamptz not null,
  passability text not null default 'unknown' check (passability in ('unknown','passable','small_blocked','blocked','dry')),
  description text not null check (char_length(description) between 5 and 2000),
  contact_name text not null check (char_length(contact_name) between 1 and 100),
  contact_phone text not null check (contact_phone ~ '^0[0-9]{8,9}$'),
  people_count integer check (people_count between 1 and 10000),
  needs text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','verified','in_progress','resolved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(reporter_id, submission_key),
  check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180))
);
create index if not exists citizen_reports_owner_idx on public.citizen_reports(reporter_id, created_at desc);
create index if not exists citizen_reports_queue_idx on public.citizen_reports(status, created_at desc);

create table if not exists public.citizen_report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.citizen_reports(id) on delete cascade,
  actor_id uuid references public.app_users(id) on delete set null,
  status text not null check (status in ('pending','verified','in_progress','resolved','rejected')),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists citizen_report_events_report_idx on public.citizen_report_events(report_id, created_at);

create table if not exists public.citizen_report_photos (
  report_id uuid primary key references public.citizen_reports(id) on delete cascade,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  data bytea not null check (octet_length(data) between 1 and 5242880),
  created_at timestamptz not null default now()
);
comment on table public.citizen_reports is 'Private citizen incident and assistance reports. Access through authenticated owner/authorized staff APIs only.';
comment on table public.citizen_report_events is 'Append-only report status history, updated transactionally with the report.';
commit;
