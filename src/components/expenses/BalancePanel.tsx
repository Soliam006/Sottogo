"use client";

import type { TripBalance } from "@/core/expenses/balance";
import type { TripMember } from "@/core/models";
import { formatMoney } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { BackIcon } from "@/components/ui/icons";

/**
 * Resumen de balance: total del viaje, cuanto ha puesto cada participante y
 * quien paga a quien para dejarlo a cero. Funciona con cualquier numero de
 * personas.
 *
 * Las dos ideas viven separadas a proposito:
 *   - "Ha pagado cada uno" responde SOLO cuanto ha puesto cada persona.
 *   - "Para dejarlo a cero" responde quien paga a quien, con nombres.
 *
 * Antes cada fila mezclaba ambas ("debe 25 €"), sin decir a quien y repitiendo
 * lo que la liquidacion ya explica mejor.
 *
 * El panel vive en una columna de 360 px en escritorio y a pantalla completa en
 * tablet, asi que el reparto en columnas usa CONSULTAS DE CONTENEDOR
 * (`@container` / `@md:`) y no breakpoints de viewport: lo que decide si caben
 * dos columnas es el ancho de la tarjeta, no el de la pantalla.
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
  const name = (userId: string) => byId.get(userId)?.name ?? "Participante";

  return (
    <div className="@container space-y-5">
      <div>
        <p className="text-sm ink-muted">Total del viaje</p>
        <p className="mt-0.5 text-3xl font-bold tabular-nums ink-primary @xs:text-4xl">
          {formatMoney(convert(balance.total), currency)}
        </p>
      </div>

      <section>
        <h3 className="text-sm font-medium ink-secondary">Ha pagado cada uno</h3>
        {/* Una linea por persona: con 10 participantes la tarjeta sigue siendo
            legible. Dos columnas solo si el contenedor pasa de 28rem. */}
        <ul className="mt-2 grid gap-1.5 @md:grid-cols-2">
          {balance.perMember.map((entry) => (
            <li
              key={entry.userId}
              className="flex min-w-0 items-center gap-2.5 rounded-xl surface-2 px-3 py-2"
            >
              <Avatar profile={byId.get(entry.userId)} size="sm" />
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium ink-primary"
                title={name(entry.userId)}
              >
                {name(entry.userId)}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums ink-primary">
                {formatMoney(convert(entry.paid), currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {balance.settlements.length > 0 && (
        <section>
          <h3 className="text-sm font-medium ink-secondary">Para dejarlo a cero</h3>
          <ul className="mt-2 space-y-1.5">
            {balance.settlements.map((s, i) => (
              <li
                key={i}
                className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl surface-2 px-3 py-2 text-sm"
              >
                <span
                  className="min-w-0 max-w-[45%] truncate font-medium ink-primary"
                  title={name(s.fromUserId)}
                >
                  {name(s.fromUserId)}
                </span>
                {/* La flecha es decorativa; el lector de pantalla oye "paga a". */}
                <span className="sr-only">paga a</span>
                <BackIcon size={14} weight="bold" className="shrink-0 rotate-180 ink-muted" aria-hidden />
                <span
                  className="min-w-0 max-w-[45%] truncate font-medium ink-primary"
                  title={name(s.toUserId)}
                >
                  {name(s.toUserId)}
                </span>
                <span className="ml-auto shrink-0 font-semibold tabular-nums ink-primary">
                  {formatMoney(convert(s.amount), currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
