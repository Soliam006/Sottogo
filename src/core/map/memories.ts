/**
 * Recuerdos geolocalizados y su agrupamiento en el mapa.
 *
 * Jerarquia del mapa:
 *
 *   Nivel 1 (global)     TripPlace  -> Shinjuku, Kyoto, Akihabara...
 *   Nivel 2 (recuerdos)  MemoryPoint -> las coordenadas EXACTAS de cada foto
 *                                       y cada momento de ese lugar.
 *
 * Un `MemoryPoint` NO depende de que exista un `Place`: le basta con tener
 * latitude y longitude propias.
 *
 * Capa pura: sin React, sin MapLibre.
 */

import type { Moment, Photo, TripPlace, UUID } from "@/core/models";
import { centroid, distanceMeters, hasCoords, metersPerPixel, type LatLng } from "./geo";

export interface MemoryPoint extends LatLng {
  id: string;
  kind: "photo" | "moment";
  /** Nombre del sitio exacto, si se guardo. */
  locationName: string | null;
  tripPlaceId: UUID | null;
  date: string;
  photo: Photo | null;
  moment: Moment | null;
}

/** Varios recuerdos que caen tan cerca que se dibujan como un solo marcador. */
export interface MemoryCluster extends LatLng {
  id: string;
  points: MemoryPoint[];
  /** Miniatura representativa: la primera foto del grupo. */
  thumbUrl: string | null;
  label: string;
  photoCount: number;
  momentCount: number;
}

/** Totales de contenido de un lugar del itinerario, para el mapa global. */
export interface PlaceContentCounts {
  photos: number;
  moments: number;
  expenses: number;
}

export function photoToMemory(photo: Photo): MemoryPoint | null {
  if (!hasCoords(photo)) return null;
  return {
    id: `photo:${photo.id}`,
    kind: "photo",
    latitude: photo.latitude,
    longitude: photo.longitude,
    locationName: photo.locationName,
    tripPlaceId: photo.tripPlaceId,
    date: photo.takenAt ?? photo.createdAt,
    photo,
    moment: null,
  };
}

export function momentToMemory(moment: Moment): MemoryPoint | null {
  if (!hasCoords(moment)) return null;
  return {
    id: `moment:${moment.id}`,
    kind: "moment",
    latitude: moment.latitude,
    longitude: moment.longitude,
    locationName: moment.locationName,
    tripPlaceId: moment.tripPlaceId,
    date: moment.date,
    photo: moment.photos?.[0] ?? null,
    moment,
  };
}

/** Todo el contenido de un lugar del itinerario, ubicado o no. */
export interface PlaceContent {
  photos: Photo[];
  moments: Moment[];
  /** Los que tienen coordenadas propias: los unicos dibujables en el mapa. */
  located: MemoryPoint[];
  /** Asociados al lugar pero sin ubicacion exacta. */
  unlocated: number;
}

/**
 * Contenido de un lugar del itinerario.
 *
 * Un recuerdo pertenece al lugar si esta asociado a el (`tripPlaceId`) o si,
 * sin estarlo, cae fisicamente dentro de su radio: asi las fotos tomadas con
 * "mi ubicacion actual" y nunca asociadas a mano siguen apareciendo donde
 * ocurrieron.
 *
 * Se calcula una sola vez y sirve para las dos cosas: el recuento del mapa
 * global ("📸 12") y los puntos del mapa de recuerdos. Asi el numero que ves
 * fuera y lo que encuentras dentro no pueden discrepar.
 */
