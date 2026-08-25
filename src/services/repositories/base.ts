import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Row } from "@/services/mappers";

export type Db = SupabaseClient;

export class RepositoryError extends Error {
  constructor(message: string, readonly cause?: PostgrestError | Error) {
    super(message);
    this.name = "RepositoryError";
  }
}

/** Traduce errores de Postgres a mensajes utiles para la UI. */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }, context: string): T {
  if (result.error) {
    throw new RepositoryError(humanize(result.error, context), result.error);
  }
  if (result.data === null) {
    throw new RepositoryError(`${context}: sin resultados`);
  }
  return result.data;
}

export function unwrapVoid(
  result: { error: PostgrestError | null },
  context: string,
): void {
  if (result.error) {
    throw new RepositoryError(humanize(result.error, context), result.error);
  }
}

function humanize(error: PostgrestError, context: string): string {
  switch (error.code) {
    case "23505":
      return "Ese elemento ya existe.";
    case "23503":
      return "No se puede completar: hay información relacionada.";
    case "42501":
      return "No tienes permisos para hacer esto.";
    case "PGRST116":
      return "No se ha encontrado el elemento.";
    default:
      return error.message || `${context} falló`;
  }
}

export const asRows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
export const asRow = (data: unknown): Row => (data ?? {}) as Row;
