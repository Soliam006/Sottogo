/**
 * Ubicaciones del itinerario.
 *
 * DOS CONTEXTOS SEPARADOS, a proposito:
 *
 *   TripPlace          -> lugares del viaje. Es lo UNICO que dibuja el mapa
 *                         general, junto con fotos, momentos y gastos.
 *   ItineraryLocation  -> donde ocurre una actividad planificada. Vive solo en
 *                         el mapa del itinerario.
 *
 * Antes el formulario del itinerario usaba `PlacePicker`, que da de alta un
 * `trip_place`; por eso el mapa general se llenaba de puntos que solo servian
 * para planificar. Ahora la actividad guarda sus propias coordenadas y, como
 * mucho, una referencia al catalogo global `places` — que NO se dibuja.
 *
 * Capa pura: sin React ni Supabase.
 */

import type { ISODate, ItineraryItem, UUID } from "@/core/models";
import type { LatLng } from "@/core/map/geo";
import { hasCoords } from "@/core/map/geo";

export interface ItineraryLocation extends LatLng {
  /** Nombre visible del sitio. */
  name: string | null;
  /** Lugar real del catalogo global. Opcional: unas coordenadas bastan. */
  placeId: UUID | null;
}

/**
 * Ubicacion efectiva de una actividad.
 *
 * Compatibilidad: las filas antiguas guardaban la ubicacion via `trip_place_id`
 * y puede que aun no las haya alcanzado la migracion, asi que se cae a las
 * coordenadas de ese lugar. Lo propio manda sobre lo heredado.
 */
export function itineraryLocation(item: ItineraryItem): ItineraryLocation | null {
  if (hasCoords(item)) {
    return {
      latitude: item.latitude,
      longitude: item.longitude,
      name: item.locationName ?? item.tripPlace?.place.name ?? null,
      placeId: item.placeId,
    };
  }

  const legacy = item.tripPlace?.place;
  if (legacy) {
    return {
      latitude: legacy.latitude,
      longitude: legacy.longitude,
      name: legacy.name,
      placeId: legacy.id,
    };
  }

  return null;
}

/** Etiqueta del lugar de una actividad, sin coordenadas. */
export function itineraryPlaceLabel(item: ItineraryItem): string | null {
  return item.locationName ?? item.tripPlace?.place.name ?? null;
}

/** Una actividad con ubicacion, lista para dibujar. */
export interface ItineraryStop {
  item: ItineraryItem;
  location: ItineraryLocation;
  /** Turno dentro del dia, empezando en 1. */
  order: number;
}

/**
 * Paradas de un dia: las actividades CON ubicacion, en el mismo orden
 * cronologico que la lista. El numero de turno se asigna sobre las paradas
 * dibujables, para que la ruta se lea 1, 2, 3 sin huecos.
 */
export function stopsForDay(itemsOfDay: readonly ItineraryItem[]): ItineraryStop[] {
  const stops: ItineraryStop[] = [];
  for (const item of itemsOfDay) {
    const location = itineraryLocation(item);
    if (location) stops.push({ item, location, order: stops.length + 1 });
  }
  return stops;
}

/** Cuantas actividades del dia no se pueden dibujar por no tener ubicacion. */
export function countWithoutLocation(itemsOfDay: readonly ItineraryItem[]): number {
  return itemsOfDay.filter((item) => itineraryLocation(item) === null).length;
}

/** Fechas del viaje con al menos una actividad ubicada. */
export function daysWithStops(items: readonly ItineraryItem[]): Set<ISODate> {
  const dates = new Set<ISODate>();
  for (const item of items) {
    if (itineraryLocation(item)) dates.add(item.date);
  }
  return dates;
}
