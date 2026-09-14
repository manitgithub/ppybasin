import https from "node:https";

export type SourceStatus = "ok" | "unavailable" | "schema_changed" | "no_confirmed_data";

export type SourceHealth = {
  id: string;
  label: string;
  url: string;
  status: SourceStatus;
  message: string;
  checkedAt: string;
};

export type RainStation = {
  id: string;
  name: string;
  district: string;
  tambon: string;
  province: string;
  lat: number | null;
  lng: number | null;
  rainfallMm: number;
  observedAt: string;
  agency: string;
};

export type WaterLevelStation = {
  id: string;
  name: string;
  district: string;
  river: string;
  lat: number | null;
  lng: number | null;
  waterLevelM: number | null;
  waterLevelMsl: number | null;
  storagePercent: number | null;
  situationLevel: number | null;
  bankText: string | null;
  observedAt: string;
  agency: string;
};

export type RadarImage = {
  name: string;
  agency: string;
  observedAt: string;
  fileName: string;
};

export type ForecastSummary = {
  sourceUrl: string;
  status: SourceStatus;
  checkedAt: string;
  probabilityPercent: string | null;
  heavyRainText: string | null;
  mentionsPhatthalungDirectly: boolean;
  isRegionalForecast: boolean;
  evidence: string;
};

export type ReservoirSnapshot = {
  status: SourceStatus;
  sourceUrl: string;
  checkedAt: string;
  reservoirId: string;
  name: string | null;
  province: string | null;
  normalCapacityMcm: number | null;
  latestDataDate: string | null;
  storageMcm: number | null;
  capacityPercent: number | null;
  inflowMcm: number | null;
  outflowMcm: number | null;
  usableStorageMcm: number | null;
  emptyToNormalMcm: number | null;
  balanceCheckMcm: number | null;
  message: string;
};

export type DisasterNoticeSummary = {
  sourceUrl: string;
  status: SourceStatus;
  checkedAt: string;
  message: string;
  matchedItems: string[];
};

export type SituationPayload = {
  updatedAt: string;
  thaiWater: {
    rain24h: RainStation[];
    rain72h: RainStation[];
    waterLevels: WaterLevelStation[];
    radar: RadarImage | null;
  };
  tmd: {
    daily: ForecastSummary;
    sevenDay: ForecastSummary;
  };
  reservoir: ReservoirSnapshot;
  disaster: {
    central: DisasterNoticeSummary;
    phatthalung: DisasterNoticeSummary;
    gistdaFloodBoundary: DisasterNoticeSummary;
  };
  sources: SourceHealth[];
};

const THAIWATER_BASE = "https://api-v3.thaiwater.net/api/v1/thaiwater30/provinces";
const PHATTHALUNG_PROVINCE_CODE = "93";
const RID_RESERVOIR_ID = "rsv442";
const RID_NORMAL_CAPACITY_FALLBACK = 20.5;

const urls = {
  rain24h: `${THAIWATER_BASE}/rain24?include_zero=1&province_code=${PHATTHALUNG_PROVINCE_CODE}`,
  rain72h: `${THAIWATER_BASE}/rain3d?province_code=${PHATTHALUNG_PROVINCE_CODE}`,
  waterLevel: `${THAIWATER_BASE}/waterlevel?province_code=${PHATTHALUNG_PROVINCE_CODE}`,
  radar: `${THAIWATER_BASE}/radar?province_code=${PHATTHALUNG_PROVINCE_CODE}`,
  tmdDaily: "https://www.tmd.go.th/weather/region/southerneastcoast",
  tmdSevenDay: "https://www.tmd.go.th/forecast/sevenday",
  disasterCentral: "https://www.disaster.go.th/home",
  disasterPhatthalung: "https://plg.disaster.go.th/plg",
  gistdaFlood: "https://disaster.gistda.or.th/flood",
};

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textAt(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberAt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nested(record: Record<string, unknown>, path: string[]) {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), record);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function fetchTextAllowingInvalidCertificate(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: { Accept: "text/html,application/xhtml+xml" },
        rejectUnauthorized: false,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }

        response.setEncoding("utf8");
        let body = "";
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("end", () => resolve(body));
      },
    );

    request.setTimeout(15_000, () => {
      request.destroy(new Error("TMD request timed out"));
    });
    request.on("error", reject);
  });
}

