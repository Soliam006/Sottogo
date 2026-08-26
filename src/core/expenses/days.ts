/**
 * Agrupacion de gastos por dia del viaje.
 *
 * La aritmetica de fechas y la union de dias viven en `@/core/calendar/days`,
 * compartidas con el Itinerario.
 *
 * Capa pura: sin React ni Supabase.
 */

import type { Expense, ISODate } from "@/core/models";
import { isOutsideTrip, pickDefaultDay, unionDays } from "@/core/calendar/days";
import { baseAmount } from "./balance";

export { addDays } from "@/core/calendar/days";

export interface ExpenseDay {
  date: ISODate;
  count: number;
  /** Total del dia en la moneda base del viaje. */
  total: number;
  /** El dia cae fuera del rango del viaje (gasto anterior o posterior). */
  outsideTrip: boolean;
}

/**
 * Los dias que merecen pestana: el rango del viaje mas las fechas con gastos,
 * para que un gasto de antes de salir o de despues de volver no quede oculto.
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

  return unionDays(startDate, endDate, [...stats.keys()]).map((date) => ({
    date,
    count: stats.get(date)?.count ?? 0,
    total: stats.get(date)?.total ?? 0,
    outsideTrip: isOutsideTrip(date, startDate, endDate),
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
  return pickDefaultDay(startDate, endDate, today);
}
