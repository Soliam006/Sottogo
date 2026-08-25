"use client";

import { useEffect, useState } from "react";
import type { Booking, BookingKind } from "@/core/models";
import { bookingConfig, validateBooking } from "@/core/bookings";
import type { MemoryLocation } from "@/core/map/location";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { bookingsRepo } from "@/services/repositories";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { PlaceIcon, SearchIcon } from "@/components/ui/icons";
import { MemoryLocationPicker } from "@/components/map/MemoryLocationPicker";

/** Ubicacion elegida: etiqueta visible + Place real opcional. */
interface LocationValue {
  label: string;
  placeId: string | null;
}

interface Draft {
  provider: string;
  code: string;
  reference: string;
  startAt: string;
  endAt: string;
  from: LocationValue;
  fromTerminal: string;
  to: LocationValue;
  toTerminal: string;
  notes: string;
}

function draftFrom(booking: Booking | null): Draft {
  return {
    provider: booking?.provider ?? "",
    code: booking?.code ?? "",
    reference: booking?.reference ?? "",
    startAt: toLocalInput(booking?.startAt ?? null),
    endAt: toLocalInput(booking?.endAt ?? null),
    from: { label: booking?.fromLabel ?? "", placeId: booking?.fromPlaceId ?? null },
    fromTerminal: booking?.fromTerminal ?? "",
    to: { label: booking?.toLabel ?? "", placeId: booking?.toPlaceId ?? null },
    toTerminal: booking?.toTerminal ?? "",
    notes: booking?.notes ?? "",
  };
}

/**
 * Alta y edicion de una reserva. Un unico formulario para vuelos, alojamientos
 * y coches: los textos y los campos visibles salen de `bookingConfig(kind)`,
 * asi que anadir un tipo nuevo no toca este componente.
 */
