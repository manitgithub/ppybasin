import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const catalogExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/station-catalog.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: catalogExports,
  require: () => ({ rainStationRegistry: JSON.parse(readFileSync("src/lib/situation/rain-stations.json", "utf8")) }),
});
const { catalogStations, filterCatalog, stationMetric } = catalogExports;
const empty = catalogStations(null);
assert.equal(empty.length, 27);
assert.equal(new Set(empty.map(s => s.code)).size, 27);
assert.equal(filterCatalog(empty, "rain").length, 24);
assert.deepEqual(Array.from(filterCatalog(empty, "flow"), s => s.code), ["X.276", "TSL12", "X.124"]);
assert.deepEqual(Array.from(filterCatalog(empty, "reservoir"), s => s.code), ["RES-PYP"]);
assert.equal(filterCatalog(empty, "rain", "RES-PYP").length, 1);
assert.equal(filterCatalog(empty, "rain", "TSL12").length, 1);
assert.equal(filterCatalog(empty, "all", "ไม่มีสถานีนี้").length, 0);
assert.equal(filterCatalog(empty, "rain", "  stn0080  ")[0].code, "STN0080");
assert.ok(filterCatalog(empty, "all", "บ้านเขาปู่").length >= 2);
assert.ok(empty.every(s => stationMetric(s, "all").value === null));

const sample = {
  rainStations: [{ code: "TSL12", rainfallMm: 0, observedAt: "2026-10-24 21:00" }],
  thaiWater: { waterLevels: [
    { id: "1095876", code: "X.276", lat: 7.70724, lng: 99.841743, dischargeM3s: 2, waterLevelMsl: 50.6, observedAt: "2026-10-24 21:00" },
    { id: "11688791", code: "TSL12", lat: 7.72914, lng: 99.914, dischargeM3s: null, waterLevelMsl: 33.88, observedAt: "2026-10-24 21:00" },
  ] },
  reservoir: { status: "ok", capacityPercent: 39.2, latestDataDate: "2026-10-24" },
};
let rows = catalogStations(sample);
assert.equal(stationMetric(rows.find(s => s.code === "X.276"), "flow").value, 2);
assert.equal(stationMetric(rows.find(s => s.code === "TSL12"), "rain").value, 0);
assert.equal(stationMetric(rows.find(s => s.code === "TSL12"), "flow").value, null, "Never use level or rain as discharge");
assert.equal(stationMetric(rows.find(s => s.code === "RES-PYP"), "reservoir").value, 39.2);
assert.equal(rows.find(s => s.code === "TX276").waterReading, null, "Nearby distinct station retains its own identity");
sample.thaiWater.waterLevels[0].lat = 9;
sample.reservoir.status = "unavailable";
rows = catalogStations(sample);
assert.equal(rows.find(s => s.code === "X.276").waterReading, null, "Reject mismatched coordinates");
assert.equal(stationMetric(rows.find(s => s.code === "RES-PYP"), "reservoir").value, null);
console.log("PASS: 27 reference stations, four categories and overlapping capabilities, search, code/coordinate matching, discharge/level separation, zero and missing values");
