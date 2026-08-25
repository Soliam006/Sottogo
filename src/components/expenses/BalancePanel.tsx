"use client";

import type { TripBalance } from "@/core/expenses/balance";
import type { TripMember } from "@/core/models";
import { formatMoney } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Resumen de balance: total del viaje, cuanto ha puesto cada participante
 * y quien debe a quien. Funciona con cualquier numero de personas.
 */
export function BalancePanel({
  balance,
  members,
  currency,
  convert = (v: number) => v,
}: {
  balance: TripBalance;
  members: TripMember[];
  currency: string;
  convert?: (amount: number) => number;
}) {
  const byId = new Map(members.map((m) => [m.userId, m.profile]));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm ink-muted">Total del viaje</p>
        <p className="mt-0.5 text-4xl font-bold tabular-nums ink-primary">
          {formatMoney(convert(balance.total), currency)}
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {balance.perMember.map((entry) => {
          const profile = byId.get(entry.userId);
          return (
            <li
              key={entry.userId}
              className="flex items-center justify-between gap-3 rounded-xl surface-2 px-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar profile={profile} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium ink-primary">
                    {profile?.name ?? "Participante"}
                  </span>
                  <span
                    className={
                      "block text-xs tabular-nums " +
                      (entry.net >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400")
                    }
                  >
                    {entry.net >= 0 ? "le deben " : "debe "}
                    {formatMoney(Math.abs(convert(entry.net)), currency)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums ink-primary">
                {formatMoney(convert(entry.paid), currency)}
              </span>
            </li>
          );
        })}
      </ul>

      {balance.settlements.length > 0 && (
        <div>
          <p className="text-sm font-medium ink-secondary">Para dejarlo a cero</p>
          <ul className="mt-2 space-y-1.5">
            {balance.settlements.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm ink-secondary">
                <span className="font-medium ink-primary">{byId.get(s.fromUserId)?.name ?? "?"}</span>
                <span aria-hidden>→</span>
                <span className="font-medium ink-primary">{byId.get(s.toUserId)?.name ?? "?"}</span>
                <span className="ml-auto font-semibold tabular-nums ink-primary">
                  {formatMoney(convert(s.amount), currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
