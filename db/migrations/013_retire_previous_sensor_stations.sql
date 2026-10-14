begin;

-- Remove the previous six stations from the installation list without deleting readings.
update public.sensor_devices
set
  status = 'inactive',
  metadata = metadata || '{"excluded_from_installation_list":true,"retired_by":"hydro_station_update_2026_10_14"}'::jsonb,
  updated_at = now()
where device_id in ('WS001', 'WS002', 'WS003', 'WS004', 'WS005', 'WS006');

commit;