export function BookingFormModal({
  open,
  kind,
  booking = null,
  onClose,
  onSaved,
}: {
  open: boolean;
  kind: BookingKind;
  /** Reserva a editar. `null` = alta. */
  booking?: Booking | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const config = bookingConfig(kind);
  const { trip } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();

  const [draft, setDraft] = useState<Draft>(() => draftFrom(booking));
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir: cargar la reserva a editar o empezar en blanco.
  useEffect(() => {
    if (!open) return;
    setDraft(draftFrom(booking));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking?.id]);

  const patch = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));

  async function save() {
    setError(null);
    const problem = validateBooking(draft, config);
    if (problem) return setError(problem);
    if (!trip || !session?.user) return;

    setSaving(true);
    try {
      const db = getSupabaseBrowserClient();
      const input = {
        kind,
        provider: draft.provider,
        code: config.codeLabel ? draft.code.trim() || null : null,
        reference: draft.reference.trim() || null,
        startAt: fromLocalInput(draft.startAt),
        endAt: fromLocalInput(draft.endAt),
        fromLabel: config.fromLabel ? draft.from.label.trim() || null : null,
        fromPlaceId: config.fromLabel ? draft.from.placeId : null,
        fromTerminal: config.terminals ? draft.fromTerminal.trim() || null : null,
        toLabel: config.toLabel ? draft.to.label.trim() || null : null,
        toPlaceId: config.toLabel ? draft.to.placeId : null,
        toTerminal: config.terminals ? draft.toTerminal.trim() || null : null,
        notes: draft.notes.trim() || null,
      };

      if (booking) await bookingsRepo.update(db, booking.id, input);
      else await bookingsRepo.create(db, trip.id, session.user.id, input);

      toast(booking ? "Reserva actualizada" : `${capitalize(config.singular)} guardado`);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "No se ha podido guardar la reserva."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={booking ? `Editar ${config.singular}` : `Añadir ${config.singular}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className={config.codeLabel ? "grid gap-4 sm:grid-cols-2" : undefined}>
            <Field label={config.providerLabel} required>
              {(id) => (
                <TextInput
                  id={id}
                  value={draft.provider}
                  onChange={(e) => patch({ provider: e.target.value })}
                  placeholder={config.providerPlaceholder}
                  maxLength={80}
                  autoFocus
                />
              )}
            </Field>

            {config.codeLabel && (
              <Field label={config.codeLabel}>
                {(id) => (
                  <TextInput
                    id={id}
                    value={draft.code}
                    onChange={(e) => patch({ code: e.target.value })}
                    placeholder={config.codePlaceholder}
                    maxLength={16}
                  />
                )}
              </Field>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={config.startLabel}>
              {(id) => (
                <TextInput
                  id={id}
                  type="datetime-local"
                  value={draft.startAt}
                  onChange={(e) => patch({ startAt: e.target.value })}
                />
              )}
            </Field>
            <Field label={config.endLabel}>
              {(id) => (
                <TextInput
                  id={id}
                  type="datetime-local"
                  value={draft.endAt}
                  onChange={(e) => patch({ endAt: e.target.value })}
                />
              )}
            </Field>
          </div>

          {config.fromLabel && (
            <LocationField
              label={config.fromLabel}
              value={draft.from}
              onChange={(from) => patch({ from })}
              onSearch={() => setPicking("from")}
              terminal={
                config.terminals
                  ? { value: draft.fromTerminal, onChange: (v) => patch({ fromTerminal: v }) }
                  : null
              }
            />
          )}

          {config.toLabel && (
            <LocationField
              label={config.toLabel}
              value={draft.to}
              onChange={(to) => patch({ to })}
              onSearch={() => setPicking("to")}
              terminal={
                config.terminals
                  ? { value: draft.toTerminal, onChange: (v) => patch({ toTerminal: v }) }
                  : null
              }
            />
          )}

          <Field
            label="Localizador (opcional)"
            hint="El código de la reserva. No guardes aquí datos de tu tarjeta ni documentos."
          >
            {(id) => (
              <TextInput
                id={id}
                value={draft.reference}
                onChange={(e) => patch({ reference: e.target.value })}
                placeholder="ABC123"
                maxLength={40}
              />
            )}
          </Field>

          <Field label="Notas (opcional)">
            {() => (
              <TextArea
                value={draft.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Equipaje facturado, desayuno incluido…"
                maxLength={500}
              />
            )}
          </Field>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {error}
            </p>
          )}
        </div>
      </Modal>

      {/* Reutiliza la busqueda de lugares reales del resto de la app. */}
      <MemoryLocationPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === "to" ? (config.toLabel ?? "Ubicación") : (config.fromLabel ?? "Ubicación")}
        description="Busca el sitio real o márcalo en el mapa. También puedes escribirlo a mano."
        onSelect={(location: MemoryLocation) => {
          const value: LocationValue = {
            label: location.name ?? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
            placeId: location.placeId,
          };
          if (picking === "to") patch({ to: value });
          else patch({ from: value });
          setPicking(null);
        }}
      />
    </>
  );
}

/**
 * Ubicacion escribible a mano O elegida del buscador de lugares reales.
 * Escribir a mano borra el `placeId`: la etiqueta deja de venir de un Place.
 */
function LocationField({
  label,
  value,
  onChange,
  onSearch,
  terminal,
}: {
  label: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  onSearch: () => void;
  terminal: { value: string; onChange: (value: string) => void } | null;
}) {
  return (
    <div className={terminal ? "grid gap-4 sm:grid-cols-[1fr_9rem]" : undefined}>
      <Field label={label}>
        {(id) => (
          <div className="flex items-center gap-2">
            <TextInput
              id={id}
              value={value.label}
              onChange={(e) => onChange({ label: e.target.value, placeId: null })}
              placeholder="Escribe o busca un lugar…"
              maxLength={120}
            />
            <Button variant="secondary" size="sm" onClick={onSearch} aria-label={`Buscar ${label}`}>
              <SearchIcon size={16} aria-hidden />
            </Button>
          </div>
        )}
      </Field>

      {terminal && (
        <Field label="Terminal">
          {(id) => (
            <TextInput
              id={id}
              value={terminal.value}
              onChange={(e) => terminal.onChange(e.target.value)}
              placeholder="T4"
              maxLength={12}
            />
          )}
        </Field>
      )}

      {value.placeId && (
        <p className="flex items-center gap-1.5 text-xs ink-muted sm:col-span-full">
          <PlaceIcon size={13} weight="fill" className="text-brand-500" aria-hidden />
          Lugar real enlazado
        </p>
      )}
    </div>
  );
}

/** RFC3339 -> valor de `datetime-local` en hora local del navegador. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Valor de `datetime-local` -> RFC3339. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
