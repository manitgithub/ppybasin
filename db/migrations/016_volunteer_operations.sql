begin;
alter table public.app_users drop constraint if exists app_users_role_allowed;
alter table public.app_users add constraint app_users_role_allowed check (role in ('admin','operator','volunteer','viewer'));
alter table public.citizen_reports add column if not exists assigned_to uuid references public.app_users(id);
alter table public.citizen_reports add column if not exists claimed_at timestamptz;
create index if not exists citizen_reports_assigned_idx on public.citizen_reports(assigned_to, status);
create table if not exists public.road_closures (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.app_users(id),
  name text not null check (char_length(name) between 3 and 150),
  description text not null check (char_length(description) between 5 and 2000),
  a_lat double precision not null check (a_lat between -90 and 90),
  a_lng double precision not null check (a_lng between -180 and 180),
  b_lat double precision not null check (b_lat between -90 and 90),
  b_lng double precision not null check (b_lng between -180 and 180),
  created_at timestamptz not null default now(),
  reopened_at timestamptz,
  reopened_by uuid references public.app_users(id),
  check (a_lat <> b_lat or a_lng <> b_lng)
);
commit;
