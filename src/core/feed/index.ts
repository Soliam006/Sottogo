/**
 * Acumulacion de lotes.
 *
 * Capa pura: sin React ni Supabase. Vale para cualquier lista paginada del
 * viaje —fotos, momentos— porque lo unico que necesita de un elemento es su
 * `id`. Vive aqui, y no junto a las fotos, porque los dos casos raros que
 * resuelve no son de fotos: son de paginar.
 */

import type { UUID } from "@/core/models";

export interface Batch<T> {
  items: T[];
  /** Cuantos hay en total segun el servidor. */
  total: number;
}

/**
 * Anade un lote a lo ya cargado.
 *
 * Dos reglas, y las dos importan:
 *
 * 1. No se repite ninguno. Si alguien anade algo entre dos lotes, las filas se
 *    desplazan una posicion y el ultimo de la pagina anterior reaparece al
 *    principio de la siguiente.
 *
 * 2. Un lote vacio fija el total a lo que hay. El servidor puede decir que
 *    quedan mas y no ser cierto (alguien borro mientras navegabas); si no se
 *    corrige, quien mira sigue creyendo que faltan y el centinela vuelve a
 *    pedir en bucle.
 */
export function appendBatch<T extends { id: UUID }>(
  loaded: readonly T[],
  batch: Batch<T>,
): Batch<T> {
  const seen = new Set(loaded.map((item) => item.id));
  const items = [...loaded, ...batch.items.filter((item) => !seen.has(item.id))];

  return {
    items,
    total: batch.items.length > 0 ? batch.total : items.length,
  };
}

/** Quedan elementos por traer. */
export function hasMore(loaded: readonly unknown[], total: number): boolean {
  return loaded.length < total;
}
