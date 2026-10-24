import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const modules = new Map();
let requestMode = "ok";
const requestedUrls = [];
function row(code, lat, lng, value, at = "2026-10-24 20:00") {
  return { rain_24h: value, rainfall_datetime: at, station: {
    id: 999, tele_station_oldcode: code, tele_station_lat: lat, tele_station_long: lng,
  } };
}
const samples = {
  "93": row("STN0080", 7.757113, 99.806515, 0),
  "80": row("FOP037", 7.876800, 99.933280, 12.5),
  "92": row("STN1608", 7.840834, 99.676926, 5),
};
function load(file) {
  if (modules.has(file)) return modules.get(file);
  if (file.endsWith(".json")) return JSON.parse(readFileSync(file, "utf8"));
  const exports = {};
  modules.set(file, exports);
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, {
    exports, AbortSignal,
    require: relative => load(path.resolve(path.dirname(file), relative + (relative.endsWith(".json") ? "" : ".ts"))),
    fetch: async url => {
      requestedUrls.push(url);
      const province = new URL(url).searchParams.get("province_code");
      if (requestMode === "offline" || (requestMode === "partial" && province === "80")) throw Error("offline");
      if (requestMode === "schema") return Response.json({ unexpected: [] });
      return Response.json({ result: "OK", data: [samples[province]] });
    },
  });
  return exports;
}
const { parseRegistryRain, mergeRegistryRain, getRegistryRain } = load(path.resolve("src/lib/situation/rain-registry.ts"));
const { emptyRainStations } = load(path.resolve("src/lib/rain-stations.ts"));
const expectedCodes = ["RES-PYP", "STN0080", "MOU133", "STN1619", "STN0579", "MOU132", "TSL11", "FOP038", "STN0578", "SWR031", "TX276", "TSL12", "EK05", "TX83", "TPN11", "FOP037", "MOU131", "FOP036", "STN1716", "STN1797", "STN1617", "STN1608", "STN0114", "48560"];
assert.deepEqual(Array.from(emptyRainStations(), s => s.code), expectedCodes);
assert.equal(new Set(expectedCodes).size, 24);
const parse = rows => parseRegistryRain({ result: "OK", data: rows }, "https://www.thaiwater.net/");
const first = samples["93"];
assert.equal(parse([first])[0].rainfallMm, 0);
assert.equal(parse([{ ...first, id: 12345 }])[0].code, "STN0080");
for (const value of [null, "", false, -1, 1001, "N/A"]) assert.equal(parse([{ ...first, rain_24h: value }]).length, 0);
assert.equal(parse([{ ...first, rain_24h: undefined, rain12h: 8 }]).length, 0);
assert.equal(parse([{ ...first, rainfall_datetime: "N/A" }]).length, 0);
assert.equal(parse([{ ...first, station: { ...first.station, tele_station_oldcode: "unregistered", tele_station_name: { th: "บ้านทุ่งยูง" } } }]).length, 0);
for (const coords of [{ tele_station_lat: null }, { tele_station_long: "" }, { tele_station_lat: 9 }]) {
  assert.equal(parse([{ ...first, station: { ...first.station, ...coords } }]).length, 0);
}
const newer = { ...first, rain_24h: 7, rainfall_datetime: "2026-10-24 21:00" };
assert.equal(parse([newer, first])[0].rainfallMm, 7);
const merged = mergeRegistryRain([...parse([first]), ...parse([newer])]);
assert.equal(merged.length, 24);
assert.equal(merged.find(s => s.code === "STN0080").rainfallMm, 7);
assert.equal(merged.find(s => s.code === "TSL11").rainfallMm, null);
assert.throws(() => parseRegistryRain({ data: [] }, ""));

const loaded = await getRegistryRain();
assert.equal(loaded.stations.length, 24);
assert.equal(loaded.stations.filter(s => s.rainfallMm !== null).length, 3);
assert.deepEqual(requestedUrls.map(url => new URL(url).searchParams.get("province_code")).sort(), ["80", "92", "93"]);
assert.ok(loaded.sources.every(s => s.status === "ok"));
requestMode = "partial";
const partial = await getRegistryRain();
assert.equal(partial.stations.length, 24);
assert.equal(partial.stations.filter(s => s.rainfallMm !== null).length, 2);
assert.equal(partial.stations.find(s => s.code === "FOP037").rainfallMm, null);
for (const [mode, expectedStatus] of [["offline", "unavailable"], ["schema", "schema_changed"]]) {
  requestMode = mode;
  const failed = await getRegistryRain();
  assert.equal(failed.stations.length, 24);
  assert.ok(failed.stations.every(s => s.rainfallMm === null));
  assert.ok(failed.sources.every(s => s.status === expectedStatus));
}
console.log("PASS: reference registry/order, three provinces, stable codes, coordinates, zero/missing values, periods, newest observations, partial and complete source failures");
