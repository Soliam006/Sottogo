"use client";

import { useState } from "react";
import type { CategoryTotal } from "@/core/expenses/balance";
import { categoryMeta, EXPENSE_CATEGORIES } from "@/core/expenses/categories";
import { formatMoney } from "@/lib/format";

/**
 * Gastos por categoria: barras horizontales, una sola serie, con etiqueta
 * directa en cada barra (la identidad nunca depende solo del color).
 * Paleta categorica validada; el slot 9 ("Otros") es gris neutro a proposito.
 */
export function CategoryBars({
  totals,
  currency,
  convert = (v: number) => v,
}: {
  totals: CategoryTotal[];
  currency: string;
  convert?: (amount: number) => number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (!totals.length) {
    return <p className="py-8 text-center text-sm ink-muted">Todavía no hay gastos registrados.</p>;
  }

  const max = Math.max(...totals.map((t) => t.total));

  return (
    <div className="space-y-3">
      {totals.map((entry) => {
        const meta = categoryMeta(entry.category);
        const slot = EXPENSE_CATEGORIES.findIndex((c) => c.id === entry.category) + 1;
        const width = max > 0 ? Math.max(2, (entry.total / max) * 100) : 0;
        const amount = convert(entry.total);

        return (
          <div
            key={entry.category}
            onMouseEnter={() => setHovered(entry.category)}
            onMouseLeave={() => setHovered(null)}
            className="group"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 ink-secondary">
                <span aria-hidden>{meta.emoji}</span>
                <span className="truncate">{meta.label}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums ink-primary">
                {formatMoney(amount, currency)}
              </span>
            </div>

            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full surface-2">
              <div
                className="h-full rounded-r-[4px] transition-[width,opacity] duration-500"
                style={{
                  width: `${width}%`,
                  backgroundColor: `var(--series-${slot})`,
                  opacity: hovered && hovered !== entry.category ? 0.45 : 1,
                }}
                title={`${meta.label}: ${formatMoney(amount, currency)} · ${entry.count} gasto${entry.count === 1 ? "" : "s"}`}
              />
            </div>

            <p className="mt-1 text-xs ink-muted">
              {entry.count} gasto{entry.count === 1 ? "" : "s"} ·{" "}
              {(entry.ratio * 100).toFixed(0)}% del total
            </p>
          </div>
        );
      })}
    </div>
  );
}
