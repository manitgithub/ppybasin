begin;

alter table public.sensor_readings
  add column if not exists direction text,
  add column if not exists rainfall numeric(8, 2),
  add column if not exists water_level numeric(8, 3),
  add column if not exists battery_1 numeric(5, 2),
  add column if not exists battery_2 numeric(5, 2),
  add column if not exists packet_count integer,
  add column if not exists heap integer;

alter table public.sensor_readings
  drop constraint if exists sensor_readings_direction_length,
  drop constraint if exists sensor_readings_rainfall_range,
  drop constraint if exists sensor_readings_water_level_range,
  drop constraint if exists sensor_readings_battery_1_range,
  drop constraint if exists sensor_readings_battery_2_range,
  drop constraint if exists sensor_readings_packet_count_range,
  drop constraint if exists sensor_readings_heap_range,
  add constraint sensor_readings_direction_length
    check (direction is null or char_length(direction) between 1 and 32),
  add constraint sensor_readings_rainfall_range
    check (rainfall is null or rainfall between 0 and 10000),
  add constraint sensor_readings_water_level_range
    check (water_level is null or water_level between -100 and 1000),
  add constraint sensor_readings_battery_1_range
    check (battery_1 is null or battery_1 between 0 and 30),
  add constraint sensor_readings_battery_2_range
    check (battery_2 is null or battery_2 between 0 and 30),
  add constraint sensor_readings_packet_count_range
    check (packet_count is null or packet_count >= 0),
  add constraint sensor_readings_heap_range
    check (heap is null or heap >= 0);

update public.sensor_readings
set battery_1 = battery
where battery_1 is null;

comment on column public.sensor_readings.direction is 'Wind direction reported by the sensor device.';
comment on column public.sensor_readings.rainfall is 'Rainfall amount reported by the sensor device in millimeters.';
comment on column public.sensor_readings.water_level is 'Water level reported by the sensor device in meters.';
comment on column public.sensor_readings.battery_1 is 'Primary battery voltage reported by the sensor device.';
comment on column public.sensor_readings.battery_2 is 'Secondary battery voltage reported by the sensor device.';
comment on column public.sensor_readings.packet_count is 'Packet counter reported by the sensor firmware.';
comment on column public.sensor_readings.heap is 'Available heap reported by the sensor firmware in bytes.';

commit;
