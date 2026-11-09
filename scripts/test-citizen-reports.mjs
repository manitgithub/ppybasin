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
const sameOrigin = loadTs("src/lib/same-origin.ts");
const reports = loadTs("src/lib/reports.ts");
// Same-origin check behind a reverse proxy: the app sees its internal URL, the browser sends the public origin.
const proxied = (origin, headers = {}) => new Request("http://0.0.0.0:3010/api/reports", { method: "POST", headers: { origin, ...headers } });
assert.equal(sameOrigin.isSameOriginRequest(proxied("https://basinuat.horusai.pro", { host: "basinuat.horusai.pro" })), true);
assert.equal(sameOrigin.isSameOriginRequest(proxied("https://basinuat.horusai.pro", { host: "ppybasin-app:3010", "x-forwarded-host": "basinuat.horusai.pro" })), true);
assert.equal(sameOrigin.isSameOriginRequest(proxied("https://evil.example", { host: "basinuat.horusai.pro" })), false);
assert.equal(sameOrigin.isSameOriginRequest(proxied("https://basinuat.horusai.pro.evil.example", { host: "basinuat.horusai.pro" })), false);
assert.equal(sameOrigin.isSameOriginRequest(proxied("null", { host: "basinuat.horusai.pro" })), false);
assert.equal(sameOrigin.isSameOriginRequest(new Request("https://basinuat.horusai.pro/api/reports", { method: "POST" })), true);
assert.equal(sameOrigin.isSameOriginRequest(new Request("http://localhost:3000/api/reports", { method: "POST", headers: { origin: "http://localhost:3000" } })), true);
console.log("PASS: same-origin check accepts the public host behind a reverse proxy and rejects other sites");
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
const route = loadTs("src/app/api/reports/route.ts", { "@/lib/auth": { getCurrentUser: async () => currentUser }, "@/lib/db": { getPool: () => db }, "@/lib/local-preview": localPreview, "@/lib/reports": reports, "@/lib/same-origin": sameOrigin });
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
const photo = loadTs("src/app/api/reports/[id]/photo/route.ts", { "@/lib/auth": { getCurrentUser: async () => currentUser }, "@/lib/db": { getPool: () => db }, "@/lib/local-preview": localPreview, "@/lib/reports": reports, "@/lib/same-origin": sameOrigin });
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
const transactional = loadTs("src/app/api/reports/route.ts", { "@/lib/auth": { getCurrentUser: async () => currentUser }, "@/lib/db": { getPool: () => ({ connect: async () => client }) }, "@/lib/local-preview": localPreview, "@/lib/reports": reports, "@/lib/same-origin": sameOrigin });
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

let destroyedSessions = 0;
const logout = loadTs("src/app/api/auth/logout/route.ts", {
  "@/lib/auth": { destroySession: async () => { destroyedSessions += 1; jar.delete("ppybasin_session"); } },
}, { process: { env: { LINE_CALLBACK_URL: "https://old-tunnel.ngrok-free.dev/api/auth/line/callback" } } });
for (const origin of ["http://localhost:3000", "https://basin.example.test"]) {
  for (const method of ["GET", "POST"]) {
    jar.set("ppybasin_session", "test-session");
    const response = await logout[method](new Request(`${origin}/api/auth/logout`, { method }));
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get("location"), origin).href, `${origin}/`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(jar.has("ppybasin_session"), false);
  }
}
assert.equal(destroyedSessions, 4);
console.log("PASS: GET/POST logout clears the session and stays on the current domain despite a stale LINE callback URL");

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
const failingPhotosRoute = loadTs("src/app/api/reports/route.ts", { "@/lib/auth": { getCurrentUser: async () => owner }, "@/lib/db": { getPool: () => ({ connect: async () => failingPhotoClient }) }, "@/lib/local-preview": localPreview, "@/lib/reports": reports, "@/lib/same-origin": sameOrigin });
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

