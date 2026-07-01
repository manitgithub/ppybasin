import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type VillageBody = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  tambon?: unknown;
  households?: unknown;
  population?: unknown;
  risk_status?: unknown;
  primary_shelter?: unknown;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalTextValue(value: unknown) {
  const text = textValue(value);
  return text || null;
}

function integerValue(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numeric) ? numeric : undefined;
}

async function canManageVillageData() {
  const user = await getCurrentUser();
  return Boolean(user && (user.role === "admin" || user.permissions.includes("sensors:manage")));
}

function validateVillagePayload(body: VillageBody) {
  const errors: string[] = [];
  const id = textValue(body.id);
  const code = optionalTextValue(body.code);
  const name = textValue(body.name);
  const tambon = textValue(body.tambon);
  const households = integerValue(body.households);
  const population = integerValue(body.population);
  const riskStatus = textValue(body.risk_status) || "normal";
  const primaryShelter = optionalTextValue(body.primary_shelter);

  if (!name) {
    errors.push("name is required");
  }

  if (!tambon) {
    errors.push("tambon is required");
  }

  if (households === undefined || households < 0) {
    errors.push("households must be a positive integer");
  }

  if (population === undefined || population < 0) {
    errors.push("population must be a positive integer");
  }

  if (!["normal", "watch", "high"].includes(riskStatus)) {
    errors.push("risk_status must be normal, watch, or high");
  }

  if (code && code.length > 64) {
    errors.push("code must be 64 characters or less");
  }

  if (errors.length) {
    return { errors };
  }

  return {
    payload: {
      id,
      code,
      name,
      tambon,
      households,
      population,
      riskStatus,
      primaryShelter,
    },
  };
}

export async function GET() {
  const db = getPool();

  if (!db) {
    return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  try {
    const result = await db.query(`
      select
        id::text,
        code,
        name,
        tambon,
        households,
        population,
        risk_status,
        primary_shelter,
        updated_at
      from public.villages
      order by
        case risk_status when 'high' then 1 when 'watch' then 2 else 3 end,
        tambon,
        name
    `);

    return Response.json({ ok: true, villages: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load villages", error);
    return Response.json({ ok: false, error: "Unable to load villages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await canManageVillageData())) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: VillageBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { payload, errors } = validateVillagePayload(body);

  if (!payload) {
    return Response.json({ ok: false, error: "Validation failed", details: errors }, { status: 422 });
  }

  const db = getPool();

  if (!db) {
    return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  try {
    const result = await db.query(
      `
        insert into public.villages (
          code,
          name,
          tambon,
          households,
          population,
          risk_status,
          primary_shelter
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (code) do update set
          name = excluded.name,
          tambon = excluded.tambon,
          households = excluded.households,
          population = excluded.population,
          risk_status = excluded.risk_status,
          primary_shelter = excluded.primary_shelter,
          updated_at = now()
        returning id::text
      `,
      [
        payload.code,
        payload.name,
        payload.tambon,
        payload.households,
        payload.population,
        payload.riskStatus,
        payload.primaryShelter,
      ],
    );

    return Response.json({ ok: true, id: result.rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("Unable to save village", error);
    return Response.json({ ok: false, error: "Unable to save village" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await canManageVillageData())) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: VillageBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { payload, errors } = validateVillagePayload(body);

  if (!payload || !payload.id) {
    return Response.json({ ok: false, error: "Validation failed", details: errors ?? ["id is required"] }, { status: 422 });
  }

  const db = getPool();

  if (!db) {
    return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  try {
    const result = await db.query(
      `
        update public.villages
        set
          code = $2,
          name = $3,
          tambon = $4,
          households = $5,
          population = $6,
          risk_status = $7,
          primary_shelter = $8,
          updated_at = now()
        where id = $1::bigint
        returning id::text
      `,
      [
        payload.id,
        payload.code,
        payload.name,
        payload.tambon,
        payload.households,
        payload.population,
        payload.riskStatus,
        payload.primaryShelter,
      ],
    );

    if (!result.rows[0]) {
      return Response.json({ ok: false, error: "Village not found" }, { status: 404 });
    }

    return Response.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Unable to update village", error);
    return Response.json({ ok: false, error: "Unable to update village" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await canManageVillageData())) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: VillageBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = textValue(body.id);

  if (!id) {
    return Response.json({ ok: false, error: "id is required" }, { status: 422 });
  }

  const db = getPool();

  if (!db) {
    return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  try {
    const result = await db.query("delete from public.villages where id = $1::bigint returning id::text", [id]);

    if (!result.rows[0]) {
      return Response.json({ ok: false, error: "Village not found" }, { status: 404 });
    }

    return Response.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Unable to delete village", error);
    return Response.json({ ok: false, error: "Unable to delete village" }, { status: 500 });
  }
}
