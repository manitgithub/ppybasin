import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const seriesExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/water/series.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, { exports: seriesExports, URL, require: () => JSON.parse(fs.readFileSync("src/lib/water/stations.json", "utf8")) });
const { HOUR, DAY, waterTime, waterNumber, normalizeWaterRows, hourlyWater, dailyWater, waterChange, parseWaterSeries, waterStations } = seriesExports;
const now = Date.parse("2026-10-24T12:30:00+07:00"), midnight = Date.parse("2026-10-24T00:00:00+07:00");
assert.equal(waterStations.length, 11);
assert.equal(new Set(waterStations.map(station => station.code)).size, 11);
assert.equal(waterTime("2026-10-24 06:00"), midnight + 6 * HOUR);
assert.equal(waterTime("2026-10-24T06:00:00+07:00"), midnight + 6 * HOUR);
for (const value of [null, "", false, -999, -9.99, 999999, "N/A"]) assert.equal(waterNumber(value), null);
assert.equal(waterNumber("0"), 0);
assert.equal(waterNumber(-.2), -.2);
const rows = normalizeWaterRows([
  { t: now - HOUR, h: 1, q: 0 }, { t: now - HOUR, h: 2, q: null },
  { t: now + HOUR, h: 3, q: 2 }, { t: now - 182 * DAY, h: 8, q: 0 },
  { t: "invalid", h: 0, q: 0 },
], now);
assert.equal(rows.length, 1);
assert.equal(rows[0].h, 2);
assert.equal(rows[0].q, null);
const hourly = hourlyWater([
  { t: midnight + 10 * HOUR + 15 * 60000, h: 1, q: 0 },
  { t: midnight + 10 * HOUR + 45 * 60000, h: 2, q: null },
  { t: midnight + 12 * HOUR, h: 0, q: 4 },
], 3, "h", now);
assert.deepEqual(Array.from(hourly, point => point.value), [2, null, 0]);
assert.equal(hourlyWater([], 168, "h", now).length, 168);
assert.equal(hourlyWater([{ t: midnight + 10 * HOUR, h: 3, q: null }], 3, "q", now)[0].value, null, "Q is never inferred from H");

const complete = Array.from({ length: 96 }, (_, i) => ({ t: midnight - DAY + i * HOUR / 4, h: i, q: 0 }));
complete.push({ t: midnight + 6 * HOUR, h: 200, q: null });
assert.deepEqual(Array.from(dailyWater(complete, 2, "h", "at06", now), point => point.value), [24, 200]);
assert.deepEqual(Array.from(dailyWater(complete, 2, "h", "mean", now), point => point.value), [47.5, null]);
assert.equal(dailyWater(complete, 2, "h", "min", now)[0].value, 0);
assert.equal(dailyWater(complete, 2, "h", "max", now)[0].value, 95);
assert.equal(dailyWater(complete.slice(0, 80), 2, "h", "mean", now)[0].value, null, "Incomplete days do not produce summaries");
assert.equal(dailyWater(complete.filter(row => row.t !== midnight - DAY + 6 * HOUR), 2, "h", "at06", now)[0].value, null, "No substitution for missing 06:00 reading");
assert.equal(dailyWater(complete, 180, "h", "at06", now).length, 180);
const changes = [{ t: now - 2 * HOUR, h: 4, q: 1 }, { t: now - HOUR, h: 5, q: 2 }, { t: now, h: 7, q: null }];
assert.equal(waterChange(changes, 1, "h", now), 2);
assert.equal(waterChange(changes, 3, "h", now), null);
assert.equal(waterChange(changes, 1, "h", now + 3 * HOUR), null);
const station = waterStations[0];
const payload = { station, rows: complete, thresholds: { warning: 3, critical: 2 }, sourceURL: "javascript:alert(1)", sourceAvailable: true, servedFromArchive: true, errors: [] };
const parsed = parseWaterSeries(payload, station, 7, now);
assert.equal(parsed.station.code, "TSL11");
assert.equal(Object.keys(parsed.thresholds).length, 0, "Inconsistent warning/critical thresholds are hidden");
assert.equal(parsed.sourceURL, "https://telerid.rid.go.th/");
assert.equal(parsed.servedFromArchive, true);
assert.throws(() => parseWaterSeries({ ...payload, station: { ...station, code: "TX276" } }, station, 7, now));
assert.throws(() => parseWaterSeries({ ...payload, station: { ...station, unit: "ม.รทก." } }, station, 7, now));
console.log("PASS: 11 source stations, Thai dates, missing/sentinel/zero values, hourly selection and gaps, 06:00 daily observations, 90% complete-day summaries, changes, station/datum integrity and safe source URLs");

const chartExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/water/chart-path.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: chartExports });
const { smoothWaterPath } = chartExports;
assert.equal(smoothWaterPath([]), "");
assert.equal(smoothWaterPath([{ x: 0, y: 2 }]), "M0.00,2.00");
const gapped = smoothWaterPath([{ x: 0, y: 2 }, { x: 10, y: 4 }, { x: 20, y: null }, { x: 30, y: 1 }]);
assert.equal((gapped.match(/M/g) ?? []).length, 2, "Missing observations must break the curve");
assert.equal((gapped.match(/C/g) ?? []).length, 1, "Never connect across a gap");
for (const values of [[0, 10, 0, 10], [0, 1, 100, 101], [3, 3, 3, 3], [10, 9, 0, -1]]) {
  const path = smoothWaterPath(values.map((y, i) => ({ x: i * 30, y })));
  const curves = [...path.matchAll(/C([\d., -]+)/g)];
  assert.equal(curves.length, values.length - 1);
  curves.forEach((curve, i) => {
    const [, control1, , control2, , end] = curve[1].trim().split(/[ ,]+/).map(Number);
    assert.equal(end, values[i + 1], "Curve passes through every measured value");
    for (let step = 0; step <= 100; step++) {
      const t = step / 100, u = 1 - t;
      const value = u ** 3 * values[i] + 3 * u ** 2 * t * control1 + 3 * u * t ** 2 * control2 + t ** 3 * end;
      assert.ok(value >= Math.min(values[i], end) - 1e-8 && value <= Math.max(values[i], end) + 1e-8, "Smoothing must not invent higher or lower water readings");
    }
  });
}
console.log("Water curve: observations, gaps and no overshoot passed");
