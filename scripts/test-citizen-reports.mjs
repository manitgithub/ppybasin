import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";

// Exercise validation and server authorization without connecting to a deployment database.
function loadTs(file, imports = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (id) => { if (!(id in imports)) throw new Error(`Unexpected import ${id}`); return imports[id]; }, Request, Response, FormData, File, Buffer, Uint8Array, URL, Date, console, ...globals }, { filename: file });
  return exports;
}
const localPreview = loadTs("src/lib/local-preview.ts");
const reports = loadTs("src/lib/reports.ts");
const owner = { id: "62b7b51b-0e13-43a6-bc5b-39904757054a", role: "viewer", permissions: ["dashboard:view"] };
const staff = { ...owner, role: "operator", permissions: ["reports:manage"] };
function form(patch = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ submissionKey: "bed4d2a9-d1c9-44a7-b3ef-c1532e5b1f6f", kind: "flood", place: "หมู่บ้านป่าพะยอม", description: "น้ำท่วมถนนหน้าวัด", contactName: "ผู้ทดสอบ", contactPhone: "081 234-5678", passability: "unknown", observedAt: "2026-01-01T00:00:00.000Z", ...patch })) data.set(key, value);
  return data;
}
assert.equal(reports.validateReport(form()).value.contactPhone, "0812345678");
for (const depth of ["ankle", "knee", "waist", "neck", "overhead", "dry", "unknown"]) {
  assert.equal(reports.validateReport(form({ waterDepth: depth })).value.waterDepth, depth);
}
assert.equal(reports.validateReport(form()).value.waterDepth, "unknown");
assert.ok(reports.validateReport(form({ waterDepth: "1.5m" })).error);
assert.ok(reports.validateReport(form({ kind: "unexpected" })).error);
assert.ok(reports.validateReport(form({ kind: "help" })).error);
const help = form({ kind: "help", peopleCount: "3" }); help.append("needs", "อพยพ");
assert.equal(reports.validateReport(help).value.peopleCount, 3);
assert.ok(reports.validateReport(form({ latitude: "7.8" })).error);
assert.ok(reports.validateReport(form({ latitude: "7.8", longitude: "181" })).error);
assert.ok(reports.validateReport(form({ observedAt: "2099-01-01T00:00:00Z" })).error);
assert.ok(reports.validateReport(form({ observedAt: "not-a-date" })).error);
assert.ok(reports.validateReport(form({ contactPhone: "1234567890" })).error);
assert.equal(reports.canManageReports(owner), false);
assert.equal(reports.canManageReports(staff), true);
assert.equal(reports.canCreateReports(owner), true);
let currentUser = null;
let calls = [];
const db = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
const route = loadTs("src/app/api/reports/route.ts", { "@/lib/auth": { getCurrentUser: async () => currentUser }, "@/lib/db": { getPool: () => db }, "@/lib/local-preview": localPreview, "@/lib/reports": reports });
assert.equal((await route.GET()).status, 401);
assert.equal((await route.POST(new Request("https://example.test/api/reports", { method: "POST", body: form() }))).status, 401);
currentUser = owner;
assert.equal((await route.PATCH(new Request("https://example.test/api/reports", { method: "PATCH", body: JSON.stringify({}) }))).status, 403);
assert.equal(calls.length, 0);
assert.equal((await route.GET()).status, 200);
assert.equal(calls[0].params[0], false);
assert.equal(calls[0].params[1], owner.id);
assert.match(calls[0].sql, /r\.reporter_id = \$2::uuid/);
currentUser = staff; calls = [];
assert.equal((await route.GET()).status, 200);
assert.equal(calls[0].params[0], true);
currentUser = owner;
assert.equal((await route.POST(new Request("https://example.test/api/reports", { method: "POST", headers: { origin: "https://other.test" }, body: form() }))).status, 403);
const photo = loadTs("src/app/api/reports/[id]/photo/route.ts", { "@/lib/auth": { getCurrentUser: async () => currentUser }, "@/lib/db": { getPool: () => db }, "@/lib/local-preview": localPreview, "@/lib/reports": reports });
calls = [];
assert.equal((await photo.GET(new Request("https://example.test"), { params: Promise.resolve({ id: owner.id }) })).status, 404);
assert.equal(calls[0].params[1], false);
assert.equal(calls[0].params[2], owner.id);
assert.match(calls[0].sql, /r\.reporter_id = \$3::uuid/);
console.log("PASS: report validation, assistance requirements, owner/staff scopes, guest denial, mutation authorization, origin checks, private photo scopes");

