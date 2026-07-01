begin;

create table if not exists public.villages (
  id bigserial primary key,
  code text unique,
  name text not null,
  tambon text not null,
  households integer not null default 0,
  population integer not null default 0,
  risk_status text not null default 'normal',
  primary_shelter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint villages_households_range check (households >= 0),
  constraint villages_population_range check (population >= 0),
  constraint villages_risk_status_allowed check (risk_status in ('normal', 'watch', 'high'))
);

insert into public.villages (code, name, tambon, households, population, risk_status, primary_shelter)
values
  ('PPY-VIL-001', 'บ้านป่าพะยอม', 'ป่าพะยอม', 684, 2140, 'watch', 'ศูนย์พักพิงเทศบาลป่าพะยอม'),
  ('PPY-VIL-002', 'บ้านทุ่งยาว', 'ลานข่อย', 428, 1368, 'normal', 'โรงเรียนบ้านทุ่งยาว'),
  ('PPY-VIL-003', 'บ้านคลองทรายขาว', 'เกาะเต่า', 512, 1715, 'watch', 'ศาลาอเนกประสงค์บ้านคลองทรายขาว'),
  ('PPY-VIL-004', 'บ้านหัวลำ', 'ป่าพะยอม', 391, 1230, 'high', 'วัดบ้านหัวลำ')
on conflict (code) do update set
  name = excluded.name,
  tambon = excluded.tambon,
  households = excluded.households,
  population = excluded.population,
  risk_status = excluded.risk_status,
  primary_shelter = excluded.primary_shelter,
  updated_at = now();

create index if not exists villages_tambon_idx
  on public.villages (tambon);

create index if not exists villages_risk_status_idx
  on public.villages (risk_status);

comment on table public.villages is 'Village master data for SMART BASIN data warehouse.';
comment on column public.villages.primary_shelter is 'Primary shelter name used for village evacuation coordination.';

commit;
