import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("src/lib/radar-area.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(source, { exports });
const { basinPixelSamples, analyzeRadarPixels, RADAR_ANALYSIS_SIZE: size } = exports;
const world = size * 128;
const unproject = ([x, y]) => [x / world * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / world))) * 180 / Math.PI];
const ring = (x, y, width, height) => [[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]].map(unproject);
const boundary = (coordinates, type = "Polygon") => ({
  type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type, coordinates } }],
});
const count = (tiles) => tiles.flatMap((tile) => tile.samples).length;
assert.equal(count(basinPixelSamples(boundary([ring(50000, 31000, 4, 4)]))), 16);
assert.equal(count(basinPixelSamples(boundary([ring(50000, 31000, 4, 4), ring(50001, 31001, 2, 2)]))), 12);
assert.equal(count(basinPixelSamples(boundary([[ring(50000, 31000, 2, 2)], [ring(50003, 31000, 2, 2)]], "MultiPolygon"))), 8);

// Two equally sized observed areas: rain in one, weak echo in the other.
// Two unobserved areas must not contribute to the denominator, even if colored.
const samples = [0, 4, 8, 12].map((offset) => ({ offset, weight: 1 }));
const radar = new Uint8ClampedArray(size * size * 4);
const coverage = new Uint8ClampedArray(radar.length);
radar[3] = 255;
radar[7] = 190;
radar[11] = 255;
coverage[11] = coverage[15] = 255;
const analyze = () => analyzeRadarPixels([{ samples, radar, coverage }]);
assert.equal(analyze().rainPercent, 50);
assert.equal(analyze().coveragePercent, 50);
coverage.fill(255);
assert.equal(analyze().rainPercent, null);
assert.equal(analyze().coveragePercent, 0);
coverage.fill(0);
radar.fill(0);
assert.equal(analyze().rainPercent, 0);
radar.fill(255);
assert.equal(analyze().rainPercent, 100);
assert.throws(() => analyzeRadarPixels([{ samples, radar: new Uint8ClampedArray(4), coverage }]), /image size/);

// Rain outside the sampled basin must have no effect.
radar.fill(255);
for (const { offset } of samples) radar[offset + 3] = 0;
assert.equal(analyze().rainPercent, 0);
const real = basinPixelSamples(JSON.parse(readFileSync("public/boundaries/pa-phayom-basin.geojson", "utf8")));
assert.ok(count(real) > 0);
console.log("PASS: basin clipping, holes, multipolygons, coverage denominator, weak echoes, zero/full rain, outside rain, invalid images, actual basin");
