/**
 * Agrupacion de gastos por dia del viaje.
 *
 * Capa pura: sin React ni Supabase. Las fechas se manejan como cadenas
 * `YYYY-MM-DD` y la aritmetica va en UTC, para que sumar un dia no dependa de
 * la zona horaria del navegador ni del horario de verano.
 */

import type { Expense, ISODate } from "@/core/models";
import { baseAmount } from "./balance";

export interface ExpenseDay {
  date: ISODate;
  count: number;
  /** Total del dia en la moneda base del viaje. */
  total: number;
  /** El dia cae fuera del rango del viaje (gasto anterior o posterior). */
  outsideTrip: boolean;
}

/** `2026-03-12` + 1 => `2026-03-13`. */
export function addDays(date: ISODate, days: number): ISODate {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Los dias que merecen pestana.
 *
 * Es la union del rango del viaje con las fechas que tienen gastos: si alguien
 * registra un gasto antes de salir o despues de volver, sigue teniendo su dia y
 * no queda escondido.
 */
export function expenseDays(
  startDate: ISODate,
  endDate: ISODate,
  expenses: readonly Expense[],
): ExpenseDay[] {
  const stats = new Map<ISODate, { count: number; total: number }>();
  for (const expense of expenses) {
    const entry = stats.get(expense.date) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += baseAmount(expense);
    stats.set(expense.date, entry);
  }

  const dates = new Set<ISODate>(stats.keys());
  if (startDate && endDate && startDate <= endDate) {
    // Tope de seguridad: un rango absurdo no debe generar miles de pestanas.
    for (let day = startDate, i = 0; day <= endDate && i < 400; day = addDays(day, 1), i++) {
      dates.add(day);
    }
  }

  return [...dates]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      count: stats.get(date)?.count ?? 0,
      total: stats.get(date)?.total ?? 0,
      outsideTrip: !startDate || !endDate || date < startDate || date > endDate,
    }));
}

export function expensesOnDay(expenses: readonly Expense[], date: ISODate): Expense[] {
  return expenses.filter((expense) => expense.date === date);
}

/**
 * Pestana inicial: el dia de hoy si el viaje esta en curso, y si no, todos los
 * gastos. Estando de viaje lo util es lo de hoy; fuera del viaje, el conjunto.
 */
export function defaultDay(
  startDate: ISODate,
  endDate: ISODate,
  today: ISODate,
): ISODate | null {
  if (!startDate || !endDate) return null;
  return today >= startDate && today <= endDate ? today : null;
}
