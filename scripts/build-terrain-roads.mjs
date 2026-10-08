import fs from "node:fs/promises";
import path from "node:path";

const bounds = { west: 99.75, south: 7.55, east: 100.3, north: 8.0 };
const highwayTypes = "trunk|primary|secondary|tertiary|unclassified|residential";
const query = `[out:json][timeout:90];way["highway"~"^(${highwayTypes})$"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});out tags geom;`;
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
      headers: {
        "User-Agent": "ppybasin-terrain-builder/1.0",
      },
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

if (!data) throw new Error(`Unable to download OpenStreetMap roads: HTTP ${lastStatus}`);
const roads = data.elements
  .filter((element) => element.type === "way" && element.tags?.highway && element.geometry?.length > 1)
  .map((element) => ({
    id: element.id,
    type: element.tags.highway,
    name: element.tags.name ?? element.tags.ref ?? null,
    points: element.geometry.map(({ lon, lat }) => [
      Math.round(lon * 1e6) / 1e6,
      Math.round(lat * 1e6) / 1e6,
    ]),
  }));

const output = {
  name: "Pa Phayom road network",
  source: "OpenStreetMap contributors",
  sourceUrl: "https://www.openstreetmap.org/copyright",
  generatedAt: new Date().toISOString(),
  bounds,
  roads,
};

const outputDirectory = path.join(process.cwd(), "public", "terrain");
await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(path.join(outputDirectory, "pa-phayom-roads.json"), JSON.stringify(output));
console.log(`Generated ${roads.length.toLocaleString()} road features from OpenStreetMap`);
