begin;

create table if not exists public.sensor_devices (
  device_id text primary key,
  name text,
  location_name text,
  latitude double precision,
  longitude double precision,
  status text not null default 'active',
  last_seen_at timestamptz,
  last_battery numeric(5, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sensor_devices_device_id_format
    check (device_id ~ '^[A-Za-z0-9_-]{2,64}$'),
  constraint sensor_devices_status_allowed
    check (status in ('active', 'inactive', 'maintenance')),
  constraint sensor_devices_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint sensor_devices_longitude_range
    check (longitude is null or longitude between -180 and 180),
  constraint sensor_devices_last_battery_range
    check (last_battery is null or last_battery between 0 and 30)
);

create table if not exists public.sensor_readings (
  id bigserial primary key,
  device_id text not null references public.sensor_devices (device_id) on update cascade on delete restrict,
  temperature numeric(6, 2) not null,
  humidity numeric(5, 2) not null,
  wind_speed numeric(6, 2) not null,
  battery numeric(5, 2) not null,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  raw_payload jsonb,
  constraint sensor_readings_unique_device_time unique (device_id, recorded_at),
  constraint sensor_readings_temperature_range check (temperature between -50 and 100),
  constraint sensor_readings_humidity_range check (humidity between 0 and 100),
  constraint sensor_readings_wind_speed_range check (wind_speed between 0 and 150),
  constraint sensor_readings_battery_range check (battery between 0 and 30)
);

create index if not exists sensor_readings_recorded_at_idx
  on public.sensor_readings (recorded_at desc);

create index if not exists sensor_readings_device_recorded_at_idx
  on public.sensor_readings (device_id, recorded_at desc);

create index if not exists sensor_devices_last_seen_at_idx
  on public.sensor_devices (last_seen_at desc);

comment on table public.sensor_devices is 'IoT sensor device registry and latest device state.';
comment on table public.sensor_readings is 'Time-series readings received from IoT sensor webhook POST /api/sensor.';
comment on column public.sensor_readings.recorded_at is 'Timestamp reported by the sensor device.';
comment on column public.sensor_readings.received_at is 'Timestamp when the API server received the payload.';

commit;
