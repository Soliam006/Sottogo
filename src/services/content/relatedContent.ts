"use client";

import type { Expense, Moment, Photo, TripPlace, UUID } from "@/core/models";
import type { MemoryLocation } from "@/core/map/location";
import { roundForCurrency } from "@/core/currency";
import {
  parseAmount,
  type RelatedDraft,
  type RelatedTarget,
} from "@/core/content/related";
import { expensesRepo, momentsRepo, photosRepo } from "@/services/repositories";
import type { PhotoMetaInput } from "@/services/repositories/photos";
import { uploadPhotoFile } from "@/services/storage/photoStorage";
import { getExchangeRate } from "@/services/api/exchange";
import type { Db } from "@/services/repositories/base";

/**
 * Orquestador de "contenido relacionado".
 *
 * Toda la garantia de no duplicar archivos vive aqui: `ensureSharedPhoto`
 * resuelve UNA sola `Photo` y el resto de creaciones reciben ese objeto ya
 * resuelto. Ningun consumidor vuelve a llamar a `uploadPhotoFile`.
 */

/** Origen de la foto compartida: un archivo nuevo o una Photo que ya existe. */
export type PhotoSource =
  | { kind: "file"; file: File }
  | { kind: "photo"; photo: Photo };

export interface RelatedContext {
  tripId: UUID;
  userId: UUID;
  baseCurrency: string;
}


/**
 * Devuelve la Photo compartida, subiendo el archivo solo si hace falta.
 *
 * - `kind: "photo"` -> la fila ya existe: NO se sube nada y NO se crea otra
 *   Photo. Como mucho se promociona a la galeria si se pide y aun no estaba.
 * - `kind: "file"`  -> una unica subida (original + miniatura) y una unica fila.
 */
export async function ensureSharedPhoto(
  db: Db,
  ctx: RelatedContext,
  source: PhotoSource,
  meta: PhotoMetaInput,
): Promise<Photo> {
  if (source.kind === "photo") {
    const existing = source.photo;
    // Reutilizar SIEMPRE. Unico cambio admisible: hacerla visible en galeria.
    if (meta.inGallery && !existing.inGallery) {
      return photosRepo.update(db, existing.id, { inGallery: true });
    }
    return existing;
  }

  const upload = await uploadPhotoFile(db, ctx.tripId, source.file);
  return photosRepo.create(db, ctx.tripId, ctx.userId, upload, meta);
}

/**
 * Crea el momento y/o el gasto marcados a partir de fotos YA resueltas.
 * `offered` limita que objetivos aplican en el modal que llama.
 *
 * `photos` son las mismas filas que ya existen: aqui no se sube nada. El
 * momento enlaza todas; el gasto usa la primera como justificante.
 */
export async function createRelatedContent(
  db: Db,
  ctx: RelatedContext,
  photos: readonly Photo[],
  draft: RelatedDraft,
  offered: readonly RelatedTarget[],
): Promise<{ moment: Moment | null; expense: Expense | null }> {
  const wants = (target: RelatedTarget) => offered.includes(target) && draft.enabled[target];

  let moment: Moment | null = null;
  if (wants("moment")) {
    // El momento nace de una foto: hereda su ubicacion exacta.
    const source = photos[0] ?? null;
    moment = await momentsRepo.create(db, ctx.tripId, ctx.userId, {
      title: draft.moment.title,
      description: draft.moment.description.trim() || null,
      date: draft.moment.date,
      rating: draft.moment.rating,
      tripPlaceId: draft.moment.tripPlace?.id ?? null,
      latitude: source?.latitude ?? null,
      longitude: source?.longitude ?? null,
      locationName: source?.locationName ?? null,
      placeId: source?.placeId ?? null,
      photoIds: photos.map((p) => p.id),
    });
  }

  let expense: Expense | null = null;
  if (wants("expense")) {
    const value = parseAmount(draft.expense.amount);
    if (value === null) throw new Error("Importe del gasto relacionado no válido.");

    const amounts = await convertToBase(value, draft.expense.currency, ctx.baseCurrency);
    expense = await expensesRepo.create(db, ctx.tripId, ctx.userId, {
      amount: value,
      currency: draft.expense.currency,
      convertedAmount: amounts.convertedAmount,
      exchangeRate: amounts.exchangeRate,
      description: draft.expense.description,
      category: draft.expense.category,
      paidBy: draft.expense.paidBy || ctx.userId,
      tripPlaceId: draft.expense.tripPlace?.id ?? null,
      photoId: photos[0]?.id ?? null,
      date: draft.expense.date,
    });
  }

  return { moment, expense };
}

/**
 * Congela el equivalente en la moneda base del viaje, igual que el alta normal
 * de gastos: los balances no deben depender de una API externa a posteriori.
 */
export async function convertToBase(
  value: number,
  currency: string,
  baseCurrency: string,
): Promise<{ convertedAmount: number | null; exchangeRate: number | null }> {
  if (currency === baseCurrency) {
    return { convertedAmount: roundForCurrency(value, baseCurrency), exchangeRate: 1 };
  }

  try {
    const exchangeRate = await getExchangeRate(currency, baseCurrency);
    return {
      convertedAmount: roundForCurrency(value * exchangeRate, baseCurrency),
      exchangeRate,
    };
  } catch {
    throw new Error(
      `No se ha podido obtener el cambio ${currency} → ${baseCurrency}. ` +
        "Prueba de nuevo o registra el gasto en la moneda base.",
    );
  }
}

/**
 * Metadatos de la Photo compartida a partir del contexto del modal que llama.
 * La ubicacion EXACTA manda sobre las coordenadas del lugar del itinerario:
 * si el usuario dijo donde ocurrio, es ahi y no en el centro del barrio.
 */
export function photoMeta(options: {
  description: string | null;
  tripPlace: TripPlace | null;
  location?: MemoryLocation | null;
  inGallery: boolean;
}): PhotoMetaInput {
  const { location, tripPlace } = options;
  return {
    description: options.description,
    tripPlaceId: tripPlace?.id ?? null,
    latitude: location?.latitude ?? tripPlace?.place.latitude ?? null,
    longitude: location?.longitude ?? tripPlace?.place.longitude ?? null,
    locationName: location?.name ?? null,
    placeId: location?.placeId ?? null,
    inGallery: options.inGallery,
  };
}
