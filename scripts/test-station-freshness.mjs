import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const api = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/public-situation.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: api, require: () => ({ emptyRainStations: () => [] }) });
const { isCurrentStationObservation: current } = api;
const now = Date.parse("2026-10-30T12:00:00+07:00");
assert.equal(current("2026-10-30T10:00:00+07:00", now), true);
assert.equal(current("2026-10-30T09:59:59.999+07:00", now), false);
assert.equal(current("2026-10-30 10:00:00", now), true, "Local sensor times use Bangkok time");
assert.equal(current("2026-10-30T03:00:00Z", now), true);
assert.equal(current("2026-10-30T12:00:01+07:00", now), false);
for (const value of [null, undefined, "", "invalid", "2026-10-30"]) assert.equal(current(value, now), false);
assert.equal(current("2026-10-30T10:00:00+07:00", now + 1), false, "Station becomes stale as clock advances");
console.log("PASS: two-hour boundary, aging without new data, Bangkok/UTC timestamps, missing/invalid/future/date-only observations");
