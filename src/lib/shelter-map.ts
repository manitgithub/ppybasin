/** Only registered Pa Phayom shelters belong on the basin maps. */
export function isBasinMapShelter(shelter: { code?: string | null }) {
  return typeof shelter.code === "string" && /^PPY-SH-\d{3}$/.test(shelter.code);
}
