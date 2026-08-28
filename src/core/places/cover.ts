/**
 * Portada de un lugar del viaje.
 *
 * Antes la portada era la primera foto que apareciera asignada al lugar: nadie
 * la elegia y cambiaba sola al subir otra. Ahora `coverPhotoId` permite fijarla,
 * y sin ella se mantiene el comportamiento de siempre — asi ningun lugar se
 * queda sin imagen por no haberla elegido.
 *
 * Capa pura: sin React ni Supabase.
 */

import type { Photo, TripPlace } from "@/core/models";

/** Fotos asignadas a este lugar, las candidatas a portada. */
export function photosOfPlace(
  tripPlace: TripPlace,
  photos: readonly Photo[],
): Photo[] {
  return photos.filter((photo) => photo.tripPlaceId === tripPlace.id);
}

/**
 * La foto que hace de portada: la elegida si sigue estando disponible, y si no
 * la primera del lugar.
 *
 * Que se compruebe la disponibilidad importa: si la foto elegida se borro, o
 * dejo de estar asignada a este lugar, la tarjeta debe caer a otra en vez de
 * quedarse en blanco.
 */
export function coverPhotoOf(
  tripPlace: TripPlace,
  photos: readonly Photo[],
): Photo | null {
  const own = photosOfPlace(tripPlace, photos);
  if (tripPlace.coverPhotoId) {
    const chosen = own.find((photo) => photo.id === tripPlace.coverPhotoId);
    if (chosen) return chosen;
  }
  return own[0] ?? null;
}

/** URL de la portada, con la imagen del proveedor como ultimo recurso. */
export function coverUrlOf(
  tripPlace: TripPlace,
  photos: readonly Photo[],
): string | null {
  const photo = coverPhotoOf(tripPlace, photos);
  return photo?.thumbUrl ?? photo?.url ?? tripPlace.place.image ?? null;
}
