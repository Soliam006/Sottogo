import type { ExpenseCategory } from "@/core/models";

export interface CategoryMeta {
  id: ExpenseCategory;
  label: string;
  emoji: string;
  /** Indice dentro de la paleta categorica (ver globals.css). */
  tone: number;
}

export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  { id: "food",          label: "Comida",      emoji: "🍜", tone: 0 },
  { id: "accommodation", label: "Alojamiento", emoji: "🏨", tone: 1 },
  { id: "transport",     label: "Transporte",  emoji: "🚆", tone: 2 },
  { id: "tickets",       label: "Entradas",    emoji: "🎟️", tone: 3 },
  { id: "shopping",      label: "Compras",     emoji: "🛍️", tone: 4 },
  { id: "coffee",        label: "Cafés",       emoji: "☕", tone: 5 },
  { id: "gifts",         label: "Regalos",     emoji: "🎁", tone: 6 },
  { id: "fun",           label: "Ocio",        emoji: "🎮", tone: 7 },
  { id: "other",         label: "Otros",       emoji: "📦", tone: 8 },
];

const BY_ID = new Map<ExpenseCategory, CategoryMeta>(
  EXPENSE_CATEGORIES.map((c) => [c.id, c]),
);

export function categoryMeta(id: ExpenseCategory): CategoryMeta {
  return BY_ID.get(id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}