let statements = [];
let transactionMode = "success";
const client = {
  query: async (sql) => {
    statements.push(sql);
    if (sql.includes("submission_key =")) return { rows: transactionMode === "duplicate" ? [{ id: owner.id }] : [] };
    if (sql.includes("count(*)")) return { rows: [{ count: transactionMode === "limited" ? 5 : 0 }] };
    if (sql.includes("insert into public.citizen_reports")) {
      if (transactionMode === "failure") throw new Error("simulated database failure");
      return { rows: [{ id: owner.id }] };
    }
    if (sql.includes("for update")) return { rows: [{ status: "resolved" }] };
    return { rows: [] };
  },
  release: () => statements.push("release"),
};
const transactional = loadTs("src/app/api/reports/route.ts", { "@/lib/auth": { getCurrentUser: async () => currentUser }, "@/lib/db": { getPool: () => ({ connect: async () => client }) }, "@/lib/local-preview": localPreview, "@/lib/reports": reports });
currentUser = owner;
assert.equal((await transactional.POST(new Request("https://example.test/api/reports", { method: "POST", body: form() }))).status, 201);
assert.ok(statements.includes("commit"));
assert.ok(statements.some((sql) => sql.includes("citizen_report_events")));
statements = []; transactionMode = "duplicate";
assert.equal((await transactional.POST(new Request("https://example.test/api/reports", { method: "POST", body: form() }))).status, 200);
assert.ok(!statements.some((sql) => sql.includes("insert into public.citizen_reports")));
statements = []; transactionMode = "limited";
assert.equal((await transactional.POST(new Request("https://example.test/api/reports", { method: "POST", body: form() }))).status, 429);
assert.ok(statements.includes("rollback"));
assert.ok(!statements.includes("commit"));
statements = []; transactionMode = "failure";
const oldError = console.error; console.error = () => {};
try { assert.equal((await transactional.POST(new Request("https://example.test/api/reports", { method: "POST", body: form() }))).status, 503); } finally { console.error = oldError; }
assert.ok(statements.includes("rollback"));
assert.ok(!statements.includes("commit"));
currentUser = staff; statements = [];
assert.equal((await transactional.PATCH(new Request("https://example.test/api/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: owner.id, status: "verified", note: "" }) }))).status, 409);
assert.ok(statements.includes("rollback"));
assert.ok(!statements.some((sql) => sql.startsWith("update ")));
console.log("PASS: transactional save/history, duplicate submission, rate limiting, failed-save rollback, terminal status protection (mock database)");


const jar = new Map();
const cookieStore = { get: (name) => jar.has(name) ? { value: jar.get(name) } : undefined, set: (name, value) => jar.set(name, value), delete: (name) => jar.delete(name) };
const authGlobals = { process: { env: { LINE_CHANNEL_ID: "test-channel", LINE_CHANNEL_SECRET: "test-secret" } }, URLSearchParams };
const nextImports = { "next/headers": { cookies: async () => cookieStore }, "next/server": { NextResponse: { redirect: (url) => Response.redirect(url) } } };
const start = loadTs("src/app/api/auth/line/start/route.ts", { ...nextImports, crypto: { default: crypto } }, authGlobals);
await start.GET(new Request("https://example.test/api/auth/line/start?returnTo=%2F%23report"));
assert.equal(jar.get("ppybasin_line_return"), "/#report");
await start.GET(new Request("https://example.test/api/auth/line/start?returnTo=https://other.test"));
assert.equal(jar.get("ppybasin_line_return"), "/");
let createdSession = false;
const token = `header.${Buffer.from(JSON.stringify({ sub: "line-test-user", nonce: "test-nonce", name: "ผู้ทดสอบ" })).toString("base64url")}.signature`;
const callback = loadTs("src/app/api/auth/line/callback/route.ts", { ...nextImports, "@/lib/auth": { upsertLineUser: async () => ({ id: owner.id, status: "active" }), createSession: async () => { createdSession = true; } } }, { ...authGlobals, fetch: async (url) => url.endsWith("/token") ? Response.json({ id_token: token }) : Response.json({}) });
jar.set("ppybasin_line_state", "test-state.test-nonce"); jar.set("ppybasin_line_return", "/#report");
let redirect = await callback.GET(new Request("https://example.test/api/auth/line/callback?code=test&state=test-state"));
assert.equal(redirect.headers.get("location"), "https://example.test/#report");
assert.equal(createdSession, true);
assert.equal(jar.has("ppybasin_line_return"), false);
jar.set("ppybasin_line_state", "test-state.test-nonce"); jar.set("ppybasin_line_return", "https://other.test");
redirect = await callback.GET(new Request("https://example.test/api/auth/line/callback?code=test&state=test-state"));
assert.equal(redirect.headers.get("location"), "https://example.test/");
console.log("PASS: LINE return-to-report, return cookie cleanup, redirect allowlist (mock LINE responses)");

currentUser = owner;
transactionMode = "success"; statements = [];
const multiplePhotos = form();
multiplePhotos.append("photos", new File([new Uint8Array([255, 216, 255, 1])], "first.jpg", { type: "image/jpeg" }));
multiplePhotos.append("photos", new File([new Uint8Array([255, 216, 255, 2])], "second.jpg", { type: "image/jpeg" }));
assert.equal((await transactional.POST(new Request("https://example.test/api/reports", { method: "POST", body: multiplePhotos }))).status, 201);
assert.equal(statements.filter((sql) => sql.startsWith("insert into public.citizen_report_photos")).length, 2);
assert.ok(statements.includes("commit"));
const tooMany = form();
for (let i = 0; i < 9; i++) tooMany.append("photos", new File([new Uint8Array([255, 216, 255])], `${i}.jpg`, { type: "image/jpeg" }));
assert.equal((await transactional.POST(new Request("https://example.test/api/reports", { method: "POST", body: tooMany }))).status, 422);
const invalidImage = form(); invalidImage.append("photos", new File(["<svg>test</svg>"], "fake.jpg", { type: "image/jpeg" }));
assert.equal((await transactional.POST(new Request("https://example.test/api/reports", { method: "POST", body: invalidImage }))).status, 422);
const oversizedImage = form(); oversizedImage.append("photos", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" }));
assert.equal((await transactional.POST(new Request("https://example.test/api/reports", { method: "POST", body: oversizedImage }))).status, 413);
assert.equal((await photo.GET(new Request("https://example.test/photo?photoId=not-a-uuid"), { params: Promise.resolve({ id: owner.id }) })).status, 404);
console.log("PASS: multiple-photo transaction, attachment count/size limits, image signatures, invalid photo IDs");

statements = [];
const failingPhotoClient = { release: client.release, query: async (sql, params) => {
  if (sql.startsWith("insert into public.citizen_report_photos") && params[4] === 1) throw new Error("simulated second-photo failure");
  return client.query(sql, params);
} };
const failingPhotosRoute = loadTs("src/app/api/reports/route.ts", { "@/lib/auth": { getCurrentUser: async () => owner }, "@/lib/db": { getPool: () => ({ connect: async () => failingPhotoClient }) }, "@/lib/local-preview": localPreview, "@/lib/reports": reports });
console.error = () => {};
try { assert.equal((await failingPhotosRoute.POST(new Request("https://example.test/api/reports", { method: "POST", body: multiplePhotos }))).status, 503); } finally { console.error = oldError; }
assert.ok(statements.includes("rollback"));
assert.ok(!statements.includes("commit"));
console.log("PASS: rollback when a later photo fails to save");


for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"]) assert.equal(localPreview.allowsLocalPreview("development", host, null), true);
for (const host of ["example.com", "localhost.example.com", "localhost@evil.test", "localhost/path"]) assert.equal(localPreview.allowsLocalPreview("development", host, null), false);
assert.equal(localPreview.allowsLocalPreview("production", "localhost:3000", null), false);
assert.equal(localPreview.allowsLocalPreview("development", "example.com", "localhost:3000"), false);
assert.equal(localPreview.allowsLocalPreview("development", "localhost:3000", "example.com"), false);
console.log("PASS: local development access, IPv4/IPv6 loopback, production/domain/forwarded-host exclusion");
