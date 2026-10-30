begin;

update public.sensor_devices
set name = 'โหละท่อม', updated_at = now()
where device_id = 'WS001';

commit;
