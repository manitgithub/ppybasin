import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const zoom = 10;
const tileSize = 256;
const bounds = {
  west: 99.75,
  south: 7.55,
  east: 100.3,
  north: 8.0,
};
const outputWidth = 128;
const outputHeight = 104;

function worldPixel(lat, lng) {
  const scale = 2 ** zoom * tileSize;
  return {
    x: (lng + 180) / 360 * scale,
    y: (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * scale,
  };
}

const northwest = worldPixel(bounds.north, bounds.west);
const southeast = worldPixel(bounds.south, bounds.east);
const minTileX = Math.floor(northwest.x / tileSize);
const maxTileX = Math.floor(southeast.x / tileSize);
const minTileY = Math.floor(northwest.y / tileSize);
const maxTileY = Math.floor(southeast.y / tileSize);
const mosaicWidth = (maxTileX - minTileX + 1) * tileSize;
const mosaicHeight = (maxTileY - minTileY + 1) * tileSize;

const tiles = [];
for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tileX}/${tileY}.png`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to download ${url}: HTTP ${response.status}`);
    tiles.push({
      input: Buffer.from(await response.arrayBuffer()),
      left: (tileX - minTileX) * tileSize,
      top: (tileY - minTileY) * tileSize,
    });
  }
}

const cropLeft = Math.max(0, Math.round(northwest.x - minTileX * tileSize));
const cropTop = Math.max(0, Math.round(northwest.y - minTileY * tileSize));
const cropRight = Math.min(mosaicWidth, Math.round(southeast.x - minTileX * tileSize));
const cropBottom = Math.min(mosaicHeight, Math.round(southeast.y - minTileY * tileSize));

const mosaic = await sharp({
  create: { width: mosaicWidth, height: mosaicHeight, channels: 3, background: "black" },
})
  .composite(tiles)
  .png()
  .toBuffer();

const { data, info } = await sharp(mosaic)
  .extract({ left: cropLeft, top: cropTop, width: cropRight - cropLeft, height: cropBottom - cropTop })
  .resize(outputWidth, outputHeight, { kernel: sharp.kernel.cubic })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const elevations = [];
let minElevation = Number.POSITIVE_INFINITY;
let maxElevation = Number.NEGATIVE_INFINITY;
for (let index = 0; index < info.width * info.height; index += 1) {
  const offset = index * info.channels;
  const elevation = data[offset] * 256 + data[offset + 1] + data[offset + 2] / 256 - 32768;
  const rounded = Math.round(elevation * 10) / 10;
  elevations.push(rounded);
  minElevation = Math.min(minElevation, rounded);
  maxElevation = Math.max(maxElevation, rounded);
}

const output = {
  name: "Pa Phayom Basin DEM",
  source: "Mapzen Terrain Tiles on AWS Open Data",
  format: "Terrarium",
  sourceUrl: "https://registry.opendata.aws/terrain-tiles/",
  generatedAt: new Date().toISOString(),
  bounds,
  width: info.width,
  height: info.height,
  minElevation,
  maxElevation,
  elevations,
};

const outputDirectory = path.join(process.cwd(), "public", "terrain");
await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(path.join(outputDirectory, "pa-phayom-dem.json"), JSON.stringify(output));
console.log(`Generated ${info.width}x${info.height} DEM (${minElevation}m to ${maxElevation}m)`);
