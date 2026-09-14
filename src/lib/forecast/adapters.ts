export type ForecastSourceStatus = "ok" | "unavailable" | "schema_changed" | "blocked_embed";

export type ForecastSourceHealth = {
  id: string;
  label: string;
  url: string;
  status: ForecastSourceStatus;
  message: string;
  checkedAt: string;
};

export type MonthlyRainfallForecast = {
  id: number;
  initialYear: number;
  initialMonth: number;
  forecastYear: number;
  forecastMonth: number;
  provinceId: number;
  provinceNameTh: string;
  rainfallMm: number;
};

export type SixMonthRainfallForecast = {
  provinceId: number;
  provinceNameTh: string;
  initialYear: number;
  initialMonth: number;
  records: MonthlyRainfallForecast[];
  totalRainfallMm: number;
  averageRainfallMm: number;
  wettestMonth: MonthlyRainfallForecast | null;
  driestMonth: MonthlyRainfallForecast | null;
  trendText: string;
};

export type ClppRadarStatus = {
  url: string;
  status: ForecastSourceStatus;
  title: string;
  canEmbed: boolean;
  message: string;
  checkedAt: string;
};

export type ForecastPayload = {
  updatedAt: string;
  hiiRainfall: SixMonthRainfallForecast | null;
  clppRadar: ClppRadarStatus;
  sources: ForecastSourceHealth[];
};

const HII_RESOURCE_ID = "bdacca62-c465-411b-a135-617995eba967";
const HII_RESOURCE_PAGE =
  "https://data.hii.or.th/en/dataset/6months-forecast-rainfall/resource/bdacca62-c465-411b-a135-617995eba967";