const viewAs = loadTs("src/lib/view-as.ts");
const previewEnv = { NODE_ENV: "development", AUTH_BYPASS: "true" };
let previewHeaders = new Headers({ host: "localhost:3000" });
const previewAuth = loadTs("src/lib/auth.ts", {
  crypto: { default: crypto },
  "next/headers": { cookies: async () => cookieStore, headers: async () => previewHeaders },
  "@/lib/db": { getPool: () => undefined },
  "@/lib/local-preview": localPreview,
  "@/lib/view-as": viewAs,
}, { process: { env: previewEnv } });
jar.set(localPreview.LOCAL_PREVIEW_COOKIE, "guest");
assert.equal(await previewAuth.getCurrentUser(), null);
jar.set(localPreview.LOCAL_PREVIEW_COOKIE, "logged-in");
assert.equal((await previewAuth.getCurrentUser()).id, localPreview.LOCAL_PREVIEW_USER_ID);
assert.equal((await previewAuth.getCurrentUser()).role, "admin");
previewHeaders = new Headers({ host: "localhost:3000", "x-forwarded-host": "basin.example.test" });
assert.equal((await previewAuth.getCurrentUser()).id, "auth-bypass-user");
previewEnv.NODE_ENV = "production";
previewHeaders = new Headers({ host: "localhost:3000" });
assert.equal((await previewAuth.getCurrentUser()).id, "auth-bypass-user");
previewEnv.AUTH_BYPASS = "false";
assert.equal(await previewAuth.getCurrentUser(), null);
previewEnv.NODE_ENV = "development";
const previewRoute = loadTs("src/app/api/dev/preview/route.ts", {
  "next/headers": { cookies: async () => cookieStore },
  "@/lib/local-preview": localPreview,
}, { process: { env: previewEnv } });
const previewRequest = (mode, headers = {}, origin = "http://localhost:3000") => new Request(`${origin}/api/dev/preview`, {
  method: "POST", headers, body: new URLSearchParams({ mode }),
});
for (const mode of ["guest", "logged-in"]) {
  const response = await previewRoute.POST(previewRequest(mode, { origin: "http://localhost:3000" }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/#home");
  assert.equal(jar.get(localPreview.LOCAL_PREVIEW_COOKIE), mode);
}
assert.equal((await previewRoute.POST(previewRequest("other"))).status, 400);
assert.equal((await previewRoute.POST(previewRequest("logged-in", { origin: "https://outside.example.test" }))).status, 403);
assert.equal((await previewRoute.POST(previewRequest("logged-in", { "x-forwarded-host": "basin.example.test" }))).status, 404);
assert.equal((await previewRoute.POST(previewRequest("logged-in", {}, "https://basin.example.test"))).status, 404);
previewEnv.NODE_ENV = "production";
assert.equal((await previewRoute.POST(previewRequest("logged-in"))).status, 404);
console.log("PASS: local guest/admin preview, override of development bypass, production/domain/proxy isolation, preview route origin and mode checks");

// "View as" role preview: may only lower access, never raise it, and is applied on the server.
const adminUser = { id: "a", role: "admin", permissions: [] };
const operatorUser = { id: "o", role: "operator", permissions: ["dashboard:view", "reports:manage", "users:manage"] };
const volunteerUser = { id: "v", role: "volunteer", permissions: ["dashboard:view", "reports:create"] };
const viewerUser = { id: "c", role: "viewer", permissions: ["dashboard:view", "reports:create"] };
assert.deepEqual([...viewAs.availableViewRoles("admin")], ["admin", "operator", "volunteer", "viewer"]);
assert.deepEqual([...viewAs.availableViewRoles("operator")], ["operator", "viewer"]);
assert.deepEqual([...viewAs.availableViewRoles("viewer")], ["viewer"]);
assert.equal(viewAs.applyViewAs(adminUser, undefined).role, "admin");
assert.equal(viewAs.applyViewAs(adminUser, undefined).actualRole, "admin");
assert.equal(viewAs.applyViewAs(adminUser, "bogus").role, "admin");
const adminAsVolunteer = viewAs.applyViewAs(adminUser, "volunteer");
assert.equal(adminAsVolunteer.role, "volunteer");
assert.equal(adminAsVolunteer.actualRole, "admin");
assert.ok(adminAsVolunteer.permissions.includes("reports:claim") && !adminAsVolunteer.permissions.includes("users:manage"));
assert.equal(reports.canManageReports(adminAsVolunteer), false);
assert.equal(reports.canClaimReports(adminAsVolunteer), true);
const adminAsViewer = viewAs.applyViewAs(adminUser, "viewer");
assert.equal(reports.canManageReports(adminAsViewer) || reports.canClaimReports(adminAsViewer) || reports.canManageRoads(adminAsViewer), false);
assert.equal(viewAs.applyViewAs(operatorUser, "admin").role, "operator", "operators cannot escalate to admin");
assert.equal(viewAs.applyViewAs(operatorUser, "volunteer").role, "operator", "operators cannot gain volunteer-only access");
assert.deepEqual([...viewAs.applyViewAs(operatorUser, "viewer").permissions], ["dashboard:view"], "non-admins keep only permissions they already hold");
assert.equal(viewAs.applyViewAs(volunteerUser, "operator").role, "volunteer");
assert.equal(viewAs.applyViewAs(viewerUser, "admin").role, "viewer");
previewEnv.NODE_ENV = "development";
jar.set(localPreview.LOCAL_PREVIEW_COOKIE, "logged-in");
jar.set(viewAs.VIEW_AS_COOKIE, "volunteer");
assert.equal((await previewAuth.getCurrentUser()).role, "volunteer");
assert.equal((await previewAuth.getActualUser()).role, "admin");
jar.delete(viewAs.VIEW_AS_COOKIE);
let viewAsActual = adminUser;
const viewAsRoute = loadTs("src/app/api/auth/view-as/route.ts", {
  "next/headers": { cookies: async () => cookieStore },
  "@/lib/auth": { getActualUser: async () => viewAsActual },
  "@/lib/view-as": viewAs,
  "@/lib/same-origin": sameOrigin,
}, { process: { env: { NODE_ENV: "test" } } });
const viewAsRequest = (role, origin = "https://basin.example.test") => new Request("https://basin.example.test/api/auth/view-as", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify({ role }) });
assert.equal((await viewAsRoute.POST(viewAsRequest("viewer"))).status, 200);
assert.equal(jar.get(viewAs.VIEW_AS_COOKIE), "viewer");
assert.equal((await viewAsRoute.POST(viewAsRequest("admin"))).status, 200);
assert.equal(jar.has(viewAs.VIEW_AS_COOKIE), false, "returning to the real role clears the preview");
assert.equal((await viewAsRoute.POST(viewAsRequest("viewer", "https://outside.example.test"))).status, 403);
assert.equal((await viewAsRoute.POST(viewAsRequest("superuser"))).status, 403);
viewAsActual = operatorUser;
assert.equal((await viewAsRoute.POST(viewAsRequest("admin"))).status, 403);
assert.equal(jar.has(viewAs.VIEW_AS_COOKIE), false);
viewAsActual = null;
assert.equal((await viewAsRoute.POST(viewAsRequest("viewer"))).status, 401);
console.log("PASS: view-as role preview only lowers access, server applies it, route rejects escalation, foreign origins and guests");

// Volunteer scope and row-locked claim conflicts.
const volunteer = { ...owner, role: "volunteer", displayName: "อาสาทดสอบ", permissions: [] };
assert.equal(reports.canClaimReports(volunteer), true);
assert.equal(reports.canManageRoads(volunteer), true);
assert.equal(reports.canManageReports(volunteer), false);
assert.equal(reports.canClaimReports(owner), false);
currentUser = volunteer; calls = [];
assert.equal((await route.GET()).status, 200);
assert.equal(calls[0].params[0], false);
assert.equal(calls[0].params[2], true);
assert.match(calls[0].sql, /r.kind = 'help'/);
let claimRow = { kind: "help", status: "pending", assigned_to: null };
let claimStatements = [];
const claimClient = {
  query: async (sql, params) => { claimStatements.push({ sql, params }); return { rows: sql.includes("for update") ? [claimRow] : [] }; },
  release() {},
};
const claimRoute = loadTs("src/app/api/reports/route.ts", { "@/lib/auth": { getCurrentUser: async () => currentUser }, "@/lib/db": { getPool: () => ({ connect: async () => claimClient }) }, "@/lib/local-preview": localPreview, "@/lib/reports": reports, "@/lib/same-origin": sameOrigin });
const claimRequest = () => new Request("https://example.test/api/reports", { method: "PATCH", body: JSON.stringify({ id: owner.id, action: "claim", status: "in_progress", note: "" }) });
assert.equal((await claimRoute.PATCH(claimRequest())).status, 200);
assert.ok(claimStatements.some(s => s.sql.includes("assigned_to = $2")));
assert.ok(claimStatements.some(s => s.sql.includes("citizen_report_events")));
assert.ok(claimStatements.some(s => s.sql === "commit"));
for (const row of [ { kind: "help", status: "pending", assigned_to: owner.id }, { kind: "flood", status: "pending", assigned_to: null }, { kind: "help", status: "resolved", assigned_to: null } ]) {
  claimRow = row; claimStatements = [];
  assert.equal((await claimRoute.PATCH(claimRequest())).status, 409);
  assert.ok(!claimStatements.some(s => s.sql.startsWith("update")));
}
assert.equal((await claimRoute.PATCH(new Request("https://example.test/api/reports", { method: "PATCH", body: JSON.stringify({ id: owner.id, status: "resolved", note: "" }) }))).status, 403);
const roads = loadTs("src/lib/road-closures.ts");
const validRoad = { name: "ถนนหน้าวัด", description: "น้ำท่วมสูงผ่านไม่ได้", aLat: 7.8, aLng: 100, bLat: 7.81, bLng: 100.01 };
assert.ok(roads.validateRoadClosure(validRoad));
for (const patch of [{ bLat: 7.8, bLng: 100 }, { aLat: 91 }, { bLng: "100" }, { aLat: null }, { description: "" }]) assert.equal(roads.validateRoadClosure({ ...validRoad, ...patch }), null);
let roadWrites = [];
const roadApi = loadTs("src/app/api/road-closures/route.ts", { "@/lib/auth": { getCurrentUser: async () => currentUser }, "@/lib/db": { getPool: () => ({ query: async (sql, params) => { roadWrites.push({ sql, params }); return { rows: [{ id: owner.id }] }; } }) }, "@/lib/reports": reports, "@/lib/road-closures": roads, "@/lib/same-origin": sameOrigin });
const roadRequest = (body = validRoad, origin = "https://example.test") => new Request("https://example.test/api/road-closures", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
currentUser = owner;
assert.equal((await roadApi.POST(roadRequest())).status, 403);
currentUser = volunteer;
assert.equal((await roadApi.POST(roadRequest(validRoad, "https://evil.test"))).status, 403);
assert.equal((await roadApi.POST(roadRequest({ ...validRoad, bLat: 91 }))).status, 422);
assert.equal(roadWrites.length, 0);
assert.equal((await roadApi.POST(roadRequest())).status, 201);
assert.equal((await roadApi.PATCH(roadRequest({ id: owner.id }))).status, 200);
console.log("PASS: volunteer queue scope, atomic claim/history, duplicate/closed/non-help rejection, staff-only transitions, road validation, closure authorization, reopening");
const closedRoad = { id: owner.id, name: "ถนนทดสอบ", aLat: 7.8, aLng: 99.99, bLat: 7.8, bLng: 100.01 };
let routingCoordinates = [[100, 7.79], [100, 7.82]];
const routing = loadTs("src/app/api/evacuation-route/route.ts", { "@/lib/db": { getPool: () => ({ query: async () => ({ rows: [closedRoad] }) }) }, "@/lib/road-closures": roads }, { fetch: async () => Response.json({ code: "Ok", routes: [{ distance: 1000, duration: 100, geometry: { type: "LineString", coordinates: routingCoordinates } }] }), AbortSignal });
const routingRequest = () => new Request("https://example.test/api/evacuation-route", { method: "POST", body: JSON.stringify({ start: [7.79, 100], destination: [7.82, 100] }) });
assert.equal((await routing.POST(routingRequest())).status, 409);
routingCoordinates = [[99.97, 7.79], [99.98, 7.82]];
assert.equal((await routing.POST(routingRequest())).status, 200);
console.log("PASS: evacuation routing rejects all candidates crossing a closed A–B corridor and accepts a clear route");
