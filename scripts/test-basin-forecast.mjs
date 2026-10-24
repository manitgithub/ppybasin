import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/forecast/basin.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: () => ({ waterTime(value) {
  if (typeof value !== 'string') return NaN;
  const text = value.replace(' ', 'T');
  return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : text + '+07:00');
} }) });
const { rainNumber, parseDailyForecast, activeForecastDays, parseTmdForecast, tmdSampler, FORECAST_BOUNDARY_HASH } = exports;
for (const missing of [null, undefined, '', false, -999, -1, 'N/A', Infinity]) assert.equal(rainNumber(missing), null);
assert.equal(rainNumber('0'), 0);
const now = Date.parse('2026-10-24T22:00:00+07:00');
const rawRow = { province_id: 93, forecast_datetime: '2026-10-24 00:00', rainfall: '0', rainfall_text: 'ไม่มีฝน', media_datetime: '2025-04-04 05:05' };
const daily = parseDailyForecast({ result: 'OK', data: [rawRow, { ...rawRow, province_id: 80 }] }, now);
assert.equal(daily.rows.length, 1, 'Only Phatthalung is included');
assert.equal(daily.rows[0].rainMm, 0);
assert.equal(daily.rows[0].start, Date.parse('2026-10-24T07:00:00+07:00'));
assert.equal(daily.rows[0].end - daily.rows[0].start, 86400000);
assert.equal(daily.issuedAt, null, 'Receiving data never invents an issue time');
assert.equal(daily.mediaMismatch, true, 'Old image metadata is identified');
assert.equal(activeForecastDays(daily.rows, now).length, 1);
assert.equal(activeForecastDays(daily.rows, daily.rows[0].end).length, 0, 'Expired days are not future forecasts');
assert.throws(() => parseDailyForecast({ result: 'OK', data: [rawRow, rawRow] }));
assert.throws(() => parseDailyForecast({ result: 'OK', data: [{ ...rawRow, forecast_datetime: '2026-02-31' }] }));
assert.equal(parseDailyForecast({ result: 'OK', data: [{ ...rawRow, rainfall: null }] }).rows[0].rainMm, null);
const points = [
  { lat: 7.75, lon: 99.8, rain: 0, representative_area_km2: 1 },
  { lat: 7.75, lon: 99.9, rain: 10, representative_area_km2: 3 },
  { lat: 7.85, lon: 99.8, rain: 20, representative_area_km2: 0 },
  { lat: 7.85, lon: 99.9, rain: 30, representative_area_km2: 0 },
];
const frame = { domain: 2, requested_time: '2026-10-24T19:00:00', source_time: '2026-10-24T19:00:00+07:00', unit: 'mm per hourly field (TMD documentation)', grid_hull_covers_basin: true,
  boundary: { source_sha256: FORECAST_BOUNDARY_HASH, area_km2_equal_area: 4 }, points };
const tmd = parseTmdForecast({ series: { model_run_verified: false }, frames: [frame] });
assert.equal(tmd.frames[0].meanMm, 7.5, 'Mean is weighted by representative area, not grid count');
assert.equal(tmd.frames[0].maxMm, 10, 'Maximum ignores grid points outside representative basin area');
assert.equal(tmd.modelRunVerified, false);
const missingPoints = points.map((point, i) => i === 1 ? { ...point, rain: null } : point);
const incomplete = parseTmdForecast({ frames: [{ ...frame, points: missingPoints }] }).frames[0];
assert.equal(incomplete.meanMm, null, 'Missing contributing values prevent whole-basin mean');
assert.equal(incomplete.coverage, .25);
assert.equal(parseTmdForecast({ frames: [{ ...frame, missing: true, points: undefined }] }).frames[0].missing, true);
assert.throws(() => parseTmdForecast({ frames: [{ ...frame, boundary: { ...frame.boundary, source_sha256: 'changed' } }] }));
assert.throws(() => parseTmdForecast({ frames: [frame, frame] }));
const sample = tmdSampler(tmd.frames[0].points);
assert.ok(Math.abs(sample(99.85, 7.8) - 15) < 1e-9, 'Bilinear interpolation of grid centre');
assert.equal(sample(99.7, 7.8), null, 'Never extrapolate outside the grid');
assert.equal(tmdSampler(incomplete.points)(99.85, 7.8), null, 'Never interpolate across missing cell corners');
console.log('PASS: province scope, 07:00 periods, zero/missing, expiry, issue/image times, area weighting, missing frames, boundary identity, bilinear cells and no extrapolation');
