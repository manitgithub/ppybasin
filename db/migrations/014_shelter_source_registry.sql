begin;

alter table public.shelters drop constraint if exists shelters_status_check;
alter table public.shelters add constraint shelters_status_check
  check (status in ('open', 'full', 'closed', 'standby'));
alter table public.shelters add column if not exists registry_source_key text;
alter table public.shelters add column if not exists registry_source_id text;
alter table public.shelters add column if not exists source_file text;
create unique index if not exists shelters_registry_source_idx
  on public.shelters (registry_source_key, registry_source_id);

create table if not exists public.shelter_registry (
  source_key text not null,
  source_id text not null,
  source_file text not null,
  region text,
  province text,
  district text,
  subdistrict text,
  community text,
  name text,
  capacity integer check (capacity >= 0),
  responsible_organization text,
  coordinator_name text,
  coordinator_phone text,
  electricity text,
  water_supply text,
  toilet_count integer check (toilet_count >= 0),
  latitude double precision,
  longitude double precision,
  coordinate_status text not null check (coordinate_status in ('valid', 'missing', 'invalid', 'suspicious')),
  issues text[] not null default '{}',
  raw_record jsonb not null,
  file_sha256 text not null,
  imported_at timestamptz not null default now(),
  shelter_id bigint references public.shelters(id) on delete set null,
  primary key (source_key, source_id)
);
create index if not exists shelter_registry_location_idx on public.shelter_registry (province, district);
comment on table public.shelter_registry is 'Source shelter inventory including original CSV values and coordinator details; do not expose raw records through public APIs.';
comment on column public.shelters.registry_source_id is 'Representative source row; duplicate venue rows link to the same shelter through shelter_registry.shelter_id.';

commit;
