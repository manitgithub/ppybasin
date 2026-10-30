begin;

-- Confirmed mapping: PPY-01..06 -> WS001..006, retaining survey locations.
-- Lock both identities while moving history and registry data together.
select device_id from public.sensor_devices
where device_id in ('PPY-01','PPY-02','PPY-03','PPY-04','PPY-05','PPY-06',
                    'WS001','WS002','WS003','WS004','WS005','WS006')
order by device_id for update;

insert into public.sensor_devices
  (device_id, name, location_name, latitude, longitude, status, last_seen_at, last_battery, metadata)
select 'WS00' || right(device_id, 1), name, location_name, latitude, longitude,
  status, last_seen_at, last_battery,
  (metadata - 'retired_by') || '{"excluded_from_installation_list":false}'::jsonb
from public.sensor_devices where device_id in ('PPY-01','PPY-02','PPY-03','PPY-04','PPY-05','PPY-06')
on conflict (device_id) do update set
  name = excluded.name,
  location_name = excluded.location_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  status = excluded.status,
  last_battery = case when excluded.last_seen_at > public.sensor_devices.last_seen_at
    or public.sensor_devices.last_seen_at is null then excluded.last_battery else public.sensor_devices.last_battery end,
  last_seen_at = greatest(public.sensor_devices.last_seen_at, excluded.last_seen_at),
  metadata = (public.sensor_devices.metadata - 'retired_by') || excluded.metadata,
  updated_at = now();

-- A timestamp collision raises a unique violation and rolls back everything;
-- no readings are discarded to resolve a conflict.
update public.sensor_readings set device_id = 'WS00' || right(device_id, 1)
where device_id in ('PPY-01','PPY-02','PPY-03','PPY-04','PPY-05','PPY-06');

delete from public.sensor_devices
where device_id in ('PPY-01','PPY-02','PPY-03','PPY-04','PPY-05','PPY-06');

-- Earlier ID edits could create an empty dashboard duplicate at the exact
-- same station. Retain its registry row, but prevent it covering the live pin.
update public.sensor_devices duplicate
set metadata = duplicate.metadata || '{"excluded_from_installation_list":true}'::jsonb,
  updated_at = now()
where duplicate.metadata->>'source' = 'dashboard'
  and duplicate.device_id not in ('WS001','WS002','WS003','WS004','WS005','WS006')
  and not exists (select 1 from public.sensor_readings r where r.device_id = duplicate.device_id)
  and exists (
    select 1 from public.sensor_devices station
    where station.device_id in ('WS001','WS002','WS003','WS004','WS005','WS006')
      and station.name = duplicate.name
      and station.latitude = duplicate.latitude and station.longitude = duplicate.longitude
  );

commit;
