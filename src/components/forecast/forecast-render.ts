import type { Feature, Polygon, MultiPolygon } from "geojson";
import { forecastColors, tmdSampler, type TmdFrame } from "@/lib/forecast/basin";

export type ForecastBoundary = Feature<Polygon | MultiPolygon>;
const colorStops = [...forecastColors].reverse();
const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
export function polygons(boundary: ForecastBoundary) { return boundary.geometry.type === "Polygon" ? [boundary.geometry.coordinates] : boundary.geometry.coordinates; }
export function bounds(boundary: ForecastBoundary) {
  const coordinates = polygons(boundary).flat(2);
  return { west: Math.min(...coordinates.map(p => p[0])), east: Math.max(...coordinates.map(p => p[0])), south: Math.min(...coordinates.map(p => p[1])), north: Math.max(...coordinates.map(p => p[1])) };
}

/** One fixed palette, sampling grid and basin mask for both the map and snapshots. */
export function renderForecastSurface(frame: TmdFrame, boundary: ForecastBoundary, width = 480): HTMLCanvasElement | null {
  const { west, east, south, north } = bounds(boundary);
  const sample = tmdSampler(frame.points);
  const height = Math.max(1, Math.round(width * (mercator(north) - mercator(south)) / ((east - west) * Math.PI / 180)));
  const raster = document.createElement("canvas"); raster.width = width; raster.height = height;
  const context = raster.getContext("2d"); if (!context) return null;
  const pixels = context.createImageData(width, height);
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const lon = west + (col + .5) / width * (east - west);
    const lat = (2 * Math.atan(Math.exp(mercator(north) - (row + .5) / height * (mercator(north) - mercator(south)))) - Math.PI / 2) * 180 / Math.PI;
    const value = sample(lon, lat);
    const color = value === null ? ((row + col) % 10 < 3 ? "#8298a4" : "#e1e8ec") : colorStops.find(stop => value >= stop.from)!.color;
    const pixel = (row * width + col) * 4;
    pixels.data.set([parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), 220], pixel);
  }
  context.putImageData(pixels, 0, 0);
  const clipped = document.createElement("canvas"); clipped.width = width; clipped.height = height;
  const clippedContext = clipped.getContext("2d"); if (!clippedContext) return null;
  clippedContext.beginPath();
  polygons(boundary).forEach(poly => poly.forEach(ring => {
    ring.forEach(([lon, lat], index) => {
      const x = (lon - west) / (east - west) * width, y = (mercator(north) - mercator(lat)) / (mercator(north) - mercator(south)) * height;
      if (index === 0) clippedContext.moveTo(x, y); else clippedContext.lineTo(x, y);
    }); clippedContext.closePath();
  }));
  clippedContext.clip("evenodd"); clippedContext.drawImage(raster, 0, 0);
  return clipped;

}

export function renderForecastSnapshot(frame: TmdFrame, boundary: ForecastBoundary, timeLabel: string) {
  const surface = renderForecastSurface(frame, boundary);
  if (!surface) return null;
  const width = 800, padding = 24, mapTop = 76, mapWidth = width - padding * 2;
  const mapHeight = Math.round(mapWidth * surface.height / surface.width);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = mapTop + mapHeight + 170;
  const context = canvas.getContext("2d"); if (!context) return null;
  context.fillStyle = "#f8fbfc"; context.fillRect(0, 0, width, canvas.height);
  context.fillStyle = "#193145"; context.font = "bold 24px Tahoma, sans-serif";
  context.fillText(`${timeLabel} น.${frame.missing ? " · ข้อมูลขาด" : ""}`, padding, 32);
  context.fillStyle = "#557183"; context.font = "16px Tahoma, sans-serif";
  context.fillText("TMD NWP · ลุ่มน้ำป่าพะยอม · มม./ช่วงรายชั่วโมง", padding, 58);
  context.fillStyle = "#edf2f4"; context.fillRect(padding, mapTop, mapWidth, mapHeight);
  context.drawImage(surface, padding, mapTop, mapWidth, mapHeight);
  const { west, east, south, north } = bounds(boundary);
  context.beginPath();
  polygons(boundary).forEach(poly => poly.forEach(ring => {
    ring.forEach(([lon, lat], index) => {
      const x = padding + (lon - west) / (east - west) * mapWidth, y = mapTop + (mercator(north) - mercator(lat)) / (mercator(north) - mercator(south)) * mapHeight;
      if (!index) context.moveTo(x, y); else context.lineTo(x, y);
    }); context.closePath();
  }));
  context.strokeStyle = "#31566a"; context.lineWidth = 1.5; context.stroke();
  const metricY = mapTop + mapHeight + 28;
  const number = (value: number | null) => value === null ? "—" : value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
  context.fillStyle = "#193145"; context.font = "bold 17px Tahoma, sans-serif";
  context.fillText(`เฉลี่ย ${number(frame.meanMm)} มม.  ·  สูงสุด ${number(frame.maxMm)} มม.  ·  พื้นที่มีข้อมูล ${number(frame.coverage * 100)}%`, padding, metricY);
  [...forecastColors, { label: "ไม่มีข้อมูล", color: "#e1e8ec" }].forEach((stop, i) => {
    const x = padding + i % 4 * 188, y = metricY + 22 + Math.floor(i / 4) * 28;
    context.fillStyle = stop.color; context.fillRect(x, y, 20, 16);
    context.strokeStyle = "#9cb9c5"; context.lineWidth = 1; context.strokeRect(x, y, 20, 16);
    if (i === forecastColors.length) {
      context.save(); context.beginPath(); context.rect(x, y, 20, 16); context.clip();
      context.strokeStyle = "#8298a4";
      for (let line = -16; line < 20; line += 5) { context.beginPath(); context.moveTo(x + line, y + 16); context.lineTo(x + line + 16, y); context.stroke(); }
      context.restore();
    }
    context.fillStyle = "#405f72"; context.font = "15px Tahoma, sans-serif"; context.fillText(stop.label, x + 28, y + 13);
  });
  context.fillStyle = "#557183"; context.font = "13px Tahoma, sans-serif";
  context.fillText("สเกลสีและขอบเขตเดียวกันทุกภาพ · 457.25 ตร.กม. · ไม่รวมเป็นฝนสะสมหลายชั่วโมง", padding, canvas.height - 30);
  context.fillText("ข้อมูล TMD NWP · ชุดบันทึก Pa Phayom Water Watch · สีแสดงปริมาณฝน ไม่ใช่เกณฑ์เตือนภัย", padding, canvas.height - 10);
  return canvas;
}
