"use client";

import { useState } from "react";
import type { Booking, BookingKind } from "@/core/models";
import { BOOKING_KINDS, bookingConfig, bookingsOfKind } from "@/core/bookings";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { bookingsRepo } from "@/services/repositories";
import { useTrip } from "@/components/providers/TripProvider";
import { useBookings, useChecklist } from "@/hooks/useTripCollections";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs, type TabOption } from "@/components/ui/Tabs";
import { AddIcon, OtherPrepIcon } from "@/components/ui/icons";
import { bookingIcon } from "@/components/ui/iconFor";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ChecklistPanel } from "@/components/checklist/ChecklistPanel";
import { BookingCard } from "./BookingCard";
import { BookingFormModal } from "./BookingFormModal";

/** Las pestanas de reserva salen de `BOOKING_KINDS`; "otros" es la checklist. */
type TabKey = BookingKind | "other";

/**
 * Preparación del viaje.
 *
 * Cuatro apartados: Vuelos, Hoteles, Coche y Otros. Los tres primeros leen de
 * la misma tabla `trip_bookings` y se describen en `src/core/bookings`, asi que
 * anadir un apartado de reservas nuevo (tren, ferry) no toca esta vista.
 * "Otros" es la checklist de siempre, intacta.
 */
export function PreparationView() {
  const { trip } = useTrip();
  const tripId = trip?.id ?? "";
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const { data, loading, error, refresh } = useBookings(tripId);
  // Una sola suscripcion a la checklist: alimenta el contador y el panel.
  const checklistState = useChecklist(tripId);

  const [tab, setTab] = useState<TabKey>("flight");
  const [editing, setEditing] = useState<{ kind: BookingKind; booking: Booking | null } | null>(
    null,
  );

  const bookings = data ?? [];
  const pendingChecklist = (checklistState.data ?? []).filter((i) => !i.completed).length;

  const tabs: TabOption<TabKey>[] = [
    ...BOOKING_KINDS.map((config) => ({
      value: config.kind as TabKey,
      label: config.label,
      Icon: bookingIcon(config.kind),
      count: bookingsOfKind(bookings, config.kind).length,
    })),
    { value: "other", label: "Otros", Icon: OtherPrepIcon, count: pendingChecklist },
  ];

  async function remove(booking: Booking) {
    const config = bookingConfig(booking.kind);
    const ok = await confirm({
      title: `Eliminar ${config.singular}`,
      body: `Se eliminará “${booking.provider}”. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;

    try {
      await bookingsRepo.remove(getSupabaseBrowserClient(), booking.id);
      toast("Reserva eliminada", "info");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <div className="app-page max-w-3xl space-y-6">
      <PageHeader
        title="Preparación"
        subtitle="Vuelos, alojamientos y todo lo que no puedes olvidar antes de salir."
      />

      <Tabs value={tab} onChange={setTab} options={tabs} />

      {tab === "other" ? (
        <ChecklistPanel state={checklistState} />
      ) : (
        <BookingsPanel
          kind={tab}
          bookings={bookingsOfKind(bookings, tab)}
          loading={loading && !data}
          error={error}
          onRetry={() => void refresh()}
          onAdd={() => setEditing({ kind: tab, booking: null })}
          onEdit={(booking) => setEditing({ kind: booking.kind, booking })}
          onDelete={(booking) => void remove(booking)}
        />
      )}

      <p className="text-xs ink-muted">
        Voyago no almacena pasaportes, documentos de identidad, tarjetas bancarias ni otros
        documentos personales. Guarda aquí solo los datos de la reserva.
      </p>

      {editing && (
        <BookingFormModal
          open
          kind={editing.kind}
          booking={editing.booking}
          onClose={() => setEditing(null)}
          onSaved={() => void refresh()}
        />
      )}
      {confirmDialog}
    </div>
  );
}

function BookingsPanel({
  kind,
  bookings,
  loading,
  error,
  onRetry,
  onAdd,
  onEdit,
  onDelete,
}: {
  kind: BookingKind;
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAdd: () => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}) {
  const config = bookingConfig(kind);

  if (loading) return <LoadingState label={`Cargando ${config.label.toLowerCase()}…`} />;

  return (
    <div className="space-y-4">
      {error && <ErrorState message={error} onRetry={onRetry} />}

      {bookings.length === 0 ? (
        <EmptyState
          icon={bookingIcon(kind)}
          title={config.emptyTitle}
          description={config.emptyHint}
          action={
            <Button onClick={onAdd}>
              <AddIcon size={16} weight="bold" aria-hidden />
              Añadir {config.singular}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={onAdd}>
              <AddIcon size={16} weight="bold" aria-hidden />
              Añadir {config.singular}
            </Button>
          </div>

          <ul className="space-y-3">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <BookingCard
                  booking={booking}
                  onEdit={() => onEdit(booking)}
                  onDelete={() => onDelete(booking)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