async function fetchTmdText(url: string) {
  try {
    return await fetchText(url);
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    const code = isRecord(cause) && typeof cause.code === "string" ? cause.code : "";
    if (code !== "UNABLE_TO_VERIFY_LEAF_SIGNATURE") throw error;
    return fetchTextAllowingInvalidCertificate(url);
  }
}

function dataArray(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.filter(isRecord);
}

function sourceHealth(id: string, label: string, url: string, status: SourceStatus, message: string): SourceHealth {
  return { id, label, url, status, message, checkedAt: nowIso() };
}

function parseRainStation(row: Record<string, unknown>, field: "rain_24h" | "rain_3d"): RainStation | null {
  const rainfallMm = numberAt(row[field]);
  const station = nested(row, ["station"]);
  const geocode = nested(row, ["geocode"]);
  if (rainfallMm === null || !isRecord(station) || !isRecord(geocode)) return null;

  const id = numberAt(station.id)?.toString() ?? numberAt(row.id)?.toString() ?? "";
  const name = textAt(nested(station, ["tele_station_name", "th"]), textAt(nested(station, ["tele_station_name", "en"]), "ไม่ระบุสถานี"));
  const observedAt = textAt(row.rainfall_datetime);
  if (!id || !observedAt) return null;

  return {
    id,
    name,
    district: textAt(nested(geocode, ["amphoe_name", "th"]), "-"),
    tambon: textAt(nested(geocode, ["tumbon_name", "th"]), "-"),
    province: textAt(nested(geocode, ["province_name", "th"]), "พัทลุง"),
    lat: numberAt(station.tele_station_lat),
    lng: numberAt(station.tele_station_long),
    rainfallMm,
    observedAt,
    agency: textAt(nested(row, ["agency", "agency_shortname", "th"]), textAt(nested(row, ["agency", "agency_name", "th"]), "-")),
  };
}

function parseWaterLevel(row: Record<string, unknown>): WaterLevelStation | null {
  const station = nested(row, ["station"]);
  const geocode = nested(row, ["geocode"]);
  if (!isRecord(station) || !isRecord(geocode)) return null;

  const id = numberAt(station.id)?.toString() ?? numberAt(row.id)?.toString() ?? "";
  const observedAt = textAt(row.waterlevel_datetime);
  if (!id || !observedAt) return null;

  return {
    id,
    name: textAt(nested(station, ["tele_station_name", "th"]), textAt(nested(station, ["tele_station_name", "en"]), "ไม่ระบุสถานี")),
    district: textAt(nested(geocode, ["amphoe_name", "th"]), "-"),
    river: textAt(row.river_name, "-"),
    lat: numberAt(station.tele_station_lat),
    lng: numberAt(station.tele_station_long),
    waterLevelM: numberAt(row.waterlevel_m),
    waterLevelMsl: numberAt(row.waterlevel_msl),
    storagePercent: numberAt(row.storage_percent),
    situationLevel: numberAt(row.situation_level),
    bankText: textAt(row.diff_wl_bank_text) || null,
    observedAt,
    agency: textAt(nested(row, ["agency", "agency_shortname", "th"]), textAt(nested(row, ["agency", "agency_name", "th"]), "-")),
  };
}

function parseRadar(row: Record<string, unknown>): RadarImage | null {
  const name = textAt(row.radar_name);
  const observedAt = textAt(row.media_datetime);
  const fileName = textAt(row.filename);
  if (!name || !observedAt || !fileName) return null;

  return {
    name,
    agency: textAt(row.agency, "-"),
    observedAt,
    fileName,
  };
}

