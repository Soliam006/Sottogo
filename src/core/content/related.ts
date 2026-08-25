/**
 * Contenido relacionado: crear varias entidades a partir de UNA sola fotografia.
 *
 * Regla de oro del modulo: la imagen fisica se sube una vez y produce una unica
 * fila `Photo`. Momento, Galeria y Gasto no copian el archivo, solo referencian
 * esa Photo (`moment_photos` y `expenses.photo_id`).
 *
 *                  ┌── Moment   (moment_photos)
 *                  │
 *   Photo ─────────┼── Galeria  (photos.in_gallery)
 *                  │
 *                  └── Expense  (expenses.photo_id)
 *
 * Esta capa es pura: sin React, sin Supabase.
 */

import type { ExpenseCategory, ISODate, Photo, TripPlace } from "@/core/models";

/** Que se puede crear ademas del contenido principal de cada modal. */
export type RelatedTarget = "gallery" | "moment" | "expense";

export interface MomentDraft {
  title: string;
  description: string;
  date: ISODate;
  rating: number | null;
  tripPlace: TripPlace | null;
}

export interface ExpenseDraft {
  amount: string;
  currency: string;
  description: string;
  category: ExpenseCategory;
  paidBy: string;
  date: ISODate;
  tripPlace: TripPlace | null;
}

/**
 * Estado del bloque "contenido relacionado" de un modal. `enabled` guarda las
 * casillas marcadas; los borradores existen siempre para no perder lo escrito
 * si el usuario desmarca y vuelve a marcar.
 */
export interface RelatedDraft {
  enabled: Record<RelatedTarget, boolean>;
  moment: MomentDraft;
  expense: ExpenseDraft;
}

export interface RelatedDraftSeed {
  date: ISODate;
  currency: string;
  paidBy: string;
  tripPlace?: TripPlace | null;
  description?: string;
  /** Casillas marcadas de salida (p. ej. la galeria en el flujo de foto). */
  enabled?: Partial<Record<RelatedTarget, boolean>>;
}

export function emptyRelatedDraft(seed: RelatedDraftSeed): RelatedDraft {
  const tripPlace = seed.tripPlace ?? null;
  return {
    enabled: {
      gallery: seed.enabled?.gallery ?? false,
      moment: seed.enabled?.moment ?? false,
      expense: seed.enabled?.expense ?? false,
    },
    moment: {
      title: seed.description ?? "",
      description: "",
      date: seed.date,
      rating: null,
      tripPlace,
    },
    expense: {
      amount: "",
      currency: seed.currency,
      description: seed.description ?? "",
      category: "food",
      paidBy: seed.paidBy,
      date: seed.date,
      tripPlace,
    },
  };
}

/**
 * Propaga al bloque relacionado lo que el usuario cambia en el formulario
 * principal (lugar, fecha, descripcion), respetando lo que ya haya tocado a
 * mano en los subformularios.
 */
export function syncDraftContext(
  draft: RelatedDraft,
  context: { tripPlace?: TripPlace | null; date?: ISODate; description?: string },
  touched: { moment: boolean; expense: boolean },
): RelatedDraft {
  const next = { ...draft };

  if (!touched.moment) {
    next.moment = {
      ...draft.moment,
      tripPlace: context.tripPlace !== undefined ? context.tripPlace : draft.moment.tripPlace,
      date: context.date ?? draft.moment.date,
      title: context.description ?? draft.moment.title,
    };
  }
  if (!touched.expense) {
    next.expense = {
      ...draft.expense,
      tripPlace: context.tripPlace !== undefined ? context.tripPlace : draft.expense.tripPlace,
      date: context.date ?? draft.expense.date,
      description: context.description ?? draft.expense.description,
    };
  }

  return next;
}

/**
 * Metadatos heredables de una Photo ya existente. Si la foto lleva 📍 Shinjuku
 * y una fecha, el momento o el gasto que se creen desde ella los proponen.
 */
export function contextFromPhoto(photo: Photo): { date: ISODate | null; tripPlace: TripPlace | null } {
  const stamp = photo.takenAt ?? photo.createdAt;
  return {
    date: stamp ? stamp.slice(0, 10) : null,
    tripPlace: photo.tripPlace ?? null,
  };
}

/** Valida los subformularios activos. Devuelve el primer problema encontrado. */
export function validateRelatedDraft(
  draft: RelatedDraft,
  offered: readonly RelatedTarget[],
): string | null {
  if (offered.includes("moment") && draft.enabled.moment && draft.moment.title.trim().length < 2) {
    return "Ponle un título al momento relacionado.";
  }
  if (offered.includes("expense") && draft.enabled.expense) {
    const value = parseAmount(draft.expense.amount);
    if (value === null) return "Introduce un importe válido para el gasto relacionado.";
    if (draft.expense.description.trim().length < 2) {
      return "Añade una descripción al gasto relacionado.";
    }
  }
  return null;
}

/** "2.400" / "2,4" -> numero. `null` si no es un importe positivo valido. */
export function parseAmount(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Si alguna casilla ofrecida esta marcada. */
export function hasRelatedWork(draft: RelatedDraft, offered: readonly RelatedTarget[]): boolean {
  return offered.some((target) => draft.enabled[target]);
}
