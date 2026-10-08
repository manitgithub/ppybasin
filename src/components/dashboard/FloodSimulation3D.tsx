"use client";

import { CloudRain, Pause, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

type TerrainData = {
  name: string;
  source: string;
  sourceUrl: string;
  generatedAt: string;
  bounds: { west: number; south: number; east: number; north: number };
  width: number;
  height: number;
  minElevation: number;
  maxElevation: number;
  elevations: number[];
};

type RoadData = {
  roads: Array<{
    id: number;
    type: string;
    name: string | null;
    points: Array<[number, number]>;
  }>;
};

type WaterwayData = {
  waterways: Array<{
    id: number;
    type: string;
    name: string | null;
    points: Array<[number, number]>;
  }>;
};

type SoilMode = "dry" | "normal" | "saturated";

type SimulationResult = {
  depths: Float32Array;
  floodedAreaKm2: number;
  maxDepthM: number;
  affectedPercent: number;
  stageM: number;
};

const soilConfig: Record<SoilMode, { label: string; runoff: number }> = {
  dry: { label: "ดินแห้ง", runoff: 0.45 },
  normal: { label: "ความชื้นปกติ", runoff: 0.65 },
  saturated: { label: "ดินอิ่มน้ำ", runoff: 0.9 },
};

const terrainHeightScale = 0.0068;

function basinMask(x: number, y: number, width: number, height: number) {
  const normalizedX = x / Math.max(width - 1, 1);
  const normalizedY = y / Math.max(height - 1, 1);
  const dx = (normalizedX - 0.48) / 0.56;
  const dy = (normalizedY - 0.5) / 0.58;
  return dx * dx + dy * dy <= 1;
}

function simulateFlood(terrain: TerrainData | null, rainfallMm: number, soilMode: SoilMode): SimulationResult {
  if (!terrain) {
    return { depths: new Float32Array(), floodedAreaKm2: 0, maxDepthM: 0, affectedPercent: 0, stageM: 0 };
  }

  const stageM = Math.max(0, rainfallMm - 40) * 0.012 * soilConfig[soilMode].runoff;
  const depths = new Float32Array(terrain.elevations.length);
  let floodedCells = 0;
  let basinCells = 0;
  let maxDepthM = 0;

  for (let y = 0; y < terrain.height; y += 1) {
    for (let x = 0; x < terrain.width; x += 1) {
      const index = y * terrain.width + x;
      const elevation = terrain.elevations[index];
      if (!basinMask(x, y, terrain.width, terrain.height) || elevation < -1) {
        depths[index] = elevation < -1 ? 0.18 : 0;
        continue;
      }

      basinCells += 1;
      const drainagePenalty = Math.max(0, elevation) * 0.34;
      const depth = Math.max(0, Math.min(4.5, stageM - drainagePenalty));
      depths[index] = depth;
      if (depth >= 0.1) {
        floodedCells += 1;
        maxDepthM = Math.max(maxDepthM, depth);
      }
    }
  }

  const centerLatitude = (terrain.bounds.north + terrain.bounds.south) / 2;
  const widthKm = (terrain.bounds.east - terrain.bounds.west) * 111.32 * Math.cos(centerLatitude * Math.PI / 180);
  const heightKm = (terrain.bounds.north - terrain.bounds.south) * 110.57;
  const cellAreaKm2 = widthKm * heightKm / (terrain.width * terrain.height);

  return {
    depths,
    floodedAreaKm2: floodedCells * cellAreaKm2,
    maxDepthM,
    affectedPercent: basinCells ? floodedCells / basinCells * 100 : 0,
    stageM,
  };
}

function terrainColor(elevation: number) {
  if (elevation <= 0) return new THREE.Color("#77b7c7");
  if (elevation < 15) return new THREE.Color("#87a96f").lerp(new THREE.Color("#537d58"), elevation / 15);
  if (elevation < 120) return new THREE.Color("#537d58").lerp(new THREE.Color("#9a875e"), (elevation - 15) / 105);
  if (elevation < 450) return new THREE.Color("#9a875e").lerp(new THREE.Color("#665b50"), (elevation - 120) / 330);
  return new THREE.Color("#665b50").lerp(new THREE.Color("#d7d5cf"), Math.min(1, (elevation - 450) / 450));
}

function smoothTerrainElevations(terrain: TerrainData, passes = 3) {
  let source = Float32Array.from(terrain.elevations);
  for (let pass = 0; pass < passes; pass += 1) {
    const target = new Float32Array(source.length);
    for (let y = 0; y < terrain.height; y += 1) {
      for (let x = 0; x < terrain.width; x += 1) {
        let weightedElevation = 0;
        let totalWeight = 0;
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = THREE.MathUtils.clamp(x + offsetX, 0, terrain.width - 1);
            const sampleY = THREE.MathUtils.clamp(y + offsetY, 0, terrain.height - 1);
            const weight = offsetX === 0 && offsetY === 0 ? 4 : offsetX === 0 || offsetY === 0 ? 2 : 1;
            weightedElevation += source[sampleY * terrain.width + sampleX] * weight;
            totalWeight += weight;
          }
        }
        target[y * terrain.width + x] = weightedElevation / totalWeight;
      }
    }
    source = target;
  }
  return source;
}

