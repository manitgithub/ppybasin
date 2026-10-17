import seasonalSnapshot from "./data/seasonal-snapshot.json";
import monthlySnapshot from "./data/monthly-snapshot.json";
import tmdSnapshot from "./data/tmd-snapshot.json";
import gridLayout from "./data/tmd-grid-layout.json";
import { parseSeasonalCsv, parseTmdGrid } from "./parse";
import type { DroughtDataset, DroughtPayload, SeasonalData, TmdData } from "./types";

const MAX_AGE = 15 * 60_000;
let cached: { at: number; payload: DroughtPayload } | undefined;
let pending: Promise<DroughtPayload> | undefined;

async function readSource(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

function seasonalStale(data: SeasonalData, now: Date) {
  const issue = data.source.issue;
  const updated = data.source.lastModified || `${issue.slice(0, 4)}-${issue.slice(4)}-01T00:00:00+07:00`;
  return Math.floor((now.getTime() - Date.parse(updated)) / 86400000) > 45;
}

async function loadSeasonal(now: Date): Promise<DroughtDataset<SeasonalData>> {
  const current = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(current.find((part) => part.type === "year")!.value);
  const month = Number(current.find((part) => part.type === "month")!.value);
  const failures: string[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const issue = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    // An older live file must not replace the newer snapshot we already hold.
    if (issue < seasonalSnapshot.source.issue) break;
    try {
      const response = await readSource(`https://live1.hii.or.th/product/latest/forecast/drought/${issue}droughtForecast_6month.csv`);
      const modified = response.headers.get("last-modified");
      const data = parseSeasonalCsv(await response.text(), issue, seasonalSnapshot, modified && Number.isFinite(Date.parse(modified)) ? new Date(modified).toISOString() : null, now);
      return { data, mode: "live", checkedAt: now.toISOString(), stale: seasonalStale(data, now), warnings: offset ? ["ยังอ่านฉบับเดือนปัจจุบันไม่ได้ แสดงฉบับก่อนหน้าที่อ่านได้จาก สสน."] : [] };
    } catch (error) { failures.push(`${issue}: ${error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ"}`); }
  }
  const stale = seasonalStale(seasonalSnapshot, now);
  return { data: { ...seasonalSnapshot, source: { ...seasonalSnapshot.source, mode: "fallback" }, quality: { ...seasonalSnapshot.quality, stale } }, mode: "snapshot", checkedAt: now.toISOString(), stale, warnings: ["ดึงไฟล์ สสน. ไม่สำเร็จ ใช้สำเนาข้อมูลจากเว็บอ้างอิงที่บันทึกเมื่อ 17 ต.ค. 2569", ...failures] };
}

async function loadTmd(now: Date): Promise<DroughtDataset<TmdData>> {
  try {
    // The official server publishes this resource over HTTP; fetched server-side.
    const response = await readSource(tmdSnapshot.source.dataUrl);
    const data = parseTmdGrid(await response.json(), tmdSnapshot, gridLayout);
    return { data, mode: "live", checkedAt: now.toISOString(), stale: now.getTime() >= Date.parse(`${data.forecast.validEnd}T23:59:59+07:00`), warnings: [] };
  } catch (error) {
    return { data: tmdSnapshot, mode: "snapshot", checkedAt: now.toISOString(), stale: now.getTime() >= Date.parse(`${tmdSnapshot.forecast.validEnd}T23:59:59+07:00`), warnings: ["อ่านกริดทางการไม่ได้ ใช้สำเนาผลวิเคราะห์ชุดเดียวกับเว็บอ้างอิงที่บันทึกเมื่อ 17 ต.ค. 2569", error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ"] };
  }
}

export async function getDroughtData(refresh = false): Promise<DroughtPayload> {
  const age = Date.now() - (cached?.at ?? 0);
  if (cached && age < (refresh ? 60_000 : MAX_AGE)) return cached.payload;
  if (pending) return pending;
  pending = (async () => {
    const now = new Date();
    const [seasonal, tmd] = await Promise.all([loadSeasonal(now), loadTmd(now)]);
    const payload: DroughtPayload = {
      checkedAt: now.toISOString(), seasonal, tmd,
      monthly: { data: monthlySnapshot, mode: "snapshot", checkedAt: now.toISOString(), stale: true,
        warnings: ["สำเนาข้อมูลบางอำเภอจากเว็บอ้างอิง รอบสิงหาคม 2569 ยังไม่เชื่อมต่อค่ารายเดือนอัตโนมัติ", ...monthlySnapshot.quality.warnings] },
    };
    cached = { at: Date.now(), payload };
    return payload;
  })();
  try { return await pending; } finally { pending = undefined; }
}
