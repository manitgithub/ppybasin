import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const fixture = JSON.parse(readFileSync('scripts/fixtures/dwr-near-pa-phayom.json', 'utf8'));
const module = {};
let response = () => new Response(JSON.stringify(fixture));
let request;
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/situation/dwr.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: module, FormData, AbortSignal, fetch: async (url, options) => { request = { url, options }; return response(); },
});
const { parseDwrStations, dwrObservationTime, getDwrSituation } = module;
const stations = parseDwrStations(fixture);
assert.equal(stations.length, 6);
assert.deepEqual(Array.from(stations, s => s.id).sort(), ['DWR-STN0080', 'DWR-STN0578', 'DWR-STN0579', 'DWR-STN1619', 'DWR-STN1716', 'DWR-STN1929']);
assert.equal(stations.find(s => s.id === 'DWR-STN0579').rainfallMm, 1); // rain12h, not the zero 15-minute reading
assert.ok(stations.every(s => s.accumulationHours === 12 && s.sourceUrl.includes('ews.dwr.go.th')));
assert.equal(dwrObservationTime('20/10/69 05:45 น.'), '2026-10-20T05:45:00+07:00');
assert.equal(dwrObservationTime('20/10/2569 05:45 น.'), '2026-10-20T05:45:00+07:00');
for (const date of ['31/02/69 05:45 น.', '20/13/69 05:45 น.', '20/10/69 24:45 น.', 'N/A']) assert.equal(dwrObservationTime(date), '');
const base = fixture.find(s => s.stn === 'STN0579');
for (const invalid of [{latitude: '19'}, {longitude: ''}, {rain12h: 'N/A'}, {rain12h: null}, {rain12h: -1}, {date: 'N/A'}, {stn_type: 'WL'}, {stn_type: 2}]) assert.equal(parseDwrStations([{...base, ...invalid}]).length, 0);
assert.equal(parseDwrStations([{...base, rain12h: '0.0'}])[0].rainfallMm, 0);
assert.equal(parseDwrStations([base, base]).length, 1);
assert.throws(() => parseDwrStations({data: fixture}));
assert.equal((await getDwrSituation()).source.status, 'ok');
assert.equal(request.options.method, 'POST');
assert.equal(request.options.body.get('action'), 'LoadStation');
response = () => new Response('{}');
assert.equal((await getDwrSituation()).source.status, 'schema_changed');
response = () => new Response('[]');
assert.equal((await getDwrSituation()).source.status, 'no_confirmed_data');
response = () => { throw new Error('offline'); };
const failed = await getDwrSituation();
assert.equal(failed.source.status, 'unavailable');
assert.equal(failed.rain12h.length, 0);
console.log('PASS: six nearby EWS rain stations, radius/type filters, 12-hour values, Thai dates, missing data, zero rain, duplicates, upstream schema and failure states');
