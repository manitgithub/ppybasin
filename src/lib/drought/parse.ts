import type { SeasonalData, TmdData } from "./types";
import { seasonalAlertLevel } from "./presentation";

// Quoted fields, escaped quotes, CRLF, and the UTF-8 BOM in the official CSV.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || !field) quoted = !quoted;
      else throw new Error("Invalid CSV quote");
    } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      row.push(field); field = "";
      if (c !== ",") {
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else field += c;
  }
  if (quoted) throw new Error("Unterminated CSV field");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function monthLabel(key: string) {
  return new Intl.DateTimeFormat("th-TH", { month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${key}-01T00:00:00+07:00`));
}

export function parseSeasonalCsv(text: string, issue: string, template: SeasonalData, modified: string | null, now = new Date()): SeasonalData {
  const [headers, ...rows] = parseCsv(text);
  const required = ["TAMBON_IDN", "TYPE_E", "YEAR", "MONTH"];
  if (!headers || required.some((key) => !headers.includes(key))) throw new Error("รูปแบบไฟล์ สสน. เปลี่ยนแปลง");
  const at = (row: string[], key: string) => row[headers.indexOf(key)]?.trim();
  const selected = new Set(template.tambons.map((tambon) => tambon.id));
  const values = new Map<string, string>();
  let duplicates = 0;
  const start = Number(issue.slice(0, 4)) * 12 + Number(issue.slice(4)) - 1;
  const months = Array.from({ length: 6 }, (_, i) => {
    const index = start + i;
    const key = `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
    return { key, label: monthLabel(key), shortLabel: monthLabel(key) };
  });
  for (const row of rows) {
    const id = at(row, "TAMBON_IDN");
    if (!id || !selected.has(id)) continue;
    const year = Number(at(row, "YEAR")), month = Number(at(row, "MONTH"));
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("รอบเดือนในข้อมูลไม่ถูกต้อง");
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!months.some((entry) => entry.key === key)) throw new Error("รอบเดือนในไฟล์ไม่ตรงกับฉบับข้อมูล");
    const status = at(row, "TYPE_E");
    if (status !== "norisk" && status !== "drought") throw new Error("พบสถานะความเสี่ยงที่ไม่รู้จัก");
    const cell = `${id}:${key}`;
    if (values.has(cell)) {
      if (values.get(cell) !== status) throw new Error("พบข้อมูลซ้ำที่มีสถานะขัดแย้งกัน");
      duplicates++;
    }
    values.set(cell, status);
  }
  if (values.size !== selected.size * 6) throw new Error("ข้อมูลไม่ครบ 11 ตำบล × 6 เดือน");
  const tambons = template.tambons.map((tambon) => {
    const forecast = months.map((month) => ({ month: month.key, status: values.get(`${tambon.id}:${month.key}`)! }));
    let longest = 0, run = 0;
    for (const cell of forecast) { run = cell.status === "drought" ? run + 1 : 0; longest = Math.max(longest, run); }
    return { ...tambon, forecast, firstDroughtMonth: forecast.find((cell) => cell.status === "drought")?.month ?? null,
      consecutiveDroughtMonths: longest,
      // Forecast alone is not a confirmed disaster warning.
      alertLevel: seasonalAlertLevel(forecast) };
  });
  const issueDate = `${issue.slice(0, 4)}-${issue.slice(4)}-01T00:00:00+07:00`;
  const freshnessDays = Math.max(0, Math.floor((now.getTime() - Date.parse(modified || issueDate)) / 86400000));
  return {
    ...template, generatedAt: now.toISOString(), months, tambons,
    source: { ...template.source, issue, issueLabel: monthLabel(months[0].key), mode: "live", fallbackReason: null,
      fileUrl: `https://live1.hii.or.th/product/latest/forecast/drought/${issue}droughtForecast_6month.csv`, lastModified: modified || issueDate },
    quality: { ...template.quality, status: "valid", records: values.size, tambons: tambons.length, months: 6,
      exactDuplicatesRemoved: duplicates, conflictingDuplicates: 0, freshnessDays, stale: freshnessDays > 45, warnings: [] },
    summary: { ...template.summary, atRiskAnyMonth: tambons.filter((t) => t.forecast.some((c) => c.status === "drought")).length,
      atRiskNext3Months: tambons.filter((t) => t.forecast.slice(0, 3).some((c) => c.status === "drought")).length,
      alertCounts: { green: tambons.filter((t) => t.alertLevel === "green").length, yellow: tambons.filter((t) => t.alertLevel === "yellow").length, orange: tambons.filter((t) => t.alertLevel === "orange").length, red: 0 },
      monthlyCounts: months.map((month) => ({ month: month.key, drought: tambons.filter((t) => values.get(`${t.id}:${month.key}`) === "drought").length,
        norisk: tambons.filter((t) => values.get(`${t.id}:${month.key}`) === "norisk").length })) },
  };
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
const coordinateKey = (lat: number, lon: number) => `${lat.toFixed(6)},${lon.toFixed(6)}`;