export function collectForPlace(
  tripPlace: TripPlace,
  photos: readonly Photo[],
  moments: readonly Moment[],
  radiusMeters = 1_500,
): PlaceContent {
  const center = { latitude: tripPlace.place.latitude, longitude: tripPlace.place.longitude };

  const belongs = (item: { tripPlaceId: UUID | null; latitude: number | null; longitude: number | null }) => {
    if (item.tripPlaceId === tripPlace.id) return true;
    if (item.tripPlaceId !== null) return false;
    return hasCoords(item) && distanceMeters(center, item) <= radiusMeters;
  };

  const ownPhotos = photos.filter(belongs);
  const ownMoments = moments.filter(belongs);

  const located = [
    ...ownPhotos.map(photoToMemory),
    ...ownMoments.map(momentToMemory),
  ]
    .filter((point): point is MemoryPoint => point !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    photos: ownPhotos,
    moments: ownMoments,
    located,
    unlocated: ownPhotos.length + ownMoments.length - located.length,
  };
}

/** Recuerdos geolocalizados de todo el viaje (para el encuadre inicial). */
export function allMemories(
  photos: readonly Photo[],
  moments: readonly Moment[],
): MemoryPoint[] {
  return [...photos.map(photoToMemory), ...moments.map(momentToMemory)].filter(
    (point): point is MemoryPoint => point !== null,
  );
}

/**
 * Agrupa recuerdos que quedarian solapados en pantalla.
 *
 * El umbral se expresa en PIXELES y se traduce a metros con el zoom actual: al
 * acercarse, los grupos se abren solos sin tocar ningun parametro.
 */
export function clusterMemories(
  points: readonly MemoryPoint[],
  zoom: number,
  pixelRadius = 44,
): MemoryCluster[] {
  if (!points.length) return [];

  const meters = metersPerPixel(points[0].latitude, zoom) * pixelRadius;
  const pending = [...points];
  const clusters: MemoryCluster[] = [];

  while (pending.length) {
    const seed = pending.shift() as MemoryPoint;
    const group = [seed];

    for (let i = pending.length - 1; i >= 0; i--) {
      if (distanceMeters(seed, pending[i]) <= meters) {
        group.unshift(pending[i]);
        pending.splice(i, 1);
      }
    }

    clusters.push(buildCluster(group));
  }

  return clusters;
}

function buildCluster(points: MemoryPoint[]): MemoryCluster {
  const center = centroid(points);
  const photoCount = points.filter((p) => p.kind === "photo").length;
  const momentCount = points.filter((p) => p.kind === "moment").length;
  const withThumb = points.find((p) => p.photo?.thumbUrl ?? p.photo?.url);

  return {
    // El id depende de los miembros: si el grupo cambia, el marcador se recrea.
    id: points.map((p) => p.id).join("|"),
    latitude: center.latitude,
    longitude: center.longitude,
    points,
    thumbUrl: withThumb?.photo?.thumbUrl ?? withThumb?.photo?.url ?? null,
    label: clusterLabel(points, photoCount, momentCount),
    photoCount,
    momentCount,
  };
}

function clusterLabel(points: MemoryPoint[], photos: number, moments: number): string {
  if (points.length === 1) {
    const only = points[0];
    return (
      only.locationName ??
      only.moment?.title ??
      only.photo?.description ??
      (only.kind === "moment" ? "Momento" : "Foto")
    );
  }

  const named = points.find((p) => p.locationName)?.locationName;
  if (named) return named;

  const parts: string[] = [];
  if (photos) parts.push(`${photos} foto${photos === 1 ? "" : "s"}`);
  if (moments) parts.push(`${moments} momento${moments === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Resumen "📸 12 · ✨ 4 · 💰 3" para el marcador del mapa global. */
export function contentSummary(counts: PlaceContentCounts): string | null {
  const parts: string[] = [];
  if (counts.photos) parts.push(`📸 ${counts.photos}`);
  if (counts.moments) parts.push(`✨ ${counts.moments}`);
  if (counts.expenses) parts.push(`💰 ${counts.expenses}`);
  return parts.length ? parts.join(" · ") : null;
}

export function hasContent(counts: PlaceContentCounts): boolean {
  return counts.photos > 0 || counts.moments > 0 || counts.expenses > 0;
}
