"use client";

import type { Booking } from "@/core/models";
import { bookingConfig, nights } from "@/core/bookings";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteIcon, ReferenceIcon } from "@/components/ui/icons";
import { CopyButton } from "@/components/ui/CopyButton";
import { bookingIcon } from "@/components/ui/iconFor";

/**
 * Una reserva. La tarjeta se adapta al tipo con `bookingConfig`: un vuelo
 * muestra origen -> destino con terminales, un hotel una sola ubicacion y las
 * noches, y un coche recogida -> devolucion.
 */
export function BookingCard({
  booking,
  onEdit,
  onDelete,
}: {
  booking: Booking;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const config = bookingConfig(booking.kind);
  const Glyph = bookingIcon(booking.kind);
  const stayNights = booking.kind === "stay" ? nights(booking) : null;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl surface-2 text-brand-600 dark:text-brand-300"
          aria-hidden
        >
          <Glyph size={20} weight="fill" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="min-w-0 truncate font-semibold ink-primary">{booking.provider}</p>
            {booking.code && (
              <span className="rounded-md surface-2 px-1.5 py-0.5 text-xs font-medium tabular-nums ink-secondary">
                {booking.code}
              </span>
            )}
          </div>

          {stayNights !== null && (
            <p className="mt-0.5 text-xs ink-muted">
              {stayNights} noche{stayNights === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Editar
          </Button>
          <button
            onClick={onDelete}
            aria-label={`Eliminar ${config.singular} de ${booking.provider}`}
            className="rounded-lg p-1.5 ink-muted transition-colors hover:text-rose-600"
          >
            <DeleteIcon size={16} aria-hidden />
          </button>
        </div>
      </div>

      {/* Trayecto: origen y destino con su hora. Una columna en movil. */}
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <Leg
          label={config.fromLabel ?? config.startLabel}
          place={booking.fromLabel}
          terminal={booking.fromTerminal}
          when={booking.startAt}
          whenLabel={config.startLabel}
        />
        {config.toLabel ? (
          <Leg
            label={config.toLabel}
            place={booking.toLabel}
            terminal={booking.toTerminal}
            when={booking.endAt}
            whenLabel={config.endLabel}
          />
        ) : (
          <Leg label={config.endLabel} place={null} terminal={null} when={booking.endAt} whenLabel={null} />
        )}
      </dl>

      {(booking.reference || booking.notes) && (
        <div className="mt-3 space-y-1.5 border-t border-subtle pt-3">
          {booking.reference && (
            <p className="flex items-center gap-1.5 text-xs ink-secondary">
              <ReferenceIcon size={14} className="shrink-0 ink-muted" aria-hidden />
              <span className="font-medium">Localizador</span>
              <span className="min-w-0 truncate font-mono">{booking.reference}</span>
              <CopyButton value={booking.reference} label="Copiar localizador" size={13} />
            </p>
          )}
          {booking.notes && (
            <p className="whitespace-pre-line text-xs ink-secondary">{booking.notes}</p>
          )}
        </div>
      )}
    </Card>
  );
}

function Leg({
  label,
  place,
  terminal,
  when,
  whenLabel,
}: {
  label: string;
  place: string | null;
  terminal: string | null;
  when: string | null;
  whenLabel: string | null;
}) {
  const time = formatDateTime(when);
  // Sin ubicacion ni hora no hay nada que contar.
  if (!place && !time) return null;

  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide ink-muted">{label}</dt>
      <dd className="mt-0.5 min-w-0">
        {place && (
          /* La direccion es lo que se pega en el mapa o en el taxi: copiarla a
             mano desde el movil es justo lo que se quiere evitar. */
          <p className="flex items-center gap-1">
            <span className="min-w-0 truncate text-sm font-medium ink-primary" title={place}>
              {place}
            </span>
            <CopyButton value={place} label={`Copiar ${label.toLowerCase()}`} />
          </p>
        )}
        <p className="text-xs ink-secondary">
          {time || <span className="ink-muted">Sin fecha</span>}
          {terminal && <span className="ink-muted"> · Terminal {terminal}</span>}
          {!place && whenLabel && !time && <span className="ink-muted"> ({whenLabel})</span>}
        </p>
      </dd>
    </div>
  );
}
