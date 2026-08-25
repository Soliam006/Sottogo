import type { Expense, ExpenseCategory, UUID } from "@/core/models";
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

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeBalance(expenses: Expense[], memberIds: UUID[]): TripBalance {
  const paid = new Map<UUID, number>(memberIds.map((id) => [id, 0]));

  let total = 0;
  for (const e of expenses) {
    const amount = baseAmount(e);
    total += amount;
    // Un pagador que ya no es miembro sigue contando en el total pero no reparte.
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + amount);
  }
  total = round2(total);

  // Reparto a partes iguales al centimo: el resto se distribuye entre los
  // primeros participantes para que la suma de partes cuadre con el total.
  const participants = memberIds.length || 1;
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / participants);
  const remainder = totalCents - baseCents * participants;

  const perMember: MemberBalance[] = memberIds.map((id, index) => {
    const shareCents = baseCents + (index < remainder ? 1 : 0);
    const share = shareCents / 100;
    const p = round2(paid.get(id) ?? 0);
    return { userId: id, paid: p, share, net: round2(p - share) };
  });

  return { total, perMember, settlements: computeSettlements(perMember) };
}

/**
 * Liquidacion con numero minimo de transferencias (greedy sobre deudores/acreedores).
 * Suficiente y estable para grupos de viaje; no busca el optimo global (NP-hard).
 */
export function computeSettlements(perMember: MemberBalance[]): Settlement[] {
  const debtors = perMember
    .filter((m) => m.net < -0.01)
    .map((m) => ({ id: m.userId, amount: -m.net }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = perMember
    .filter((m) => m.net > 0.01)
    .map((m) => ({ id: m.userId, amount: m.net }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = round2(Math.min(debtors[i].amount, creditors[j].amount));
    if (amount > 0.01) {
      settlements.push({ fromUserId: debtors[i].id, toUserId: creditors[j].id, amount });
    }
    debtors[i].amount = round2(debtors[i].amount - amount);
    creditors[j].amount = round2(creditors[j].amount - amount);
    if (debtors[i].amount <= 0.01) i += 1;
    if (creditors[j].amount <= 0.01) j += 1;
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
