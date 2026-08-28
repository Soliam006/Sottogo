/**
 * Ubicacion exacta de un recuerdo (foto o momento).
 *
 * Deliberadamente NO exige un `Place`: unas coordenadas bastan. `placeId` solo
 * se rellena cuando la ubicacion vino de una busqueda de lugares reales, y
 * `name` es una etiqueta libre ("Omoide Yokocho") que puede existir sin Place.
 *
 * Capa pura: sin React ni Supabase.
 */

import type { UUID } from "@/core/models";
import type { LatLng } from "./geo";

/** De donde salio la ubicacion. `saved` = ya estaba guardada en el viaje. */
export type LocationSource = "current" | "search" | "map" | "saved";

export interface MemoryLocation extends LatLng {
  name: string | null;
  placeId: UUID | null;
  source: LocationSource;
}

export const GEOLOCATION_ERRORS: Record<number, string> = {
  1: "Has denegado el acceso a tu ubicación. Actívalo en el navegador o elige otra opción.",
  2: "No se ha podido determinar tu ubicación. Prueba a buscarla o a marcarla en el mapa.",
  3: "La búsqueda de tu ubicación ha tardado demasiado. Inténtalo de nuevo.",
};

export function geolocationMessage(code: number | undefined): string {
  return (
    (code !== undefined ? GEOLOCATION_ERRORS[code] : undefined) ??
    "No se ha podido obtener tu ubicación."
  );
}

/** "📍 Omoide Yokocho" o, sin nombre, las coordenadas redondeadas. */
export function describeLocation(location: MemoryLocation | null): string {
  if (!location) return "Sin ubicación";
  if (location.name) return location.name;
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}
