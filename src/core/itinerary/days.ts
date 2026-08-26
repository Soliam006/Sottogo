/**
 * Organizacion del itinerario por dias.
 *
 * REGLA CENTRAL: el orden se DERIVA siempre de (fecha, hora de inicio). No
 * existe ninguna posicion guardada a mano — `itinerary_items` no tiene columna
 * `position` — asi que al cambiar la fecha o la hora de una actividad, su sitio
 * se recalcula solo y no queda un orden antiguo pegado.
 *
 * Capa pura: sin React ni Supabase.
 */

import type { ISODate, ItineraryItem } from "@/core/models";
import { isOutsideTrip, pickDefaultDay, unionDays } from "@/core/calendar/days";

export interface ItineraryDay {
  date: ISODate;
  count: number;
  outsideTrip: boolean;
}

/**
 * Comparador cronologico dentro de un dia.
 * Sin hora se va al final: una actividad sin hora no puede colarse entre dos
 * que si la tienen.
 */
export function byStartTime(a: ItineraryItem, b: ItineraryItem): number {
  const left = a.startTime?.slice(0, 5) ?? "";
  const right = b.startTime?.slice(0, 5) ?? "";
  if (left && right && left !== right) return left.localeCompare(right);
  if (left && !right) return -1;
  if (!left && right) return 1;
  // Mismo horario (o ninguno): el titulo decide, para que el orden sea estable.
  return a.title.localeCompare(b.title);
}

/** Actividades de un dia, siempre en orden cronologico. */
export function itemsOnDay(items: readonly ItineraryItem[], date: ISODate): ItineraryItem[] {
  return items.filter((item) => item.date === date).sort(byStartTime);
}

/**
 * Los dias con pestana: el rango del viaje mas las fechas que tengan
 * actividades. Mover una actividad a un dia fuera del viaje no la esconde.
 */
export function itineraryDays(
  startDate: ISODate,
  endDate: ISODate,
  items: readonly ItineraryItem[],
): ItineraryDay[] {
  const counts = new Map<ISODate, number>();
  for (const item of items) {
    counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
  }

  return unionDays(startDate, endDate, [...counts.keys()]).map((date) => ({
    date,
    count: counts.get(date) ?? 0,
    outsideTrip: isOutsideTrip(date, startDate, endDate),
  }));
}

/**
 * Dia inicial: hoy si el viaje esta en curso; si no, el primer dia con
 * actividades; y en ultimo termino, el primero del rango.
 *
 * A diferencia de Gastos aqui no hay "Todos": el itinerario se lee por dias.
 */
export function defaultItineraryDay(
  days: readonly ItineraryDay[],
  startDate: ISODate,
  endDate: ISODate,
  today: ISODate,
): ISODate | null {
  if (days.length === 0) return null;

  const inTrip = pickDefaultDay(startDate, endDate, today);
  if (inTrip && days.some((day) => day.date === inTrip)) return inTrip;

  return days.find((day) => day.count > 0)?.date ?? days[0].date;
}
