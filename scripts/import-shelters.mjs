import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import { normalizeShelterRows, paPhayomVenues, parseCsv } from "./lib/shelter-import.mjs";

const args = process.argv.slice(2);
const scopeIndex = args.indexOf("--scope");
const scope = scopeIndex < 0 ? "all" : args[scopeIndex + 1];
if (scopeIndex >= 0) args.splice(scopeIndex, 2);
const dryRun = args.includes("--dry-run");
const input = args.filter((arg) => arg !== "--dry-run");
if (input.length > 1 || input.some((arg) => arg.startsWith("--"))) throw new Error("Usage: node scripts/import-shelters.mjs [file.csv] [--scope all|phatthalung|pa-phayom] [--dry-run]");
const filename = resolve(input[0] ?? "docs/ศูนย์พักพิง-090569.csv");
const sourceFile = basename(filename);
const sourceKey = `csv:${sourceFile}`;
const bytes = await readFile(filename);
const rows = normalizeShelterRows(parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), {
  sourceKey, sourceFile, fileHash: createHash("sha256").update(bytes).digest("hex"), scope,
});
const venues = paPhayomVenues(rows);
for (const venue of venues) if (venue.rows.length > 1) {
  for (const row of venue.rows) row.issues.push("duplicate_venue");
}
const summary = {
  sourceFile, scope, sourceRows: rows.length,
  phatthalungRows: rows.filter((row) => row.province === "พัทลุง").length,
  paPhayomRows: rows.filter((row) => row.province === "พัทลุง" && row.district === "ป่าพะยอม").length,
  mapVenues: venues.length,
  duplicateVenueRows: venues.reduce((total, venue) => total + venue.rows.length - 1, 0),
  coordinates: Object.fromEntries(["valid", "missing", "invalid", "suspicious"].map((status) => [status, rows.filter((row) => row.coordinate_status === status).length])),
  capacityUnknown: rows.filter((row) => row.capacity === null).length,
  recordsNeedingReview: rows.filter((row) => row.issues.length).length,
};
console.log(JSON.stringify(summary, null, 2));
if (dryRun) process.exit(0);

for (const envFile of [".env.local", ".env"]) {
  let text;
  try { text = await readFile(envFile, "utf8"); } catch { continue; }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
await client.connect();
try {
  await client.query(await readFile("db/migrations/014_shelter_source_registry.sql", "utf8"));
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(hashtext('shelter-csv-import'))");
  const fields = {
    source_key: "text", source_id: "text", source_file: "text", region: "text", province: "text", district: "text",
    subdistrict: "text", community: "text", name: "text", capacity: "integer", responsible_organization: "text",
    coordinator_name: "text", coordinator_phone: "text", electricity: "text", water_supply: "text", toilet_count: "integer",
    latitude: "double precision", longitude: "double precision", coordinate_status: "text", issues: "text[]",
    raw_record: "jsonb", file_sha256: "text",
  };
  const columns = Object.keys(fields).join(", ");
  const definitions = Object.entries(fields).map(([key, type]) => `${key} ${type}`).join(", ");
  const updates = Object.keys(fields).filter((key) => !["source_key", "source_id"].includes(key)).map((key) => `${key} = excluded.${key}`).join(", ");
  for (let index = 0; index < rows.length; index += 500) {
    await client.query(`insert into public.shelter_registry (${columns})
      select ${columns} from jsonb_to_recordset($1::jsonb) as source(${definitions})
      on conflict (source_key, source_id) do update set ${updates}, imported_at = now()`, [JSON.stringify(rows.slice(index, index + 500))]);
  }
  const maxCode = await client.query("select coalesce(max(right(code, 3)::int), 0)::int as number from public.shelters where code ~ '^PPY-SH-[0-9]{3}$'");
  let nextCode = maxCode.rows[0].number;
  for (const venue of venues) {
    const row = venue.row;
    const existing = await client.query("select id,code from public.shelters where registry_source_key=$1 and registry_source_id=$2", [sourceKey, row.source_id]);
    let code = existing.rows[0]?.code;
    if (!code) {
      nextCode += 1;
      if (nextCode > 999) throw new Error("PPY-SH codes exhausted");
      code = `PPY-SH-${String(nextCode).padStart(3, "0")}`;
    }
    const result = await client.query(`insert into public.shelters
      (code,name,capacity,status,geom,registry_source_key,registry_source_id,source_file)
      values ($1,$2,$3,'standby',ST_SetSRID(ST_MakePoint($4,$5),4326),$6,$7,$8)
      on conflict (registry_source_key,registry_source_id) do update set
        name=excluded.name,capacity=excluded.capacity,geom=excluded.geom,source_file=excluded.source_file
      returning id::text`, [code, row.name, row.capacity, row.longitude, row.latitude, sourceKey, row.source_id, sourceFile]);
    // A repeated import updates source data without changing operational status or its confirmation time.
    await client.query("update public.shelter_registry set shelter_id=$1 where source_key=$2 and source_id=any($3::text[])", [result.rows[0].id, sourceKey, venue.rows.map((item) => item.source_id)]);
  }
  const count = await client.query("select count(*)::int as total from public.shelter_registry where source_key=$1 and source_id=any($2::text[])", [sourceKey, rows.map((row) => row.source_id)]);
  if (count.rows[0].total !== rows.length) throw new Error("Imported row count differs from CSV");
  await client.query("commit");
  console.log(`Committed ${rows.length} source records and ${venues.length} Pa Phayom map venues. New venues have standby status.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
