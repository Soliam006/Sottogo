import type { ExpenseCategory } from "@/core/models";

export interface CategoryMeta {
  id: ExpenseCategory;
  label: string;
  /**
   * Clave del icono. Esta capa no conoce React, asi que guarda un nombre y es
   * la UI (`components/ui/iconFor.tsx`) quien lo traduce a un componente.
   */
  icon: string;
  /** Indice dentro de la paleta categorica (ver globals.css). */
  tone: number;
}

export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  { id: "food",          label: "Comida",      icon: "food",          tone: 0 },
  { id: "accommodation", label: "Alojamiento", icon: "accommodation", tone: 1 },
  { id: "transport",     label: "Transporte",  icon: "transport",     tone: 2 },
  { id: "tickets",       label: "Entradas",    icon: "tickets",       tone: 3 },
  { id: "shopping",      label: "Compras",     icon: "shopping",      tone: 4 },
  { id: "coffee",        label: "Cafés",       icon: "coffee",        tone: 5 },
  { id: "gifts",         label: "Regalos",     icon: "gifts",         tone: 6 },
  { id: "fun",           label: "Ocio",        icon: "fun",           tone: 7 },
  { id: "other",         label: "Otros",       icon: "other",         tone: 8 },
];

const BY_ID = new Map<ExpenseCategory, CategoryMeta>(
  EXPENSE_CATEGORIES.map((c) => [c.id, c]),
);

export function categoryMeta(id: ExpenseCategory): CategoryMeta {
  return BY_ID.get(id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}
