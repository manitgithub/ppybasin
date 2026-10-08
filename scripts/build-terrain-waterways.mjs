import fs from "node:fs/promises";
import path from "node:path";

const bounds = { west: 99.75, south: 7.55, east: 100.3, north: 8.0 };
const waterwayTypes = "river|canal|stream|drain|ditch";
const query = `[out:json][timeout:90];way["waterway"~"^(${waterwayTypes})$"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});out tags geom;`;
const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

let data;
let lastStatus = "unknown";
for (const endpoint of endpoints) {
  try {
    const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(90000),
      headers: { "User-Agent": "ppybasin-terrain-builder/1.0" },
    });
    lastStatus = String(response.status);
    if (response.ok) {
      data = await response.json();
      break;
    }
  } catch (error) {
    lastStatus = error instanceof Error ? error.message : "network error";
  }
}

if (!data) throw new Error(`Unable to download OpenStreetMap waterways: ${lastStatus}`);

const waterways = data.elements
  .filter((element) => element.type === "way" && element.tags?.waterway && element.geometry?.length > 1)
  .map((element) => ({
    id: element.id,
    type: element.tags.waterway,
    name: element.tags.name ?? null,
    points: element.geometry.map(({ lon, lat }) => [
      Math.round(lon * 1e6) / 1e6,
      Math.round(lat * 1e6) / 1e6,
    ]),
  }));

const output = {
  name: "Pa Phayom waterway network",
  source: "OpenStreetMap contributors",
  sourceUrl: "https://www.openstreetmap.org/copyright",
  generatedAt: new Date().toISOString(),
  bounds,
  waterways,
};

const outputDirectory = path.join(process.cwd(), "public", "terrain");
await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(path.join(outputDirectory, "pa-phayom-waterways.json"), JSON.stringify(output));
console.log(`Generated ${waterways.length.toLocaleString()} waterway features from OpenStreetMap`);
