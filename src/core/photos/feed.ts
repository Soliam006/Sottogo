/**
 * Acumulacion de lotes de fotos.
 *
 * Capa pura: sin React ni Supabase. Vive aqui porque los dos casos raros de la
 * paginacion —una foto repetida entre lotes y un lote vacio— no se pueden
 * provocar a mano contra la base de datos, pero si comprobar aqui.
 */

import type { Photo } from "@/core/models";

export interface PhotoBatch {
  photos: Photo[];
  /** Cuantas hay en total segun el servidor. */
  total: number;
}

/**
 * Anade un lote a lo ya cargado.
 *
 * Dos reglas, y las dos importan:
 *
 * 1. No se repite ninguna. Si alguien sube una foto entre dos lotes, las filas
 *    se desplazan una posicion y la ultima de la pagina anterior reaparece al
 *    principio de la siguiente.
 *
 * 2. Un lote vacio fija el total a lo que hay. El servidor puede decir que
 *    quedan mas y no ser cierto (alguien borro fotos mientras navegabas); si no
 *    se corrige, quien mira sigue creyendo que faltan y el centinela vuelve a
 *    pedir en bucle.
 */
export function appendBatch(loaded: readonly Photo[], batch: PhotoBatch): PhotoBatch {
  const seen = new Set(loaded.map((photo) => photo.id));
  const photos = [...loaded, ...batch.photos.filter((photo) => !seen.has(photo.id))];

  return {
    photos,
    total: batch.photos.length > 0 ? batch.total : photos.length,
  };
}

/** Quedan fotos por traer. */
export function hasMore(loaded: readonly Photo[], total: number): boolean {
  return loaded.length < total;
}
