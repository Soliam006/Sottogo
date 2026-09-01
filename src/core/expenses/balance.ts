import type { Expense, ExpenseCategory, UUID } from "@/core/models";
import { currencyDecimals, roundForCurrency } from "@/core/currency";
import { EXPENSE_CATEGORIES } from "./categories";

/**
 * Calculo de balances del viaje.
 *
 * Todos los importes se expresan en la MONEDA BASE del viaje. La conversion
 * ocurre antes (ver src/core/currency) para que este modulo sea puro y testeable.
 * El algoritmo funciona con cualquier numero de participantes.
 */

export interface MemberBalance {
  userId: UUID;
  paid: number;
  /** Parte que le corresponde (reparto a partes iguales). */
  share: number;
  /** paid - share. Positivo: le deben. Negativo: debe. */
  net: number;
}

export interface Settlement {
  fromUserId: UUID;
  toUserId: UUID;
  amount: number;
}

export interface TripBalance {
  total: number;
  perMember: MemberBalance[];
  settlements: Settlement[];
}

/** Importe del gasto en la moneda base del viaje. */
export function baseAmount(expense: Expense): number {
  return expense.convertedAmount ?? expense.amount;
}

/**
 * Recorte de coma flotante para totales de solo lectura (categorias y dias).
 * No decide reparto, asi que no necesita conocer la divisa: en una divisa sin
 * fraccion los sumandos ya son enteros y esto es la identidad.
 */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Reparto y liquidacion en la MONEDA BASE del viaje.
 *
 * `currency` no es decorativo: decide la unidad minima en la que se reparte.
 * Repartir siempre en centimos daba partes de "333.333,33 ₲" en un viaje en
 * guaranies, una divisa que no tiene fraccion.
 */
export function computeBalance(
  expenses: Expense[],
  memberIds: UUID[],
  currency: string,
): TripBalance {
  const round = (n: number) => roundForCurrency(n, currency);
  const paid = new Map<UUID, number>(memberIds.map((id) => [id, 0]));

  let total = 0;
  for (const e of expenses) {
    const amount = baseAmount(e);
    total += amount;
    // Un pagador que ya no es miembro sigue contando en el total pero no reparte.
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + amount);
  }
  total = round(total);

  // Reparto a partes iguales en la unidad minima de la divisa: el resto se
  // distribuye entre los primeros participantes para que la suma de partes
  // cuadre exactamente con el total.
  const participants = memberIds.length || 1;
  const factor = 10 ** currencyDecimals(currency);
  const totalUnits = Math.round(total * factor);
  const baseUnits = Math.floor(totalUnits / participants);
  const remainder = totalUnits - baseUnits * participants;

  const perMember: MemberBalance[] = memberIds.map((id, index) => {
    const share = (baseUnits + (index < remainder ? 1 : 0)) / factor;
    const p = round(paid.get(id) ?? 0);
    return { userId: id, paid: p, share, net: round(p - share) };
  });

  return { total, perMember, settlements: computeSettlements(perMember, currency) };
}

/**
 * Liquidacion con numero minimo de transferencias (greedy sobre deudores/acreedores).
 * Suficiente y estable para grupos de viaje; no busca el optimo global (NP-hard).
 */
export function computeSettlements(
  perMember: MemberBalance[],
  currency: string,
): Settlement[] {
  const round = (n: number) => roundForCurrency(n, currency);
  // Media unidad minima: por debajo de eso no hay nada que transferir. Con el
  // 0,01 fijo de antes, un viaje en guaranies arrastraba saldos de medio
  // guarani que generaban liquidaciones de importe cero.
  const eps = 0.5 / 10 ** currencyDecimals(currency);

  const debtors = perMember
    .filter((m) => m.net < -eps)
    .map((m) => ({ id: m.userId, amount: -m.net }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = perMember
    .filter((m) => m.net > eps)
    .map((m) => ({ id: m.userId, amount: m.net }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = round(Math.min(debtors[i].amount, creditors[j].amount));
    if (amount > eps) {
      settlements.push({ fromUserId: debtors[i].id, toUserId: creditors[j].id, amount });
    }
    debtors[i].amount = round(debtors[i].amount - amount);
    creditors[j].amount = round(creditors[j].amount - amount);
    if (debtors[i].amount <= eps) i += 1;
    if (creditors[j].amount <= eps) j += 1;
  }

  return settlements;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  total: number;
  count: number;
  ratio: number;
}

export function totalsByCategory(expenses: Expense[]): CategoryTotal[] {
  const totals = new Map<ExpenseCategory, { total: number; count: number }>();
  let grand = 0;

  for (const e of expenses) {
    const amount = baseAmount(e);
    grand += amount;
    const current = totals.get(e.category) ?? { total: 0, count: 0 };
    current.total += amount;
    current.count += 1;
    totals.set(e.category, current);
  }

  return EXPENSE_CATEGORIES.map((c) => {
    const t = totals.get(c.id) ?? { total: 0, count: 0 };
    return {
      category: c.id,
      total: round2(t.total),
      count: t.count,
      ratio: grand > 0 ? t.total / grand : 0,
    };
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.total - a.total);
}

export interface DailyTotal {
  date: string;
  total: number;
}

export function totalsByDay(expenses: Expense[]): DailyTotal[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    map.set(e.date, (map.get(e.date) ?? 0) + baseAmount(e));
  }
  return [...map.entries()]
    .map(([date, total]) => ({ date, total: round2(total) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
