import { getPool } from "@/lib/db";
import { isCurrentStationObservation } from "@/lib/public-situation";

export type Shelter = {
  id: string;
  code?: string | null;
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
  waterway: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
  level: number | null;
  observedAt: string | null;
  status: string;
};

export type DashboardPayload = {
  updatedAt: string;
  source: "database" | "fallback";
  shelters: Shelter[];
  stations: TelemetryStation[];
  floodArea: [number, number][];
  databaseSummary: {
    riskVillages: number | null;
    riskHouseholds: number | null;
    openShelters: number | null;
    openShelterCapacity: number | null;
    confirmedHelpPeople: number | null;
    confirmedHelpReports: number | null;
  };
  summary: {
    stationsOnline: number;
    latestWaterLevel: number | null;
    rainfall24h: number;
    warningAreas: number;
    shelters: number;
  };
};

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

function buildPayload(shelters: Shelter[], source: DashboardPayload["source"], databaseSummary: DashboardPayload["databaseSummary"] = {
  riskVillages: null, riskHouseholds: null, openShelters: null, openShelterCapacity: null, confirmedHelpPeople: null, confirmedHelpReports: null,
}, stations: TelemetryStation[] = []): DashboardPayload {
  const now = Date.now();
  const currentStations = stations.filter(station => station.status === "active" && isCurrentStationObservation(station.observedAt, now));
  const latestWater = currentStations.filter(station => station.level !== null)
    .sort((a, b) => Date.parse(b.observedAt!) - Date.parse(a.observedAt!))[0];
  return {
    updatedAt: new Date().toISOString(),
    source,
    shelters,
    stations,
    floodArea,
    databaseSummary,
    summary: {
      stationsOnline: currentStations.length,
      latestWaterLevel: latestWater?.level ?? null,
      rainfall24h: 0,
      warningAreas: 0,
      shelters: shelters.length,
    },
  };
}

export async function getDashboardData(): Promise<DashboardPayload> {
  const db = getPool();

  if (!db) {
    return buildPayload(fallbackShelters, "fallback");
  }

  const [shelterResult, villageResult, capacityResult, helpResult, stationResult] = await Promise.allSettled([
    db.query<{
      id: string;
      code: string | null;
      name: string;
      capacity: number | null;
      status: string | null;
      lng: number | null;
      lat: number | null;
      updated_at: Date | null;
    }>(`
      select
        id::text,
        code,
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
    `),
    db.query<{ risk_villages: number; risk_households: string }>(`
      select count(*) filter (where risk_status in ('watch', 'high'))::int as risk_villages,
        coalesce(sum(households) filter (where risk_status in ('watch', 'high')), 0)::text as risk_households
      from public.villages
    `),
    db.query<{ open_shelters: number; open_capacity: string }>(`
      select count(*) filter (where status = 'open')::int as open_shelters,
        coalesce(sum(capacity) filter (where status = 'open'), 0)::text as open_capacity
      from public.shelters
    `),
    db.query<{ help_people: string; help_reports: number }>(`
      select coalesce(sum(people_count), 0)::text as help_people, count(*)::int as help_reports
      from public.citizen_reports
      where kind = 'help' and status in ('verified', 'in_progress')
    `),
    db.query<{
      device_id: string; name: string | null; waterway: string; district: string; province: string;
      latitude: number; longitude: number; status: string; water_level: string | null; recorded_at: Date | null;
    }>(`
      select d.device_id, d.name, d.latitude, d.longitude, d.status,
        coalesce(d.metadata->>'waterway', d.location_name, '') as waterway,
        coalesce(d.metadata->>'district', '') as district,
        coalesce(d.metadata->>'province', '') as province,
        latest.water_level, latest.recorded_at
      from public.sensor_devices d
      left join lateral (
        select r.water_level, r.recorded_at
        from public.sensor_readings r where r.device_id = d.device_id
        order by r.recorded_at desc, r.received_at desc, r.id desc limit 1
      ) latest on true
      where coalesce(d.metadata->>'excluded_from_installation_list', 'false') <> 'true'
        and coalesce(d.metadata->>'deleted_at', '') = ''
        and d.latitude is not null and d.longitude is not null
      order by d.device_id
    `),
  ]);

  const stations: TelemetryStation[] = stationResult.status === "fulfilled" ? stationResult.value.rows.map(row => ({
    id: row.device_id, name: row.name || row.device_id,
    waterway: row.waterway, district: row.district, province: row.province,
    lat: Number(row.latitude), lng: Number(row.longitude), status: row.status,
    level: row.water_level === null ? null : Number(row.water_level),
    observedAt: row.recorded_at?.toISOString() ?? null,
  })) : [];
  if (stationResult.status === "rejected") console.error("Unable to load dashboard stations", stationResult.reason);

  const villages = villageResult.status === "fulfilled" ? villageResult.value.rows[0] : null;
  const capacity = capacityResult.status === "fulfilled" ? capacityResult.value.rows[0] : null;
  const help = helpResult.status === "fulfilled" ? helpResult.value.rows[0] : null;
  const databaseSummary: DashboardPayload["databaseSummary"] = {
    riskVillages: villages?.risk_villages ?? null,
    riskHouseholds: villages ? Number(villages.risk_households) : null,
    openShelters: capacity?.open_shelters ?? null,
    openShelterCapacity: capacity ? Number(capacity.open_capacity) : null,
    confirmedHelpPeople: help ? Number(help.help_people) : null,
    confirmedHelpReports: help?.help_reports ?? null,
  };

  if (shelterResult.status === "fulfilled") {
    const shelters = shelterResult.value.rows
      .filter((row) => row.lat !== null && row.lng !== null)
      .map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        capacity: row.capacity ?? 0,
        status: row.status ?? "standby",
        lat: Number(row.lat),
        lng: Number(row.lng),
        updatedAt: row.updated_at?.toISOString() ?? null,
      }));

    return buildPayload(shelters, "database", databaseSummary, stations);
  }

  console.error("Unable to load dashboard shelters", shelterResult.reason);
  return buildPayload(fallbackShelters, "fallback", databaseSummary, stations);
}
