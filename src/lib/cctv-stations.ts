// Locations and public camera names verified from DDPM station endpoints on 2026-10-15.
export const cctvStations = [
  {
    code: "PLG01", name: "ปตร.ท่าแนะ", location: "ต.เขาย่า อ.ศรีบรรพต จ.พัทลุง", waterway: "คลองท่าแนะ",
    lat: 7.729104, lng: 99.91402, cameras: ["PLG01-01", "PLG01-02"],
    sourceUrl: "https://cctv.disaster.go.th/stations/PLG01",
  },
  {
    code: "PLG02", name: "สะพานท่าสำเภา", location: "ต.พนางตุง อ.ควนขนุน จ.พัทลุง", waterway: "คลองปากประ",
    lat: 7.729762, lng: 100.1079, cameras: ["PLG02-01", "PLG02-02"],
    sourceUrl: "https://cctv.disaster.go.th/stations/PLG02",
  },
] as const;

export type CctvStation = typeof cctvStations[number];
export function isPublicCctvCamera(camera: string) {
  return cctvStations.some((station) => station.cameras.some((name) => name === camera));
}
