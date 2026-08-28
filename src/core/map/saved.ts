/**
 * Ubicaciones que el viaje YA tiene guardadas.
 *
 * Sirven para no volver a buscar lo que ya existe: el lugar que apuntaste en el
 * mapa, o el hotel donde te alojas. Elegir una de aqui solo COPIA sus
 * coordenadas al contenido nuevo; no crea ningun `trip_place`, asi que el mapa
 * general sigue conteniendo exactamente lo que el viajero puso en el.
 *
 * Capa pura: sin React ni Supabase.
 */

import type { Booking, Place, TripPlace, UUID } from "@/core/models";
import type { LatLng } from "./geo";

export type SavedLocationKind = "place" | "stay";

export interface SavedLocation extends LatLng {
  /** Identificador para las listas de React. */
  key: string;
  kind: SavedLocationKind;
  name: string;
  /** Direccion, ciudad o fechas de la reserva. */
  detail: string | null;
  /** Lugar del catalogo global, si lo hay. */
  placeId: UUID | null;
}

/** Lugares del viaje, los que ya estan en el mapa general. */
function fromTripPlaces(tripPlaces: readonly TripPlace[]): SavedLocation[] {
  return tripPlaces.map((tp) => ({
    key: `place:${tp.id}`,
    kind: "place" as const,
    name: tp.place.name,
    detail: tp.place.address ?? tp.place.city,
    latitude: tp.place.latitude,
    longitude: tp.place.longitude,
    placeId: tp.place.id,
  }));
}

/**
 * Alojamientos de Preparacion.
 *
 * Solo entran los que tienen un lugar real detras: un hotel escrito a mano no
 * guarda coordenadas y no se puede situar en el mapa.
 */
function fromStays(
  bookings: readonly Booking[],
  placesById: ReadonlyMap<UUID, Place>,
): SavedLocation[] {
  const out: SavedLocation[] = [];
  for (const booking of bookings) {
    if (booking.kind !== "stay" || !booking.fromPlaceId) continue;
    const place = placesById.get(booking.fromPlaceId);
    if (!place) continue;
    out.push({
      key: `stay:${booking.id}`,
      kind: "stay",
      name: booking.provider,
      detail: booking.fromLabel ?? place.address ?? place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      placeId: place.id,
    });
  }
  return out;
}

/**
 * Todo lo guardado, con los alojamientos primero: al planificar un dia, el
 * hotel es casi siempre el punto de partida o de vuelta.
 */
export function savedLocations(
  tripPlaces: readonly TripPlace[],
  bookings: readonly Booking[],
  placesById: ReadonlyMap<UUID, Place>,
): SavedLocation[] {
  const stays = fromStays(bookings, placesById);
  const places = fromTripPlaces(tripPlaces);

  // Un hotel que ademas este entre los lugares del viaje saldria dos veces.
  const staysPlaceIds = new Set(stays.map((s) => s.placeId).filter(Boolean));
  return [...stays, ...places.filter((p) => !staysPlaceIds.has(p.placeId))];
}

/** Ids de `places` que hay que resolver para poder situar los alojamientos. */
export function stayPlaceIds(bookings: readonly Booking[]): UUID[] {
  return [
    ...new Set(
      bookings
        .filter((b) => b.kind === "stay" && b.fromPlaceId)
        .map((b) => b.fromPlaceId as UUID),
    ),
  ];
}

/** Filtro por texto, para cuando la lista crece. */
export function filterSaved(
  locations: readonly SavedLocation[],
  query: string,
): SavedLocation[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...locations];
  return locations.filter(
    (l) =>
      l.name.toLowerCase().includes(term) ||
      (l.detail ?? "").toLowerCase().includes(term),
  );
}
