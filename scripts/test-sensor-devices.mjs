import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import pg from 'pg';

for (const file of ['.env.local', '.env']) {
  try { process.loadEnvFile(file); } catch { /* Optional local configuration. */ }
}
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for the temporary-table integration test');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  // All writes are isolated in temporary tables on this connection.
  await client.query('create temp table sensor_devices (like public.sensor_devices including all)');
  await client.query('create temp table sensor_readings (like public.sensor_readings including defaults including constraints including indexes)');
  await client.query('alter table pg_temp.sensor_readings alter column id drop default');
  await client.query('alter table pg_temp.sensor_readings add foreign key (device_id) references pg_temp.sensor_devices(device_id) on update cascade');
  const db = {
    query: (sql, params) => client.query(sql.replaceAll('public.sensor_', 'pg_temp.sensor_'), params),
    connect: async () => ({ query: db.query, release() {} }),
  };
  const api = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/app/api/sensor/devices/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: api, require: () => ({ getPool: () => db }), Response, URL, console });
  const save = async (body) => api.POST(new Request('http://localhost/api/sensor/devices', { method: 'POST', body: JSON.stringify(body) }));
  const form = { device_id: 'PPY-01', name: 'Station', latitude: 7.8, longitude: 100, status: 'active' };
  assert.equal((await save(form)).status, 201);
  await db.query(`insert into public.sensor_devices(device_id, metadata) values ('WS001', '{"excluded_from_installation_list":true}')`);
  await db.query(`insert into public.sensor_readings(id,device_id,temperature,humidity,wind_speed,battery,recorded_at) values (1,'WS001',28,80,0,12,'2026-10-30T00:00:00Z')`);
  assert.equal((await save({ ...form, original_device_id: 'PPY-01', device_id: 'WS001', name: 'Updated' })).status, 201);
  let visible = await (await api.GET(new Request('http://localhost/api/sensor/devices'))).json();
  assert.equal(visible.devices.length, 1, 'Changing the ID must not leave a duplicate station');
  assert.equal(visible.devices[0].device_id, 'WS001');
  assert.equal(visible.devices[0].name, 'Updated');
  assert.equal(visible.devices[0].hidden_from_map, false);
  assert.equal(visible.devices[0].readings_count, 1);
  assert.equal(visible.devices[0].latest_reading.temperature, 28);
  assert.equal((await save({ ...form, original_device_id: 'WS001', device_id: 'lowerCase' })).status, 201);
  assert.equal((await db.query('select device_id from public.sensor_readings')).rows[0].device_id, 'lowerCase', 'Renaming cascades to historical readings and preserves case');
  assert.equal((await save({ ...form, original_device_id: 'lowerCase', device_id: 'lowerCase', name: 'Edited', location_name: 'Updated location', latitude: 7.83, longitude: 99.9, status: 'maintenance' })).status, 201);
  const edited = (await db.query('select name, location_name, latitude, longitude, status from public.sensor_devices where device_id = $1', ['lowerCase'])).rows[0];
  assert.deepEqual(edited, { name: 'Edited', location_name: 'Updated location', latitude: 7.83, longitude: 99.9, status: 'maintenance' });
  assert.equal((await db.query('select count(*)::int as count from public.sensor_readings where device_id = $1', ['lowerCase'])).rows[0].count, 1, 'Editing station metadata preserves readings');
  await save({ ...form, device_id: 'OTHER' });
  assert.equal((await save({ ...form, original_device_id: 'lowerCase', device_id: 'OTHER' })).status, 409);
  await db.query(`insert into public.sensor_devices(device_id,metadata) values ('HIDDEN','{"excluded_from_installation_list":true}')`);
  await db.query(`insert into public.sensor_readings(id,device_id,temperature,humidity,wind_speed,battery,recorded_at) values (2,'HIDDEN',29,80,0,12,'2026-10-30T00:00:00Z')`);
  assert.equal((await save({ ...form, original_device_id: 'lowerCase', device_id: 'HIDDEN' })).status, 409, 'Overlapping history cannot be silently discarded');
  assert.equal((await db.query('select count(*)::int as count from public.sensor_readings')).rows[0].count, 2);
  visible = await (await api.GET(new Request('http://localhost/api/sensor/devices'))).json();
  const all = await (await api.GET(new Request('http://localhost/api/sensor/devices?include_hidden=1'))).json();
  assert.equal(all.devices.length, visible.devices.length + 1);
  assert.equal((await save({ ...form, original_device_id: 'MISSING' })).status, 404);
  await db.query('truncate public.sensor_readings, public.sensor_devices');
  for (let i = 1; i <= 6; i++) {
    await save({ ...form, device_id: `PPY-0${i}`, name: `Station ${i}`, latitude: 7.8 + i / 100 });
    await db.query(`insert into public.sensor_devices(device_id,metadata) values ($1,'{"excluded_from_installation_list":true}')`, [`WS00${i}`]);
  }
  await db.query(`insert into public.sensor_readings(id,device_id,temperature,humidity,wind_speed,battery,recorded_at) values (10,'WS001',28,80,0,12,'2026-10-30T00:00:00Z'), (11,'PPY-01',27,80,0,12,'2026-10-29T00:00:00Z')`);
  await save({ ...form, device_id: 'XX', name: 'Station 1', latitude: 7.81 });
  const migration = readFileSync('db/migrations/014_use_ws_sensor_station_ids.sql', 'utf8');
  await db.query(migration);
  await db.query(migration);
  visible = await (await api.GET(new Request('http://localhost/api/sensor/devices'))).json();
  assert.equal(visible.devices.length, 6);
  assert.deepEqual(visible.devices.map(d => d.device_id), ['WS001','WS002','WS003','WS004','WS005','WS006']);
  assert.equal(visible.devices[0].name, 'Station 1');
  assert.equal(visible.devices[0].latitude, 7.81);
  assert.equal(visible.devices[0].readings_count, 2);
  assert.equal(visible.devices[0].latest_reading.temperature, 28);
  assert.ok(visible.devices.every(d => !d.hidden_from_map));
  assert.equal((await db.query("select metadata->>'excluded_from_installation_list' as hidden from public.sensor_devices where device_id = 'XX'")).rows[0].hidden, 'true', 'Empty accidental duplicate must not cover the live map marker');
  console.log('PASS: edits, rename with history, incoming-device merge, map visibility/latest data, case-sensitive IDs, conflict rollback, hidden-device management');
  console.log('PASS: six-station WS migration preserves locations and both histories; safe to run twice');
  const history = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/app/api/sensor/history/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: history, require: () => ({ getPool: () => db }), Response, URL, console });
  await db.query('truncate public.sensor_readings');
  await db.query(`insert into public.sensor_readings(id,device_id,temperature,humidity,wind_speed,battery,recorded_at,water_level)
    select n, 'WS001', 28, 80, 0, 12, '2026-10-30T00:00:00Z'::timestamptz + n * interval '1 minute', n / 100.0
    from generate_series(1, 80) n`);
  await db.query(`insert into public.sensor_readings(id,device_id,temperature,humidity,wind_speed,battery,recorded_at,water_level)
    values (81,'WS002',28,80,0,12,'2026-10-30T03:00:00Z',9), (82,'WS001',28,80,0,12,'2026-10-30T04:00:00Z',null)`);
  const waterHistory = await (await history.GET(new Request('http://localhost/api/sensor/history?device_id=WS001'))).json();
  assert.equal(waterHistory.readings.length, 50);
  assert.equal(waterHistory.readings[0].water_level, .31);
  assert.equal(waterHistory.readings.at(-1).water_level, .8);
  assert.ok(waterHistory.readings.every((point, index, all) => !index || Date.parse(point.recorded_at) > Date.parse(all[index - 1].recorded_at)));
  assert.equal((await (await history.GET(new Request('http://localhost/api/sensor/history?device_id=WS003'))).json()).readings.length, 0);
  assert.equal((await history.GET(new Request('http://localhost/api/sensor/history?device_id=invalid%27'))).status, 400);
  console.log('PASS: water history returns latest 50 measured values for selected station in chronological order; nulls, other stations, empty history and invalid IDs handled');
} finally {
  await client.end();
}