export function tmdCategory(value: number): "normal" | "watch" | "drought" | "severe" {
  return value >= -0.5 ? "normal" : value >= -1 ? "watch" : value >= -1.5 ? "drought" : "severe";
}

export function parseTmdGrid(raw: unknown, template: TmdData, layout: number[][]): TmdData {
  if (!record(raw) || !record(raw.meta) || !Array.isArray(raw.grid_data)) throw new Error("รูปแบบกริด กรมอุตุนิยมวิทยา เปลี่ยนแปลง");
  const meta = raw.meta;
  for (const key of ["updated_at", "analysis_start", "analysis_end"]) {
    if (typeof meta[key] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(meta[key]) || !Number.isFinite(Date.parse(meta[key]))) throw new Error("ไม่พบรอบคาดการณ์ของกริด");
  }
  const start = meta.analysis_start as string, end = meta.analysis_end as string;
  if (Date.parse(end) < Date.parse(start) || Date.parse(end) - Date.parse(start) > 10 * 86400000) throw new Error("ช่วงคาดการณ์ของกริดเปลี่ยนแปลง");
  const expected = new Set(layout.map(([lat, lon]) => coordinateKey(lat, lon)));
  const grid = new Map<string, number | null>();
  for (const cell of raw.grid_data) {
    if (!record(cell) || !finite(cell.lat) || !finite(cell.lon)) throw new Error("พิกัดกริดไม่ถูกต้อง");
    if (cell.lat <= 7.6 || cell.lat >= 8 || cell.lon <= 99.6 || cell.lon >= 100.3) continue;
    const key = coordinateKey(cell.lat, cell.lon);
    if (!expected.has(key) || grid.has(key)) throw new Error("ตำแหน่งกริดเปลี่ยน ต้องทบทวนพื้นที่ถ่วงน้ำหนัก");
    if (cell.spei !== null && (!finite(cell.spei) || Math.abs(cell.spei) > 20)) throw new Error("ค่า SPEI ของกริดไม่ถูกต้อง");
    grid.set(key, finite(cell.spei) ? cell.spei : null);
  }
  if (grid.size !== expected.size) throw new Error("กริดไม่ครบ ต้องทบทวนพื้นที่ถ่วงน้ำหนัก");
  const cells = template.cells.flatMap((cell) => {
    const spei = grid.get(coordinateKey(cell.lat, cell.lon));
    return spei === null || spei === undefined ? [] : [{ ...cell, spei }];
  });
  if (!cells.length) throw new Error("ไม่มีค่า SPEI ในพื้นที่ติดตาม");
  const area = cells.reduce((sum, cell) => sum + cell.overlapKm2, 0);
  // Preserve the reference's reviewed intersection areas and coverage denominator.
  // These are NOT derived from the flood map's different boundary file.
  const totalArea = template.scope.representedAreaKm2 / (template.scope.coveragePercent / 100);
  const round = (value: number) => Math.round(value * 100) / 100;
  const categoriesPercent = { normal: 0, watch: 0, drought: 0, severe: 0 };
  for (const cell of cells) categoriesPercent[tmdCategory(cell.spei)] += cell.overlapKm2 / totalArea * 100;
  for (const key of Object.keys(categoriesPercent) as (keyof typeof categoriesPercent)[]) categoriesPercent[key] = round(categoriesPercent[key]);
  const noDataPercent = round(100 - area / totalArea * 100);
  return {
    ...template, source: { ...template.source, sourceUpdatedAt: meta.updated_at as string },
    forecast: { ...template.forecast, validStart: start, validEnd: end, validLabel: `${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(`${start}T00:00:00+07:00`))} – ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(`${end}T00:00:00+07:00`))}` },
    cells, scope: { ...template.scope, intersectingCells: cells.length, representedAreaKm2: round(area), coveragePercent: round(area / totalArea * 100), noDataPercent },
    quality: { ...template.quality, warnings: [`พื้นที่ไม่มีข้อมูล ${noDataPercent.toFixed(2)}% ไม่ประมาณค่าเติม`, "ใช้พื้นที่ถ่วงน้ำหนักจากชุดวิเคราะห์ที่ตรวจสอบไว้ในเว็บอ้างอิง", template.forecast.limitation] },
    summary: { areaWeightedMean: round(cells.reduce((sum, cell) => sum + cell.spei * cell.overlapKm2, 0) / area), minimum: Math.min(...cells.map((cell) => cell.spei)), maximum: Math.max(...cells.map((cell) => cell.spei)), categoriesPercent },
  };
}
