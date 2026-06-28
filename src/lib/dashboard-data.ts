import { getPool } from "@/lib/db";

export type Shelter = {
  id: string;
  name: string;
  capacity: number;
  status: "open" | "full" | "standby" | string;
  lat: number;
  lng: number;
  updatedAt: string | null;
};

export type TelemetryStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  level: number;
  status: "normal" | "watch" | "critical";
};

export type DashboardPayload = {
  updatedAt: string;
  source: "database" | "fallback";
  shelters: Shelter[];
  stations: TelemetryStation[];
  floodArea: [number, number][];
  summary: {
    stationsOnline: number;
    latestWaterLevel: number;
    rainfall24h: number;
    warningAreas: number;
    shelters: number;
  };
};

const stations: TelemetryStation[] = [
  {
    id: "PY-01",
    name: "สถานีบ้านป่าพะยอม",
    lat: 7.7773,
    lng: 100.1992,
    level: 5.15,
    status: "watch",
  },
  {
    id: "PY-02",
    name: "สถานีคลองป่าพะยอม",
    lat: 7.7871,
    lng: 100.1865,
    level: 3.84,
    status: "normal",
  },
  {
    id: "PY-03",
    name: "สถานีท้ายฝาย",
    lat: 7.7694,
    lng: 100.2104,
    level: 4.32,
    status: "normal",
  },
  {
    id: "PY-04",
    name: "สถานีสะพานชุมชน",
    lat: 7.8031,
    lng: 100.2056,
    level: 5.02,
    status: "watch",
  },
  {
    id: "PY-05",
    name: "สถานีทุ่งนาเหนือ",
    lat: 7.7605,
    lng: 100.1797,
    level: 2.91,
    status: "normal",
  },
];

const fallbackShelters: Shelter[] = [
  {
    id: "demo-1",
    name: "ศูนย์พักพิงเทศบาลป่าพะยอม",
    capacity: 450,
    status: "open",
    lat: 7.7899,
    lng: 100.2065,
    updatedAt: null,
  },
  {
    id: "demo-2",
    name: "โรงเรียนบ้านทุ่งยาว",
    capacity: 280,
    status: "standby",
    lat: 7.7715,
    lng: 100.1977,
    updatedAt: null,
  },
];

const floodArea: [number, number][] = [
  [7.7866, 100.2109],
  [7.7999, 100.2151],
  [7.8062, 100.2038],
  [7.7909, 100.1944],
  [7.7753, 100.1987],
  [7.7741, 100.2082],
];

function buildPayload(shelters: Shelter[], source: DashboardPayload["source"]): DashboardPayload {
  return {
    updatedAt: new Date().toISOString(),
    source,
    shelters,
    stations,
    floodArea,
    summary: {
      stationsOnline: stations.length,
      latestWaterLevel: 5.15,
      rainfall24h: 0,
      warningAreas: 2,
      shelters: shelters.length,
    },
  };
}

export async function getDashboardData(): Promise<DashboardPayload> {
  const db = getPool();

  if (!db) {
    return buildPayload(fallbackShelters, "fallback");
  }

  try {
    const result = await db.query<{
      id: string;
      name: string;
      capacity: number | null;
      status: string | null;
      lng: number | null;
      lat: number | null;
      updated_at: Date | null;
    }>(`
      select
        id::text,
        name,
        capacity,
        coalesce(status, 'standby') as status,
        ST_X(geom::geometry) as lng,
        ST_Y(geom::geometry) as lat,
        updated_at
      from public.shelters
      where geom is not null
      order by
        case coalesce(status, 'standby')
          when 'open' then 1
          when 'standby' then 2
          when 'full' then 3
          else 4
        end,
        name
      limit 40
    `);

    const shelters = result.rows
      .filter((row) => row.lat !== null && row.lng !== null)
      .map((row) => ({
        id: row.id,
        name: row.name,
        capacity: row.capacity ?? 0,
        status: row.status ?? "standby",
        lat: Number(row.lat),
        lng: Number(row.lng),
        updatedAt: row.updated_at?.toISOString() ?? null,
      }));

    return buildPayload(shelters.length ? shelters : fallbackShelters, shelters.length ? "database" : "fallback");
  } catch (error) {
    console.error("Unable to load dashboard data", error);
    return buildPayload(fallbackShelters, "fallback");
  }
}