export async function getThaiWaterSituation() {
  const checkedSources: SourceHealth[] = [];
  const [rain24Result, rain72Result, waterLevelResult, radarResult] = await Promise.allSettled([
    fetchJson(urls.rain24h),
    fetchJson(urls.rain72h),
    fetchJson(urls.waterLevel),
    fetchJson(urls.radar),
  ]);

  const rain24h =
    rain24Result.status === "fulfilled" ? dataArray(rain24Result.value).map((row) => parseRainStation(row, "rain_24h")).filter((item): item is RainStation => Boolean(item)) : [];
  checkedSources.push(
    sourceHealth("thaiwater-rain24h", "ThaiWater/สสน. ฝน 24 ชั่วโมง", urls.rain24h, rain24h.length ? "ok" : "schema_changed", rain24h.length ? `อ่านได้ ${rain24h.length} สถานี` : "ไม่พบข้อมูลฝน 24 ชั่วโมงที่ parser ยืนยันได้"),
  );

  const rain72h =
    rain72Result.status === "fulfilled" ? dataArray(rain72Result.value).map((row) => parseRainStation(row, "rain_3d")).filter((item): item is RainStation => Boolean(item)) : [];
  checkedSources.push(
    sourceHealth("thaiwater-rain72h", "ThaiWater/สสน. ฝน 72 ชั่วโมง", urls.rain72h, rain72h.length ? "ok" : "schema_changed", rain72h.length ? `อ่านได้ ${rain72h.length} สถานี` : "ไม่พบข้อมูลฝน 72 ชั่วโมงที่ parser ยืนยันได้"),
  );

  const waterLevels =
    waterLevelResult.status === "fulfilled" ? dataArray(waterLevelResult.value).map(parseWaterLevel).filter((item): item is WaterLevelStation => Boolean(item)) : [];
  checkedSources.push(
    sourceHealth("thaiwater-waterlevel", "ThaiWater/สสน. ระดับน้ำ", urls.waterLevel, waterLevels.length ? "ok" : "schema_changed", waterLevels.length ? `อ่านได้ ${waterLevels.length} สถานี` : "ไม่พบข้อมูลระดับน้ำที่ parser ยืนยันได้"),
  );

  const radarRows = radarResult.status === "fulfilled" ? dataArray(radarResult.value) : [];
  const radar = radarRows.map(parseRadar).find(Boolean) ?? null;
  checkedSources.push(
    sourceHealth("thaiwater-radar", "ThaiWater/สสน. เรดาร์", urls.radar, radar ? "ok" : "schema_changed", radar ? `ภาพล่าสุด ${radar.observedAt}` : "ไม่พบข้อมูลเรดาร์ที่ parser ยืนยันได้"),
  );

  return { rain24h, rain72h, waterLevels, radar, sources: checkedSources };
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function htmlToText(html: string) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractForecast(text: string, sourceUrl: string): ForecastSummary {
  const contentLines = text
    .split("\n")
    .filter((line) => line.includes("ฝน") || line.includes("ภาคใต้") || line.includes("พัทลุง"))
    .filter((line) => !line.includes("พยากรณ์ฝนเชิงพื้นที่"))
    .filter((line) => !line.includes("พื้นที่เสี่ยงฝนตกหนัก"))
    .filter((line) => !line.includes("Widget"))
    .filter((line) => !line.includes("รายงานฝนอำเภอ"))
    .filter((line) => !line.includes("เรดาร์ตรวจอากาศ"));
  const contentText = contentLines.join("\n");
  const rainProbability = [...contentText.matchAll(/ฝน\s*(\d{1,3})\s*-\s*(\d{1,3})\s*%/g)].map((match) => `${match[1]}-${match[2]}%`);
  const heavyMatches = [...contentText.matchAll(/ฝน(?:ตก)?หนักมาก|ฝน(?:ตก)?หนัก/g)].map((match) => match[0]);
  const evidenceLine =
    contentLines.find((line) => /ฝน\s*\d{1,3}\s*-\s*\d{1,3}\s*%/.test(line)) ??
    contentLines.find((line) => line.includes("ฝนตกหนักมาก")) ??
    contentLines.find((line) => line.includes("ฝนตกหนัก") || line.includes("ฝนหนัก")) ??
    contentLines.find((line) => line.includes("พัทลุง") && (line.includes("ฝน") || line.includes("ภาคใต้"))) ??
    contentLines.find((line) => line.length > 12) ??
    "ไม่พบข้อความพยากรณ์ที่ parser ยืนยันได้";
  const directHeavyRainForProvince = contentLines
    .some((line) => line.includes("พัทลุง") && (line.includes("ฝนหนัก") || line.includes("ฝนตกหนัก")));

  return {
    sourceUrl,
    status: evidenceLine.startsWith("ไม่พบ") ? "schema_changed" : "ok",
    checkedAt: nowIso(),
    probabilityPercent: rainProbability[0] ?? null,
    heavyRainText: heavyMatches[0] ?? null,
    mentionsPhatthalungDirectly: directHeavyRainForProvince,
    isRegionalForecast: contentText.includes("ภาคใต้ฝั่งตะวันออก") || contentText.includes("ภาคใต้(ฝั่งตะวันออก)"),
    evidence: evidenceLine,
  };
}

export async function getTmdSituation() {
  const [daily, sevenDay] = await Promise.allSettled([fetchTmdText(urls.tmdDaily), fetchTmdText(urls.tmdSevenDay)]);

  const dailyForecast =
    daily.status === "fulfilled"
      ? extractForecast(htmlToText(daily.value), urls.tmdDaily)
      : {
          sourceUrl: urls.tmdDaily,
          status: "unavailable" as const,
          checkedAt: nowIso(),
          probabilityPercent: null,
          heavyRainText: null,
          mentionsPhatthalungDirectly: false,
          isRegionalForecast: false,
          evidence: "เรียกข้อมูลพยากรณ์ 24 ชั่วโมงไม่ได้",
        };

  const sevenDayForecast =
    sevenDay.status === "fulfilled"
      ? extractForecast(htmlToText(sevenDay.value), urls.tmdSevenDay)
      : {
          sourceUrl: urls.tmdSevenDay,
          status: "unavailable" as const,
          checkedAt: nowIso(),
          probabilityPercent: null,
          heavyRainText: null,
          mentionsPhatthalungDirectly: false,
          isRegionalForecast: false,
          evidence: "เรียกข้อมูลแนวโน้ม 7 วันไม่ได้",
        };

  return {
    daily: dailyForecast,
    sevenDay: sevenDayForecast,
    sources: [
      sourceHealth("tmd-daily", "กรมอุตุนิยมวิทยา พยากรณ์ 24 ชั่วโมง", urls.tmdDaily, dailyForecast.status, dailyForecast.evidence),
      sourceHealth("tmd-seven-day", "กรมอุตุนิยมวิทยา แนวโน้ม 7 วัน", urls.tmdSevenDay, sevenDayForecast.status, sevenDayForecast.evidence),
    ],
  };
}

function bangkokDate(daysOffset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildRidApiUrl(startDate: string, endDate: string) {
  const params = new URLSearchParams({
    rsvmiddle: RID_RESERVOIR_ID,
    date_start: startDate,
    date_end: endDate,
    percent: "",
  });
  return `https://app.rid.go.th/reservoir/api/rsvmiddle?${params.toString()}`;
}

export async function getReservoirSituation(): Promise<{ reservoir: ReservoirSnapshot; source: SourceHealth }> {
  const startDate = bangkokDate(-14);
  const endDate = bangkokDate(0);
  const url = buildRidApiUrl(startDate, endDate);

  try {
    const payload = await fetchJson(url);
    if (!isRecord(payload) || !Array.isArray(payload.reservoir_data)) {
      throw new Error("RID schema changed");
    }

    const rows = payload.reservoir_data.filter(isRecord);
    const latest = rows.at(-1);
    if (!latest) {
      const reservoir = {
        status: "no_confirmed_data" as const,
        sourceUrl: url,
        checkedAt: nowIso(),
        reservoirId: RID_RESERVOIR_ID,
        name: textAt(payload.reservoir_name) || null,
        province: textAt(payload.reservoir_province) || null,
        normalCapacityMcm: null,
        latestDataDate: null,
        storageMcm: null,
        capacityPercent: null,
        inflowMcm: null,
        outflowMcm: null,
        usableStorageMcm: null,
        emptyToNormalMcm: null,
        balanceCheckMcm: null,
        message: "ยังไม่มีข้อมูลอ่างเก็บน้ำในช่วงวันที่ที่เรียก",
      };
      return { reservoir, source: sourceHealth("rid-reservoir", "RID SWOC อ่างเก็บน้ำป่าพะยอม", url, reservoir.status, reservoir.message) };
    }

    const previous = rows.length >= 2 ? rows[rows.length - 2] : null;
    const normalCapacityMcm = numberAt(latest.cap_resv) ?? RID_NORMAL_CAPACITY_FALLBACK;
    const storageMcm = numberAt(latest.qdisc_curr);
    const previousStorageMcm = previous ? numberAt(previous.qdisc_curr) : null;
    const inflowMcm = numberAt(latest.q_info);
    const outflowMcm = numberAt(latest.q_outfo);
    const emptyToNormalMcm = normalCapacityMcm !== null && storageMcm !== null ? Math.max(normalCapacityMcm - storageMcm, 0) : null;
    const balanceCheckMcm =
      previousStorageMcm !== null && storageMcm !== null && inflowMcm !== null && outflowMcm !== null
        ? storageMcm - (previousStorageMcm + inflowMcm - outflowMcm)
        : null;

    const reservoir = {
      status: "ok" as const,
      sourceUrl: url,
      checkedAt: nowIso(),
      reservoirId: RID_RESERVOIR_ID,
      name: textAt(payload.reservoir_name) || null,
      province: textAt(payload.reservoir_province) || null,
      normalCapacityMcm,
      latestDataDate: textAt(latest.date) || null,
      storageMcm,
      capacityPercent: numberAt(latest.percent_resv_curr),
      inflowMcm,
      outflowMcm,
      usableStorageMcm: numberAt(latest.water_workable),
      emptyToNormalMcm,
      balanceCheckMcm,
      message: `ข้อมูลล่าสุดวันที่ ${textAt(latest.date) || "-"}`,
    };

    return { reservoir, source: sourceHealth("rid-reservoir", "RID SWOC อ่างเก็บน้ำป่าพะยอม", url, "ok", reservoir.message) };
  } catch (error) {
    const reservoir = {
      status: "unavailable" as const,
      sourceUrl: url,
      checkedAt: nowIso(),
      reservoirId: RID_RESERVOIR_ID,
      name: null,
      province: null,
      normalCapacityMcm: null,
      latestDataDate: null,
      storageMcm: null,
      capacityPercent: null,
      inflowMcm: null,
      outflowMcm: null,
      usableStorageMcm: null,
      emptyToNormalMcm: null,
      balanceCheckMcm: null,
      message: error instanceof Error ? error.message : "เรียกข้อมูล RID ไม่สำเร็จ",
    };
    return { reservoir, source: sourceHealth("rid-reservoir", "RID SWOC อ่างเก็บน้ำป่าพะยอม", url, "unavailable", reservoir.message) };
  }
}

function extractDisasterMatches(html: string) {
  const text = htmlToText(html);
  return text
    .split("\n")
    .filter((line) => /พัทลุง|อุทกภัย|น้ำท่วม|ประกาศ|แจ้งเตือน/.test(line))
    .slice(0, 8);
}

async function getDisasterNotice(url: string, label: string): Promise<DisasterNoticeSummary> {
  try {
    const html = await fetchText(url);
    const matchedItems = extractDisasterMatches(html);
    return {
      sourceUrl: url,
      status: matchedItems.length ? "ok" : "no_confirmed_data",
      checkedAt: nowIso(),
      message: matchedItems.length ? `${label}: พบข้อความที่ค้นคืนได้ ${matchedItems.length} รายการ` : `${label}: ไม่พบประกาศที่ค้นคืนได้ ไม่เท่ากับยืนยันว่าไม่มีอุทกภัย`,
      matchedItems,
    };
  } catch {
    return {
      sourceUrl: url,
      status: "unavailable",
      checkedAt: nowIso(),
      message: `${label}: เรียกข้อมูลไม่ได้`,
      matchedItems: [],
    };
  }
}

export async function getDisasterSituation() {
  const [central, phatthalung, gistdaHtml] = await Promise.allSettled([
    getDisasterNotice(urls.disasterCentral, "ปภ.ส่วนกลาง"),
    getDisasterNotice(urls.disasterPhatthalung, "ปภ.พัทลุง"),
    fetchText(urls.gistdaFlood),
  ]);

  const centralNotice =
    central.status === "fulfilled"
      ? central.value
      : { sourceUrl: urls.disasterCentral, status: "unavailable" as const, checkedAt: nowIso(), message: "ปภ.ส่วนกลาง: เรียกข้อมูลไม่ได้", matchedItems: [] };
  const phatthalungNotice =
    phatthalung.status === "fulfilled"
      ? phatthalung.value
      : { sourceUrl: urls.disasterPhatthalung, status: "unavailable" as const, checkedAt: nowIso(), message: "ปภ.พัทลุง: เรียกข้อมูลไม่ได้", matchedItems: [] };

  const gistdaFloodBoundary: DisasterNoticeSummary =
    gistdaHtml.status === "fulfilled"
      ? {
          sourceUrl: urls.gistdaFlood,
          status: "no_confirmed_data",
          checkedAt: nowIso(),
          message: "ไม่มีข้อมูลขอบเขตน้ำท่วมที่ยืนยันได้",
          matchedItems: extractDisasterMatches(gistdaHtml.value),
        }
      : {
          sourceUrl: urls.gistdaFlood,
          status: "unavailable",
          checkedAt: nowIso(),
          message: "GISTDA Flood Platform เข้าไม่ได้ จึงไม่มีข้อมูลขอบเขตน้ำท่วมที่ยืนยันได้",
          matchedItems: [],
        };

  return {
    central: centralNotice,
    phatthalung: phatthalungNotice,
    gistdaFloodBoundary,
    sources: [
      sourceHealth("disaster-central", "ปภ.ส่วนกลาง", urls.disasterCentral, centralNotice.status, centralNotice.message),
      sourceHealth("disaster-phatthalung", "ปภ.พัทลุง", urls.disasterPhatthalung, phatthalungNotice.status, phatthalungNotice.message),
      sourceHealth("gistda-flood", "GISTDA Flood Platform", urls.gistdaFlood, gistdaFloodBoundary.status, gistdaFloodBoundary.message),
    ],
  };
}

export async function getSituationData(): Promise<SituationPayload> {
  const [thaiWater, tmd, reservoir, disaster] = await Promise.all([
    getThaiWaterSituation(),
    getTmdSituation(),
    getReservoirSituation(),
    getDisasterSituation(),
  ]);

  return {
    updatedAt: nowIso(),
    thaiWater: {
      rain24h: thaiWater.rain24h,
      rain72h: thaiWater.rain72h,
      waterLevels: thaiWater.waterLevels,
      radar: thaiWater.radar,
    },
    tmd: {
      daily: tmd.daily,
      sevenDay: tmd.sevenDay,
    },
    reservoir: reservoir.reservoir,
    disaster: {
      central: disaster.central,
      phatthalung: disaster.phatthalung,
      gistdaFloodBoundary: disaster.gistdaFloodBoundary,
    },
    sources: [...thaiWater.sources, ...tmd.sources, reservoir.source, ...disaster.sources],
  };
}
