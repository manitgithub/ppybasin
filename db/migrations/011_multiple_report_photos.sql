begin;
-- Retain existing attachments while changing one-photo-per-report to ordered photo records.
alter table public.citizen_report_photos add column if not exists id uuid not null default gen_random_uuid();
alter table public.citizen_report_photos add column if not exists filename text not null default 'ภาพประกอบ';
alter table public.citizen_report_photos add column if not exists sort_order integer not null default 0;
alter table public.citizen_report_photos drop constraint if exists citizen_report_photos_pkey;
alter table public.citizen_report_photos add constraint citizen_report_photos_pkey primary key (id);
create unique index if not exists citizen_report_photos_order_idx on public.citizen_report_photos(report_id, sort_order);
alter table public.citizen_report_photos drop constraint if exists citizen_report_photos_order_allowed;
alter table public.citizen_report_photos add constraint citizen_report_photos_order_allowed check (sort_order between 0 and 7);
comment on table public.citizen_report_photos is 'Up to eight private ordered photos per report. Owner/authorized staff access only.';
commit;