function buildTerrainGeometry(terrain: TerrainData, visualElevations: Float32Array, depths: Float32Array) {
  const width = 22;
  const depth = width * (terrain.height / terrain.width);
  const positions = new Float32Array(terrain.width * terrain.height * 3);
  const waterPositions = new Float32Array(terrain.width * terrain.height * 3);
  const colors = new Float32Array(terrain.width * terrain.height * 3);
  const floodDepths = new Float32Array(terrain.width * terrain.height);
  const indices: number[] = [];

  for (let y = 0; y < terrain.height; y += 1) {
    for (let x = 0; x < terrain.width; x += 1) {
      const index = y * terrain.width + x;
      const offset = index * 3;
      const elevation = visualElevations[index];
      const visualElevation = Math.max(-8, Math.min(900, elevation)) * terrainHeightScale;
      const px = x / (terrain.width - 1) * width - width / 2;
      const pz = y / (terrain.height - 1) * depth - depth / 2;
      positions.set([px, visualElevation, pz], offset);
      waterPositions.set([px, visualElevation + 0.055, pz], offset);
      const color = terrainColor(elevation);
      colors.set([color.r, color.g, color.b], offset);
      floodDepths[index] = depths[index] ?? 0;

      if (x < terrain.width - 1 && y < terrain.height - 1) {
        const right = index + 1;
        const below = index + terrain.width;
        const belowRight = below + 1;
        indices.push(index, below, right, right, below, belowRight);
      }
    }
  }

  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  terrainGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  terrainGeometry.setIndex(indices);
  terrainGeometry.computeVertexNormals();

  const waterGeometry = new THREE.BufferGeometry();
  waterGeometry.setAttribute("position", new THREE.BufferAttribute(waterPositions, 3));
  waterGeometry.setAttribute("floodDepth", new THREE.BufferAttribute(floodDepths, 1));
  waterGeometry.setIndex(indices);

  return { terrainGeometry, waterGeometry, width, depth };
}

