begin;

alter table public.flood_alerts
  add column if not exists resolved_by text,
  add column if not exists resolved_by_name text,
  add column if not exists resolved_at timestamptz;

alter table public.flood_alerts
  drop constraint if exists flood_alerts_status_allowed,
  add constraint flood_alerts_status_allowed
    check (status in ('pending', 'approved', 'rejected', 'resolved'));

comment on column public.flood_alerts.resolved_at is 'Timestamp when an administrator ended the public alert.';

commit;
