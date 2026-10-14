import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeShelterRows, paPhayomVenues, parseCsv } from "./lib/shelter-import.mjs";

assert.deepEqual(parseCsv('\uFEFFid,name,note\r\n1,"วัด, โรงเรียน","บรรทัดแรก\nบรรทัดสอง ""ข้อความ"""\r\n'), [
  { id: "1", name: "วัด, โรงเรียน", note: 'บรรทัดแรก\nบรรทัดสอง "ข้อความ"' },
]);
assert.throws(() => parseCsv('id,name\n1,"unfinished'), /unterminated/);
assert.throws(() => parseCsv("id,name\n1,two,extra"), /columns/);
const base = { _id: "1", จังหวัด: "พัทลุง", อำเภอ: "ป่าพะยอม", ตำบล: "ป่าพะยอม", สถานที่: "วัดทดสอบ", รองรับ: "1,000", ละติจูด: "7.8", ลองจิจูด: "99.9", "หมู่บ้าน/ชุมชน": "2" };
const options = { sourceKey: "test", sourceFile: "test.csv", fileHash: "test" };
const clean = normalizeShelterRows([base], options)[0];
assert.equal(clean.capacity, 1000);
assert.equal(clean.coordinate_status, "valid");
assert.deepEqual(clean.raw_record, base);
const invalid = normalizeShelterRows([{ ...base, รองรับ: "200-300", ละติจูด: "101.1" }], options)[0];
assert.equal(invalid.capacity, null);
assert.equal(invalid.coordinate_status, "invalid");
assert.equal(invalid.raw_record.รองรับ, "200-300");
assert.equal(paPhayomVenues([invalid]).length, 0);
const missing = normalizeShelterRows([{ ...base, ละติจูด: "" }], options)[0];
assert.equal(missing.latitude, null);
assert.equal(missing.coordinate_status, "missing");
const duplicate = normalizeShelterRows([base, { ...base, _id: "2", "หมู่บ้าน/ชุมชน": "3" }], options);
assert.equal(paPhayomVenues(duplicate).length, 1);
assert.equal(paPhayomVenues(duplicate)[0].rows.length, 2);
assert.throws(() => normalizeShelterRows([base, base], options), /duplicate source ID/);
assert.throws(() => normalizeShelterRows([base], { ...options, scope: "typo" }), /Unknown import scope/);
assert.equal(normalizeShelterRows([{ ...base, จังหวัด: "สงขลา" }], { ...options, scope: "phatthalung" }).length, 0);
const actual = normalizeShelterRows(parseCsv(await readFile("docs/ศูนย์พักพิง-090569.csv", "utf8")), options);
assert.equal(actual.length, 10764);
assert.equal(actual.filter((row) => row.province === "พัทลุง").length, 216);
assert.equal(paPhayomVenues(actual).length, 15);
console.log("PASS: CSV quoting/BOM/newlines, invalid and missing fields, preserved source values, duplicate venues, scope validation, full source row count");
