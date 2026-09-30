begin;

create table if not exists public.flood_alerts (
  id bigserial primary key,
  title text not null,
  area_name text not null,
  message text not null,
  severity text not null default 'warning',
  status text not null default 'pending',
  latitude double precision not null,
  longitude double precision not null,
  radius_m integer not null default 1000,
  blocked_roads jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_by_name text not null,
  approved_by text,
  approved_by_name text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz,
  constraint flood_alerts_severity_allowed check (severity in ('watch', 'warning', 'critical')),
  constraint flood_alerts_status_allowed check (status in ('pending', 'approved', 'rejected')),
  constraint flood_alerts_latitude_range check (latitude between -90 and 90),
  constraint flood_alerts_longitude_range check (longitude between -180 and 180),
  constraint flood_alerts_radius_range check (radius_m between 100 and 50000)
);

create index if not exists flood_alerts_status_created_idx
  on public.flood_alerts (status, created_at desc);

comment on table public.flood_alerts is 'Operator flood alerts requiring administrator approval before public display.';

commit;
