"use client";

import { useMemo, useState } from "react";
import type { Expense } from "@/core/models";
import { baseAmount, computeBalance, totalsByCategory } from "@/core/expenses/balance";
import { categoryMeta } from "@/core/expenses/categories";
import { formatDate, formatMoney } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { expensesRepo } from "@/services/repositories";
import { useTrip } from "@/components/providers/TripProvider";
import { useExpenses } from "@/hooks/useTripCollections";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ExpenseIcon } from "@/components/ui/icons";
import { CategoryIcon } from "@/components/ui/iconFor";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ExpenseFormModal } from "./ExpenseFormModal";
import { CategoryBars } from "./CategoryBars";
import { BalancePanel } from "./BalancePanel";

export function ExpensesView() {
  const { trip, members, tripPlaces } = useTrip();
  const tripId = trip?.id ?? "";
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const { data, loading, error, refresh } = useExpenses(tripId);
  const [creating, setCreating] = useState(false);

  const expenses = useMemo(() => data ?? [], [data]);

  // Moneda local mas usada en el viaje: la alternativa natural para el toggle.
  const localCurrency = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of expenses) {
      if (e.currency !== trip?.baseCurrency) {
        counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1);
      }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [code, count] of counts) {
      if (count > bestCount) {
        best = code;
        bestCount = count;
      }
    }
    return best;
  }, [expenses, trip?.baseCurrency]);

  const display = useDisplayCurrency(trip?.baseCurrency ?? "EUR", localCurrency);

  const balance = useMemo(
    () => computeBalance(expenses, members.map((m) => m.userId)),
    [expenses, members],
  );
  const categories = useMemo(() => totalsByCategory(expenses), [expenses]);

  async function remove(expense: Expense) {
    const ok = await confirm({
      title: "Eliminar gasto",
      body: `Se eliminará “${expense.description}”. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;

    try {
      await expensesRepo.remove(getSupabaseBrowserClient(), expense.id);
      toast("Gasto eliminado", "info");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  if (loading && !data) return <LoadingState label="Cargando gastos…" />;

  return (
    <div className="app-page max-w-6xl space-y-6">
      <PageHeader
        title="Gastos"
        subtitle={`${expenses.length} gasto${expenses.length === 1 ? "" : "s"} · ${tripPlaces.length} lugares`}
        action={
          <div className="flex items-center gap-2">
            {display.canToggle && (
              <Button variant="secondary" onClick={display.toggle}>
                Ver en {display.currency === trip?.baseCurrency ? localCurrency : trip?.baseCurrency}
              </Button>
            )}
            <Button onClick={() => setCreating(true)}>+ Gasto</Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={() => void refresh()} />}
      {display.error && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {display.error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="p-5">
          <h2 className="text-base font-semibold ink-primary">Movimientos</h2>

          {expenses.length === 0 ? (
            <EmptyState
              icon={ExpenseIcon}
              title="Sin gastos todavía"
              description="Registra el primero: importe, categoría, quién pagó y dónde."
              action={<Button onClick={() => setCreating(true)}>Añadir gasto</Button>}
              className="mt-4 border-0"
            />
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
              {expenses.map((expense) => {
                const meta = categoryMeta(expense.category);
                const payer = members.find((m) => m.userId === expense.paidBy)?.profile;
                const converted = display.convert(baseAmount(expense));
                const showsOriginal = expense.currency !== display.currency;

                return (
                  <li key={expense.id} className="group flex items-center gap-3 py-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl surface-2 text-brand-600 dark:text-brand-300"
                      aria-hidden
                    >
                      <CategoryIcon category={meta.id} size={20} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium ink-primary">{expense.description}</p>
                      <p className="flex items-center gap-1.5 truncate text-xs ink-muted">
                        {payer && <Avatar profile={payer} size="xs" />}
                        <span className="truncate">
                          {payer?.name} · {formatDate(expense.date)}
                          {expense.tripPlace ? ` · ${expense.tripPlace.place.name}` : ""}
                        </span>
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums ink-primary">
                        {formatMoney(converted, display.currency)}
                      </p>
                      {showsOriginal && (
                        <p className="text-xs tabular-nums ink-muted">
                          {formatMoney(expense.amount, expense.currency)}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => void remove(expense)}
                      aria-label={`Eliminar ${expense.description}`}
                      className="shrink-0 rounded-lg p-1.5 ink-muted transition-opacity hover:text-rose-600 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-base font-semibold ink-primary">Balance</h2>
            <div className="mt-4">
              <BalancePanel
                balance={balance}
                members={members}
                currency={display.currency}
                convert={display.convert}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold ink-primary">Por categoría</h2>
            <div className="mt-4">
              <CategoryBars
                totals={categories}
                currency={display.currency}
                convert={display.convert}
              />
            </div>
          </Card>
        </div>
      </div>

      <ExpenseFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => void refresh()}
      />
      {confirmDialog}
    </div>
  );
}
