begin;

insert into public.sensor_devices (
  device_id,
  name,
  location_name,
  latitude,
  longitude,
  status,
  metadata
)
values
  (
    'PPY-01',
    'ท่าอ่างป่าพะยอม',
    'คลองป่าพะยอม, อ.ป่าพะยอม, จ.พัทลุง',
    7.775364,
    99.841004,
    'active',
    '{"source":"installation_points","waterway":"คลองป่าพะยอม","district":"ป่าพะยอม","province":"พัทลุง"}'::jsonb
  ),
  (
    'PPY-02',
    'บ้านใต้สะท่อม',
    'คลองคสังขัน, อ.ป่าพะยอม, จ.พัทลุง',
    7.759851,
    99.891585,
    'active',
    '{"source":"installation_points","waterway":"คลองคสังขัน","district":"ป่าพะยอม","province":"พัทลุง"}'::jsonb
  ),
  (
    'PPY-03',
    'บ้านพร้าว',
    'คลองปันแต, อ.ป่าพะยอม, จ.พัทลุง',
    7.80145,
    99.954751,
    'active',
    '{"source":"installation_points","waterway":"คลองปันแต","district":"ป่าพะยอม","province":"พัทลุง"}'::jsonb
  ),
  (
    'PPY-04',
    'บ้านปากคลองเก่า',
    'คลองกระถิน, อ.ควนขนุน, จ.พัทลุง',
    7.74688,
    100.087279,
    'active',
    '{"source":"installation_points","waterway":"คลองกระถิน","district":"ควนขนุน","province":"พัทลุง"}'::jsonb
  ),
  (
    'PPY-05',
    'บ้านห้วยน้ำดำ',
    'คลองห้วยกรวด, อ.ป่าพะยอม, จ.พัทลุง',
    7.86748,
    99.845137,
    'active',
    '{"source":"installation_points","waterway":"คลองห้วยกรวด","district":"ป่าพะยอม","province":"พัทลุง"}'::jsonb
  ),
  (
    'PPY-06',
    'บ้านแหลมโตนด',
    'คลองแม่ไสย่านหนัก, อ.ควนขนุน, จ.พัทลุง',
    7.817655,
    100.047455,
    'active',
    '{"source":"installation_points","waterway":"คลองแม่ไสย่านหนัก","district":"ควนขนุน","province":"พัทลุง"}'::jsonb
  )
on conflict (device_id) do update set
  name = excluded.name,
  location_name = excluded.location_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  status = excluded.status,
  metadata = public.sensor_devices.metadata || excluded.metadata,
  updated_at = now();

delete from public.sensor_devices d
where d.device_id in ('TSL11', 'TX83')
  and not exists (
    select 1
    from public.sensor_readings r
    where r.device_id = d.device_id
  );

update public.sensor_devices
set
  status = 'inactive',
  metadata = metadata || '{"excluded_from_installation_list":true,"source":"retired_installation_point"}'::jsonb,
  updated_at = now()
where device_id in ('TSL11', 'TX83');

commit;