function sampleTerrainElevation(terrain: TerrainData, elevations: Float32Array, longitude: number, latitude: number) {
  const x = THREE.MathUtils.clamp((longitude - terrain.bounds.west) / (terrain.bounds.east - terrain.bounds.west) * (terrain.width - 1), 0, terrain.width - 1);
  const y = THREE.MathUtils.clamp((terrain.bounds.north - latitude) / (terrain.bounds.north - terrain.bounds.south) * (terrain.height - 1), 0, terrain.height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(terrain.width - 1, x0 + 1);
  const y1 = Math.min(terrain.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const top = THREE.MathUtils.lerp(elevations[y0 * terrain.width + x0], elevations[y0 * terrain.width + x1], tx);
  const bottom = THREE.MathUtils.lerp(elevations[y1 * terrain.width + x0], elevations[y1 * terrain.width + x1], tx);
  return THREE.MathUtils.lerp(top, bottom, ty);
}

function isInsideTerrain(terrain: TerrainData, [longitude, latitude]: [number, number]) {
  return longitude >= terrain.bounds.west && longitude <= terrain.bounds.east && latitude >= terrain.bounds.south && latitude <= terrain.bounds.north;
}

function clampToTerrain(terrain: TerrainData, [longitude, latitude]: [number, number]): [number, number] {
  return [
    THREE.MathUtils.clamp(longitude, terrain.bounds.west, terrain.bounds.east),
    THREE.MathUtils.clamp(latitude, terrain.bounds.south, terrain.bounds.north),
  ];
}

function buildRoadPositions(terrain: TerrainData, elevations: Float32Array, roads: RoadData["roads"], width: number, depth: number, main: boolean) {
  const positions: number[] = [];
  const mainTypes = new Set(["trunk", "primary", "secondary"]);
  for (const road of roads) {
    if (mainTypes.has(road.type) !== main) continue;
    for (let index = 1; index < road.points.length; index += 1) {
      const segment: Array<[number, number]> = [road.points[index - 1], road.points[index]];
      if (!segment.some((point) => isInsideTerrain(terrain, point))) continue;
      for (const point of segment) {
        const [longitude, latitude] = clampToTerrain(terrain, point);
        const x = (longitude - terrain.bounds.west) / (terrain.bounds.east - terrain.bounds.west) * width - width / 2;
        const z = (terrain.bounds.north - latitude) / (terrain.bounds.north - terrain.bounds.south) * depth - depth / 2;
        const elevation = sampleTerrainElevation(terrain, elevations, longitude, latitude);
        positions.push(x, Math.max(-8, Math.min(900, elevation)) * terrainHeightScale + 0.105, z);
      }
    }
  }
  return positions;
}

function buildWaterwayPositions(terrain: TerrainData, elevations: Float32Array, waterways: WaterwayData["waterways"], width: number, depth: number, main: boolean) {
  const positions: number[] = [];
  const mainTypes = new Set(["river", "canal"]);
  for (const waterway of waterways) {
    if (mainTypes.has(waterway.type) !== main) continue;
    for (let index = 1; index < waterway.points.length; index += 1) {
      const segment: Array<[number, number]> = [waterway.points[index - 1], waterway.points[index]];
      if (!segment.some((point) => isInsideTerrain(terrain, point))) continue;
      for (const point of segment) {
        const [longitude, latitude] = clampToTerrain(terrain, point);
        const x = (longitude - terrain.bounds.west) / (terrain.bounds.east - terrain.bounds.west) * width - width / 2;
        const z = (terrain.bounds.north - latitude) / (terrain.bounds.north - terrain.bounds.south) * depth - depth / 2;
        const elevation = sampleTerrainElevation(terrain, elevations, longitude, latitude);
        positions.push(x, Math.max(-8, Math.min(900, elevation)) * terrainHeightScale + 0.085, z);
      }
    }
  }
  return positions;
}

export default function FloodSimulation3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waterGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const rainMaterialRef = useRef<THREE.PointsMaterial | null>(null);
  const rainfallRef = useRef(140);
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const [roads, setRoads] = useState<RoadData | null>(null);
  const [waterways, setWaterways] = useState<WaterwayData | null>(null);
  const [rainfallMm, setRainfallMm] = useState(140);
  const [soilMode, setSoilMode] = useState<SoilMode>("normal");
  const [playing, setPlaying] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const simulation = useMemo(() => simulateFlood(terrain, rainfallMm, soilMode), [rainfallMm, soilMode, terrain]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/terrain/pa-phayom-dem.json", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<TerrainData>;
      }),
      fetch("/terrain/pa-phayom-roads.json", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<RoadData>;
      }).catch(() => ({ roads: [] })),
      fetch("/terrain/pa-phayom-waterways.json", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<WaterwayData>;
      }).catch(() => ({ waterways: [] })),
    ]).then(([terrainData, roadData, waterwayData]) => {
      setTerrain(terrainData);
      setRoads(roadData);
      setWaterways(waterwayData);
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      if (now - previous > 45) {
        previous = now;
        setRainfallMm((value) => {
          if (value >= 400) {
            setPlaying(false);
            return 400;
          }
          return Math.min(400, value + 2);
        });
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !terrain) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch {
      queueMicrotask(() => setWebglError(true));
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#dce8e8", 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#dce8e8", 24, 48);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(17, 13, 18);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 10;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 1.2, 0);
    controls.update();

    scene.add(new THREE.HemisphereLight("#f5fbff", "#485546", 2.1));
    const sun = new THREE.DirectionalLight("#fff6dc", 3.4);
    sun.position.set(-12, 22, 8);
    scene.add(sun);

    const visualElevations = smoothTerrainElevations(terrain);
    const { terrainGeometry, waterGeometry, width, depth } = buildTerrainGeometry(terrain, visualElevations, new Float32Array(terrain.elevations.length));
    waterGeometryRef.current = waterGeometry;
    const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02, flatShading: false });
    const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    scene.add(terrainMesh);

    const roadObjects: LineSegments2[] = [];
    const roadGeometries: LineSegmentsGeometry[] = [];
    const roadMaterials: LineMaterial[] = [];
    if (roads) {
      const addRoadLayer = (main: boolean, color: string, lineWidth: number, renderOrder: number) => {
        const positions = buildRoadPositions(terrain, visualElevations, roads.roads, width, depth, main);
        if (positions.length === 0) return;
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions(positions);
        const material = new LineMaterial({ color, linewidth: lineWidth, worldUnits: true, transparent: true, opacity: main ? 0.98 : 0.82, depthWrite: false });
        const line = new LineSegments2(geometry, material);
        line.renderOrder = renderOrder;
        scene.add(line);
        roadObjects.push(line);
        roadGeometries.push(geometry);
        roadMaterials.push(material);
      };
      addRoadLayer(false, "#f3f0df", 0.028, 3);
      addRoadLayer(true, "#413d36", 0.105, 4);
      addRoadLayer(true, "#ffd45d", 0.055, 5);
    }

    const waterwayObjects: LineSegments2[] = [];
    const waterwayGeometries: LineSegmentsGeometry[] = [];
    const waterwayMaterials: LineMaterial[] = [];
    if (waterways) {
      const addWaterwayLayer = (main: boolean, color: string, lineWidth: number) => {
        const positions = buildWaterwayPositions(terrain, visualElevations, waterways.waterways, width, depth, main);
        if (positions.length === 0) return;
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions(positions);
        const material = new LineMaterial({ color, linewidth: lineWidth, worldUnits: true, transparent: true, opacity: main ? 0.96 : 0.8, depthWrite: false });
        const line = new LineSegments2(geometry, material);
        line.renderOrder = 3;
        scene.add(line);
        waterwayObjects.push(line);
        waterwayGeometries.push(geometry);
        waterwayMaterials.push(material);
      };
      addWaterwayLayer(false, "#52c7e8", 0.026);
      addWaterwayLayer(true, "#087ea4", 0.075);
    }

    const waterMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        attribute float floodDepth;
        varying float vFloodDepth;
        varying vec3 vWorldPosition;
        void main() {
          vFloodDepth = floodDepth;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying float vFloodDepth;
        varying vec3 vWorldPosition;
        void main() {
          if (vFloodDepth < 0.04) discard;
          float intensity = clamp(vFloodDepth / 3.2, 0.0, 1.0);
          float ripple = sin(vWorldPosition.x * 8.0 + vWorldPosition.z * 5.0) * 0.035;
          vec3 shallow = vec3(0.12, 0.64, 0.78);
          vec3 deep = vec3(0.03, 0.24, 0.52);
          vec3 color = mix(shallow, deep, intensity) + ripple;
          gl_FragColor = vec4(color, 0.58 + intensity * 0.26);
        }
      `,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.renderOrder = 2;
    scene.add(waterMesh);

    const rainCount = 900;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let index = 0; index < rainCount; index += 1) {
      rainPositions[index * 3] = (Math.random() - 0.5) * width;
      rainPositions[index * 3 + 1] = Math.random() * 10 + 3;
      rainPositions[index * 3 + 2] = (Math.random() - 0.5) * depth;
    }
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
    const rainMaterial = new THREE.PointsMaterial({ color: "#9bdcff", size: 0.035, transparent: true, opacity: Math.min(0.72, rainfallRef.current / 500), depthWrite: false });
    rainMaterialRef.current = rainMaterial;
    const rain = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rain);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.05 });
    visibilityObserver.observe(canvas);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    let animationFrame = 0;
    const render = () => {
      animationFrame = window.requestAnimationFrame(render);
      if (!visible) return;
      controls.update();
      if (!reducedMotion && rainfallRef.current > 20) {
        const attribute = rainGeometry.getAttribute("position") as THREE.BufferAttribute;
        for (let index = 0; index < rainCount; index += 1) {
          const nextY = attribute.getY(index) - (0.045 + rainfallRef.current / 6000);
          attribute.setY(index, nextY < 0.4 ? 11 : nextY);
        }
        attribute.needsUpdate = true;
      }
      renderer.render(scene, camera);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      controls.dispose();
      terrainGeometry.dispose();
      waterGeometry.dispose();
      rainGeometry.dispose();
      terrainMaterial.dispose();
      waterMaterial.dispose();
      rainMaterial.dispose();
      for (const road of roadObjects) scene.remove(road);
      for (const geometry of roadGeometries) geometry.dispose();
      for (const material of roadMaterials) material.dispose();
      for (const waterway of waterwayObjects) scene.remove(waterway);
      for (const geometry of waterwayGeometries) geometry.dispose();
      for (const material of waterwayMaterials) material.dispose();
      renderer.dispose();
      waterGeometryRef.current = null;
      rainMaterialRef.current = null;
    };
  }, [roads, terrain, waterways]);

  useEffect(() => {
    rainfallRef.current = rainfallMm;
    const geometry = waterGeometryRef.current;
    if (!geometry || simulation.depths.length === 0) return;
    const attribute = geometry.getAttribute("floodDepth") as THREE.BufferAttribute;
    attribute.copyArray(simulation.depths);
    attribute.needsUpdate = true;
    if (rainMaterialRef.current) rainMaterialRef.current.opacity = Math.min(0.72, rainfallMm / 500);
  }, [rainfallMm, simulation.depths]);

  const risk = rainfallMm < 80 ? "ต่ำ" : rainfallMm < 160 ? "เฝ้าระวัง" : rainfallMm < 260 ? "สูง" : "วิกฤต";
  const riskClass = rainfallMm < 80 ? "text-emerald-700" : rainfallMm < 160 ? "text-sky-700" : rainfallMm < 260 ? "text-amber-800" : "text-rose-700";

  return (
    <section className="relative min-h-[680px] overflow-hidden bg-[#dce8e8] text-[#102c32] xl:min-h-[720px]">
      <canvas ref={canvasRef} aria-label="แบบจำลองภูมิประเทศสามมิติและพื้นที่น้ำท่วมลุ่มน้ำป่าพะยอม" className="absolute inset-0 h-full w-full touch-none" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(220,232,232,.97)_0%,rgba(220,232,232,.78)_24%,transparent_47%),linear-gradient(0deg,rgba(220,232,232,.96)_0%,transparent_31%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between md:p-7">
        <div className="max-w-xl">
          <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-[#176f7a]"><CloudRain size={16} /> FLOOD SCENARIO LAB · 3D</div>
          <h3 className="text-2xl font-extrabold text-[#15343a] md:text-3xl">ลุ่มน้ำป่าพะยอม</h3>
          <p className="mt-2 max-w-lg text-sm font-semibold leading-relaxed text-[#46656b]">ลากค่าฝนสะสมเพื่อดูการขยายตัวของน้ำในพื้นที่ต่ำ หมุนและซูมภูมิประเทศเพื่อสำรวจแนวเขา พื้นที่ราบ และทางออกสู่ทะเลสาบ</p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 self-start rounded-[7px] bg-[#163b40] px-3 py-2 text-[11px] font-extrabold text-[#eef9f7] shadow-lg">
          <span className="size-2 rounded-full bg-emerald-400" /> DEM + ถนน + ทางน้ำ OSM · จำลองเบื้องต้น
        </div>
      </div>

      <div className="absolute bottom-[188px] left-5 z-10 grid gap-2 md:bottom-7 md:left-7 md:w-[190px]">
        <div className="bg-[#edf5f3]/94 px-3 py-2 shadow-sm backdrop-blur-sm"><p className="text-[10px] font-extrabold text-[#668086]">พื้นที่ท่วมโดยประมาณ</p><p className="text-xl font-extrabold text-[#15343a]">{simulation.floodedAreaKm2.toLocaleString("th-TH", { maximumFractionDigits: 1 })} ตร.กม.</p></div>
        <div className="grid grid-cols-2 gap-2"><div className="bg-[#edf5f3]/94 px-3 py-2 shadow-sm backdrop-blur-sm"><p className="text-[10px] font-extrabold text-[#668086]">ลึกสูงสุด</p><p className="text-base font-extrabold text-[#15343a]">{simulation.maxDepthM.toFixed(1)} ม.</p></div><div className="bg-[#edf5f3]/94 px-3 py-2 shadow-sm backdrop-blur-sm"><p className="text-[10px] font-extrabold text-[#668086]">ความเสี่ยง</p><p className={`text-base font-extrabold ${riskClass}`}>{risk}</p></div></div>
      </div>

      <div className="pointer-events-none absolute left-5 top-[202px] z-10 hidden items-center gap-3 bg-[#edf5f3]/90 px-3 py-2 text-[10px] font-extrabold text-[#557278] backdrop-blur-sm md:flex md:left-7 md:top-[154px]">
        <span className="flex items-center gap-1.5"><span className="h-1 w-7 bg-[#ffd45d] shadow-[0_0_0_1px_#413d36]" /> ถนนสายหลัก</span>
        <span className="flex items-center gap-1.5"><span className="h-px w-7 bg-[#f3f0df] shadow-[0_0_0_1px_#718080]" /> ถนนชุมชน</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-7 bg-[#087ea4]" /> แม่น้ำ/คลอง</span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-[#9fb9b8]/60 bg-[#edf5f3]/96 p-4 backdrop-blur-md md:left-auto md:bottom-7 md:right-7 md:w-[390px] md:border md:p-5 md:shadow-xl">
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold text-[#557278]">ฝนสะสมจำลอง 24 ชั่วโมง</p><p className="mt-1 text-3xl font-extrabold text-[#133b43]">{rainfallMm} <span className="text-base">มม.</span></p></div><div className="flex gap-2"><button title={playing ? "หยุดจำลอง" : "เล่นสถานการณ์ฝน"} onClick={() => setPlaying((value) => !value)} className="grid size-10 place-items-center rounded-[7px] bg-[#176f7a] text-white transition hover:bg-[#105d66]">{playing ? <Pause size={17} /> : <Play size={17} />}</button><button title="เริ่มใหม่" onClick={() => { setPlaying(false); setRainfallMm(0); }} className="grid size-10 place-items-center rounded-[7px] border border-[#b8cecc] bg-white text-[#41646a] transition hover:bg-[#f7fbfa]"><RotateCcw size={17} /></button></div></div>
        <input aria-label="ปริมาณฝนสะสมจำลอง" type="range" min={0} max={400} step={5} value={rainfallMm} onChange={(event) => { setPlaying(false); setRainfallMm(Number(event.target.value)); }} className="h-2 w-full cursor-pointer accent-[#137b87]" />
        <div className="mt-2 flex justify-between text-[10px] font-bold text-[#789095]"><span>0</span><span>100</span><span>200</span><span>300</span><span>400 มม.</span></div>
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-[7px] bg-[#dce9e7] p-1">
          {(Object.keys(soilConfig) as SoilMode[]).map((mode) => <button key={mode} onClick={() => setSoilMode(mode)} className={`h-9 rounded-[6px] text-[11px] font-extrabold transition ${soilMode === mode ? "bg-white text-[#155c66] shadow-sm" : "text-[#637d82] hover:text-[#244f57]"}`}>{soilConfig[mode].label}</button>)}
        </div>
        <p className="mt-3 flex items-start gap-2 text-[10px] font-semibold leading-relaxed text-[#6b8185]"><TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-700" /><span>แบบจำลองเชิงสถานการณ์จาก DEM และสมมติฐาน runoff ไม่ใช่ผลคำนวณทางชลศาสตร์ที่ผ่านการรับรอง<br />ถนนและทางน้ำ © OpenStreetMap contributors</span></p>
      </div>

      {(!terrain || webglError) && <div className="absolute inset-0 z-30 grid place-items-center bg-[#dce8e8] text-sm font-extrabold text-[#557278]">{webglError ? "อุปกรณ์นี้ไม่รองรับ WebGL แสดงผลสรุปตัวเลขแทน" : "กำลังสร้างภูมิประเทศสามมิติ..."}</div>}
    </section>
  );
}
