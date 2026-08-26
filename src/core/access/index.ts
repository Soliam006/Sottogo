/**
 * Permisos por rol dentro de un viaje.
 *
 * Un unico sitio donde vive la respuesta a "que puede hacer este rol". La
 * navegacion, los guardas de ruta y los botones leen todos de aqui, asi que no
 * pueden discrepar entre ellos.
 *
 * OJO: esto es la capa de INTERFAZ. La autorizacion de verdad esta en las
 * politicas RLS (`is_trip_editor`), que impiden que un visitante lea gastos,
 * preparacion o diario aunque llame a la API a mano. Lo de aqui existe para que
 * no vea puertas que no puede abrir, no para protegerlas.
 *
 * Capa pura: sin React ni Supabase.
 */

import type { TripRole } from "@/core/models";

/** Secciones del viaje, por su segmento de ruta. "" es el inicio. */
export type TripSection =
  | ""
  | "map"
  | "itinerary"
  | "places"
  | "expenses"
  | "gallery"
  | "moments"
  | "summary"
  | "checklist"
  | "settings";

/**
 * Lo que ve un VISITANTE: el viaje contado, sin la trastienda.
 *
 * Fuera quedan gastos, lugares, preparacion, resumen y configuracion. El mapa
 * general si entra: es la forma de recorrer el viaje.
 */
const VISITOR_SECTIONS: readonly TripSection[] = ["map", "itinerary", "gallery", "moments"];

const ROLES: readonly TripRole[] = ["owner", "member", "visitor"];

/**
 * Convierte el valor crudo de la base de datos en un rol.
 *
 * Es el UNICO sitio que interpreta ese campo. Antes el mapper hacia
 * `row.role === "owner" ? "owner" : "member"`, que colapsaba cualquier rol
 * nuevo en `member`: la base decia `visitor` y la interfaz entendia `member`,
 * asi que el visitante veia el menu completo.
 *
 * Ante un valor desconocido cae a `visitor`, que es el rol MENOS privilegiado:
 * si algun dia aparece un rol que esta capa no conoce, el fallo es hacia el
 * lado seguro, no hacia dar acceso de mas.
 */
export function parseTripRole(value: unknown): TripRole {
  return ROLES.includes(value as TripRole) ? (value as TripRole) : "visitor";
}

/** Nombre del rol para la interfaz. */
export function roleLabel(role: TripRole): string {
  if (role === "owner") return "Propietario";
  if (role === "visitor") return "Visitante";
  return "Participante";
}

export function isVisitor(role: TripRole | null): boolean {
  return role === "visitor";
}

/** Propietario o miembro: puede crear, editar y borrar. */
export function canEdit(role: TripRole | null): boolean {
  return role === "owner" || role === "member";
}

/** Solo el propietario toca la configuracion del viaje. */
export function canManageTrip(role: TripRole | null): boolean {
  return role === "owner";
}

/** Invitar a alguien mas. */
export function canInvite(role: TripRole | null): boolean {
  return canEdit(role);
}

/** Comentar momentos. Lo puede hacer todo el viaje, visitantes incluidos. */
export function canComment(role: TripRole | null): boolean {
  return role !== null;
}

/** Si el rol puede abrir una seccion. */
export function canAccessSection(role: TripRole | null, section: TripSection): boolean {
  if (role === null) return false;
  if (!isVisitor(role)) return true;
  return VISITOR_SECTIONS.includes(section);
}

/**
 * A donde mandar a un visitante que intenta entrar en una seccion prohibida.
 * El mapa es su portada natural.
 */
export const VISITOR_HOME: TripSection = "map";

/** Primera seccion permitida para el rol. */
export function homeSectionFor(role: TripRole | null): TripSection {
  return isVisitor(role) ? VISITOR_HOME : "";
}