const HII_DATASTORE_API = "https://data.hii.or.th/en/api/3/action/datastore_search";
const CLPP_RADAR_URL = "https://clpp-radar.onwr.go.th/";
const PHATTHALUNG_PROVINCE_ID = 93;
const FORECAST_YEAR = 2026;

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberAt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function textAt(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sourceHealth(
  id: string,
  label: string,
  url: string,
  status: ForecastSourceStatus,
  message: string,
): ForecastSourceHealth {
  return { id, label, url, status, message, checkedAt: nowIso() };
}

function buildHiiUrl() {
  const params = new URLSearchParams({
    resource_id: HII_RESOURCE_ID,
    filters: JSON.stringify({
      Province_ID: String(PHATTHALUNG_PROVINCE_ID),
      Initial_Year: String(FORECAST_YEAR),
    }),
    limit: "100",
  });

  return `${HII_DATASTORE_API}?${params.toString()}`;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchTextWithHeaders(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return {
    text: await response.text(),
    headers: response.headers,
  };
}

function parseHiiRecord(row: Record<string, unknown>): MonthlyRainfallForecast | null {
  const id = numberAt(row._id);
  const initialYear = numberAt(row.Initial_Year);
  const initialMonth = numberAt(row.Initial_Month);
  const forecastYear = numberAt(row.Forecast_Year);
  const forecastMonth = numberAt(row.Foreast_Month);
  const provinceId = numberAt(row.Province_ID);
  const provinceNameTh = textAt(row.Province_NameTH);
  const rainfallMm = numberAt(row["Rainfall.mm."]);

  if (
    id === null ||
    initialYear === null ||
    initialMonth === null ||
    forecastYear === null ||
    forecastMonth === null ||
    provinceId === null ||
    !provinceNameTh ||
    rainfallMm === null
  ) {
    return null;
  }

  return {
    id,
    initialYear,
    initialMonth,
    forecastYear,
    forecastMonth,
    provinceId,
    provinceNameTh,
    rainfallMm,
  };
}

function buildTrendText(records: MonthlyRainfallForecast[]) {
  if (records.length < 2) return "ข้อมูลไม่พอสำหรับอ่านแนวโน้ม";
  const firstHalf = records.slice(0, Math.ceil(records.length / 2));
  const secondHalf = records.slice(Math.ceil(records.length / 2));
  const firstAverage = firstHalf.reduce((sum, record) => sum + record.rainfallMm, 0) / firstHalf.length;
  const secondAverage = secondHalf.reduce((sum, record) => sum + record.rainfallMm, 0) / secondHalf.length;
  const diff = secondAverage - firstAverage;

  if (Math.abs(diff) < 15) return "แนวโน้มใกล้เคียงกันตลอดช่วง 6 เดือน";
  return diff > 0 ? "แนวโน้มฝนเพิ่มขึ้นในช่วงปลายคาบคาดการณ์" : "แนวโน้มฝนลดลงในช่วงปลายคาบคาดการณ์";
}

export async function getHiiSixMonthRainfall(): Promise<{
  forecast: SixMonthRainfallForecast | null;
  source: ForecastSourceHealth;
}> {
  const url = buildHiiUrl();

  try {
    const payload = await fetchJson(url);
    const result = isRecord(payload) ? payload.result : null;
    const records = isRecord(result) && Array.isArray(result.records) ? result.records.filter(isRecord).map(parseHiiRecord).filter((item): item is MonthlyRainfallForecast => Boolean(item)) : [];

    if (!records.length) {
      return {
        forecast: null,
        source: sourceHealth("hii-six-month-rainfall", "สสน. ฝนคาดการณ์ 6 เดือน", HII_RESOURCE_PAGE, "schema_changed", "ไม่พบ record ที่ parser ยืนยันได้"),
      };
    }

    const latestInitialMonth = Math.max(...records.map((record) => record.initialMonth));
    const latestRecords = records
      .filter((record) => record.initialMonth === latestInitialMonth)
      .sort((a, b) => a.forecastYear - b.forecastYear || a.forecastMonth - b.forecastMonth)
      .slice(0, 6);

    const totalRainfallMm = latestRecords.reduce((sum, record) => sum + record.rainfallMm, 0);
    const wettestMonth = latestRecords.reduce<MonthlyRainfallForecast | null>(
      (wettest, record) => (!wettest || record.rainfallMm > wettest.rainfallMm ? record : wettest),
      null,
    );
    const driestMonth = latestRecords.reduce<MonthlyRainfallForecast | null>(
      (driest, record) => (!driest || record.rainfallMm < driest.rainfallMm ? record : driest),
      null,
    );

    const forecast: SixMonthRainfallForecast = {
      provinceId: PHATTHALUNG_PROVINCE_ID,
      provinceNameTh: latestRecords[0]?.provinceNameTh ?? "จ.พัทลุง",
      initialYear: FORECAST_YEAR,
      initialMonth: latestInitialMonth,
      records: latestRecords,
      totalRainfallMm,
      averageRainfallMm: latestRecords.length ? totalRainfallMm / latestRecords.length : 0,
      wettestMonth,
      driestMonth,
      trendText: buildTrendText(latestRecords),
    };

    return {
      forecast,
      source: sourceHealth(
        "hii-six-month-rainfall",
        "สสน. ฝนคาดการณ์ 6 เดือน",
        HII_RESOURCE_PAGE,
        "ok",
        `อ่านข้อมูลปี 2569 จังหวัดพัทลุงได้ ${records.length.toLocaleString("th-TH")} รายการ ใช้รอบเดือน ${latestInitialMonth}`,
      ),
    };
  } catch (error) {
    return {
      forecast: null,
      source: sourceHealth(
        "hii-six-month-rainfall",
        "สสน. ฝนคาดการณ์ 6 เดือน",
        HII_RESOURCE_PAGE,
        "unavailable",
        error instanceof Error ? error.message : "เรียกข้อมูล สสน. ไม่สำเร็จ",
      ),
    };
  }
}

export async function getClppRadarStatus(): Promise<{
  clppRadar: ClppRadarStatus;
  source: ForecastSourceHealth;
}> {
  try {
    const result = await fetchTextWithHeaders(CLPP_RADAR_URL);
    const title = result.text.match(/<title>(.*?)<\/title>/i)?.[1]?.trim() || "CLPP Radar";
    const frameOptions = result.headers.get("x-frame-options");
    const canEmbed = !frameOptions || frameOptions.toLowerCase() === "allowall";
    const status: ForecastSourceStatus = canEmbed ? "ok" : "blocked_embed";
    const message = canEmbed
      ? "หน้า CLPP radar เปิดได้และไม่พบ header ห้ามฝัง"
      : `หน้า CLPP radar เปิดได้ แต่มี x-frame-options: ${frameOptions}`;

    return {
      clppRadar: {
        url: CLPP_RADAR_URL,
        status,
        title,
        canEmbed,
        message,
        checkedAt: nowIso(),
      },
      source: sourceHealth("clpp-radar", "ONWR CLPP Radar", CLPP_RADAR_URL, status, message),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "เรียกหน้า CLPP radar ไม่สำเร็จ";
    return {
      clppRadar: {
        url: CLPP_RADAR_URL,
        status: "unavailable",
        title: "CLPP Radar",
        canEmbed: false,
        message,
        checkedAt: nowIso(),
      },
      source: sourceHealth("clpp-radar", "ONWR CLPP Radar", CLPP_RADAR_URL, "unavailable", message),
    };
  }
}

export async function getForecastData(): Promise<ForecastPayload> {
  const [hiiRainfall, clppRadar] = await Promise.all([getHiiSixMonthRainfall(), getClppRadarStatus()]);

  return {
    updatedAt: nowIso(),
    hiiRainfall: hiiRainfall.forecast,
    clppRadar: clppRadar.clppRadar,
    sources: [hiiRainfall.source, clppRadar.source],
  };
}
