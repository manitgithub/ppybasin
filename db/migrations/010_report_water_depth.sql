begin;
alter table public.citizen_reports
  add column if not exists water_depth text not null default 'unknown';
-- Values describe a citizen's observation, not sensor measurements or calibrated warning levels.
alter table public.citizen_reports drop constraint if exists citizen_reports_water_depth_allowed;
alter table public.citizen_reports add constraint citizen_reports_water_depth_allowed
  check (water_depth in ('unknown','dry','ankle','knee','waist','neck','overhead'));
comment on column public.citizen_reports.water_depth is 'Citizen-observed water depth relative to an adult body. Not converted to metres or used as a validated hazard threshold.';
commit;
