/**
 * Dias de un viaje. Base compartida por Gastos e Itinerario.
 *
 * Las fechas se manejan como cadenas `YYYY-MM-DD` y la aritmetica va en UTC:
 * sumar un dia no debe depender de la zona horaria del navegador ni del
 * horario de verano.
 *
 * Capa pura: sin React ni Supabase.
 */

import type { ISODate } from "@/core/models";

/** Tope de seguridad: un rango absurdo no debe generar miles de pestanas. */
const MAX_DAYS = 400;

/** `2026-03-12` + 1 => `2026-03-13`. */
export function addDays(date: ISODate, days: number): ISODate {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Los dias que merecen pestana: el rango del viaje UNIDO a las fechas que
 * traen contenido.
 *
 * La union importa: si algo quedo fechado fuera del viaje (un gasto de antes de
 * salir, una actividad movida a otro dia), sigue teniendo su dia y no
 * desaparece de la interfaz.
 */
export function unionDays(
  startDate: ISODate,
  endDate: ISODate,
  extraDates: readonly ISODate[],
): ISODate[] {
  const dates = new Set<ISODate>(extraDates.filter(Boolean));

  if (startDate && endDate && startDate <= endDate) {
    let day = startDate;
    for (let i = 0; day <= endDate && i < MAX_DAYS; i++) {
      dates.add(day);
      day = addDays(day, 1);
    }
  }

  return [...dates].sort((a, b) => a.localeCompare(b));
}

/** Si la fecha cae fuera del rango del viaje. */
export function isOutsideTrip(date: ISODate, startDate: ISODate, endDate: ISODate): boolean {
  return !startDate || !endDate || date < startDate || date > endDate;
}

/**
 * Dia inicial: hoy si el viaje esta en curso, y si no `null` (el llamante
 * decide que hacer: "Todos" en Gastos, el primer dia en Itinerario).
 */
export function pickDefaultDay(
  startDate: ISODate,
  endDate: ISODate,
  today: ISODate,
): ISODate | null {
  if (!startDate || !endDate) return null;
  return today >= startDate && today <= endDate ? today : null;
}
