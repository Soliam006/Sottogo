/**
 * Geometria del mapa. Capa pura: sin React, sin MapLibre, sin Supabase.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
/** Ancho del mundo en metros por pixel a zoom 0 en el ecuador (Web Mercator). */
const METERS_PER_PIXEL_Z0 = 156_543.033_92;

export function hasCoords(value: {
  latitude: number | null;
  longitude: number | null;
}): value is { latitude: number; longitude: number } {
  return (
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

/** Distancia en metros entre dos puntos (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Metros que cubre un pixel a un zoom y latitud dados. Permite razonar el
 * agrupamiento en pixeles de pantalla (que es lo que percibe el usuario) y no
 * en metros fijos, que se quedan cortos o largos segun el zoom.
 */
export function metersPerPixel(latitude: number, zoom: number): number {
  return (METERS_PER_PIXEL_Z0 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

/** Centro (media simple) de un conjunto de puntos. Suficiente a escala urbana. */
export function centroid(points: readonly LatLng[]): LatLng {
  if (!points.length) return { latitude: 0, longitude: 0 };
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.latitude;
    lng += p.longitude;
  }
  return { latitude: lat / points.length, longitude: lng / points.length };
}

/**
 * El candidato mas cercano dentro de `maxMeters`, o `null`.
 * Se usa para *sugerir* un lugar del itinerario, nunca para imponerlo.
 */
export function nearest<T extends LatLng>(
  origin: LatLng,
  candidates: readonly T[],
  maxMeters: number,
): { item: T; meters: number } | null {
  let best: { item: T; meters: number } | null = null;
  for (const candidate of candidates) {
    const meters = distanceMeters(origin, candidate);
    if (meters <= maxMeters && (!best || meters < best.meters)) {
      best = { item: candidate, meters };
    }
  }
  return best;
}

/** "320 m" / "1,2 km" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}
