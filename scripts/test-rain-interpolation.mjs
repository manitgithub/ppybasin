import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const mathExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/rain-interpolation.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: mathExports });
const { selectRainPoints, projectRain, createRainModel, buildRainGrid } = mathExports;
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
const point = (x, y, value) => ({ id: `${x},${y}`, xy: [x, y], value, time: 0 });
const points = [point(0, 0, 0), point(10, 0, 10), point(0, 10, 20), point(10, 10, 30)];

// Analytical IDW checks: equal distances give arithmetic mean; unequal distances
// give weights 1/d² (not 1/d). Observations, including zero, reproduce exactly.
const idw = createRainModel(points, "idw");
near(idw([5, 5]), 15);
for (const p of points) near(idw(p.xy), p.value);
near(createRainModel([point(0, 0, 0), point(3, 0, 10), point(0, 4, 20)], "idw")([0, 1]), (10 / 10 + 20 / 9) / (1 + 1 / 10 + 1 / 9));

// A TPS with zero smoothing must interpolate observations. At the center of
// this symmetric square, the affine constraints give equal log-rain weights.
const tps = createRainModel(points, "tps", 0);
for (const p of points) near(tps(p.xy), p.value);
near(tps([5, 5]), Math.pow(1 * 11 * 21 * 31, .25) - 1);
assert.ok(Math.abs(tps([5, 5]) - idw([5, 5])) > 1);

// Affine reproduction in log space is independent of the kernel/smoothing.
const plane = [[0, 0], [8, 0], [0, 8], [8, 8]].map(([x, y]) => point(x, y, Math.expm1(.1 * x + .2 * y)));
near(createRainModel(plane, "tps")([3, 2]), Math.expm1(.7));
for (const method of ["tps", "idw"]) {
  near(createRainModel(points.map(p => ({ ...p, value: 0 })), method)([5, 5]), 0);
  assert.throws(() => createRainModel(points.slice(0, 2), method));
  assert.throws(() => createRainModel([point(0, 0, 1), point(1, 1, 2), point(2, 2, 3)], method));
}

const now = Date.parse("2026-10-24T21:30:00+07:00");
const sample = (id, lng, time = "2026-10-24 21:00", rainfallMm = 1) => ({ id, lat: 7.8, lng, observedAt: time, rainfallMm, accumulationHours: 24 });
const stations = [sample("zero", 99.8, undefined, 0), sample("valid", 99.9),
  sample("missing", 99.91, undefined, null), sample("stale", 99.92, "2026-10-24 19:00"),
  sample("future", 99.93, "2026-10-24 22:00"), { ...sample("12h", 99.94), accumulationHours: 12 },
  sample("bad-time", 99.95, "N/A"), sample("negative", 99.96, undefined, -1),
  sample("duplicate-location", 99.8), { ...sample("bad-location", 99.99), lat: null }];
const selection = selectRainPoints(stations, now);
assert.equal(selection.total, 10);
assert.deepEqual(Array.from(selection.points, p => p.id), ["zero", "valid"]);
assert.equal(selection.points[0].value, 0);
assert.deepEqual(Array.from(selectRainPoints([
  sample("old", 99.8, "2026-10-24 19:30"), sample("new", 99.9, "2026-10-24 21:00"),
], now).points, p => p.id), ["new"], "Newest time cohort wins ties");
assert.equal(selectRainPoints([sample("same", 99.9, "2026-10-24 20:30", 2), sample("same", 99.9, undefined, 4)], now).points[0].value, 4);
assert.equal(selectRainPoints([], now).from, null);

const square = (west, south, size) => [[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]];
const outer = square(99.85, 7.75, .1), hole = square(99.89, 7.79, .02);
const boundary = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [outer, hole] } }] };
const observed = outer.slice(0, 4).map(([lng, lat], i) => ({ id: String(i), xy: projectRain(lng, lat), value: 0, time: now }));
for (const method of ["tps", "idw"]) {
  const grid = buildRainGrid(boundary, observed, method, 80);
  const middle = Math.floor(grid.height / 2) * grid.width + Math.floor(grid.width / 2);
  assert.equal(grid.mask[middle], 0, "Polygon hole remains transparent");
  assert.equal(grid.mask[grid.width + 1], 1);
  near(grid.cells[grid.width + 1], 0);
  near(grid.coverage, 1);
  // A separate distant polygon has a mask but no supported estimates.
  const both = { type: "FeatureCollection", features: [...boundary.features, { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: [[square(100.4, 7.75, .1)]] } }] };
  const combined = buildRainGrid(both, observed, method, 120);
  assert.ok(combined.coverage > .3 && combined.coverage < .7);
  assert.ok(Array.from(combined.cells).some((v, i) => combined.mask[i] && Number.isNaN(v)));
  assert.ok(Array.from(combined.cells).every((v, i) => combined.mask[i] || Number.isNaN(v)), "No values outside selected basins");
}
console.log("PASS: analytical IDW and TPS results, affine reproduction, zero rain, degenerate inputs, time cohorts, duplicates, basin clipping/holes, missing-area masks and coverage");
