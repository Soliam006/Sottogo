"use client";

import { useMemo, useState } from "react";
import type { ItineraryItem, TripPlace } from "@/core/models";
import { dateRange, formatDate, formatTime, todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { itineraryRepo } from "@/services/repositories";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useItinerary } from "@/hooks/useTripCollections";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PlacePicker } from "@/components/places/PlacePicker";

const ICONS = ["📍", "🚆", "⛩️", "🍜", "🍣", "☕", "🎮", "🛍️", "🏨", "✈️", "🎟️", "🌸"];

export function ItineraryView() {
  const { trip } = useTrip();
  const tripId = trip?.id ?? "";
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const { data, loading, error, refresh } = useItinerary(tripId);
  const [creating, setCreating] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, ItineraryItem[]>();
    for (const item of data ?? []) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [data]);

  const days = trip ? dateRange(trip.startDate, trip.endDate) : [];
  const today = todayISO();

  async function remove(item: ItineraryItem) {
    const ok = await confirm({ title: "Eliminar actividad", body: `Se eliminará “${item.title}”.` });
    if (!ok) return;
    try {
      await itineraryRepo.remove(getSupabaseBrowserClient(), item.id);
      toast("Actividad eliminada", "info");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  if (loading && !data) return <LoadingState label="Cargando itinerario…" />;

  return (
    <div className="app-page max-w-4xl space-y-6">
      <PageHeader
        title="Itinerario"
        subtitle="Día a día, con lugares reales."
        action={<Button onClick={() => setCreating(today)}>+ Actividad</Button>}
      />

      {error && <ErrorState message={error} onRetry={() => void refresh()} />}

      {days.length === 0 ? (
        <EmptyState icon="📅" title="Sin fechas" description="Revisa las fechas del viaje." />
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const items = byDate.get(day) ?? [];
            const isToday = day === today;

            return (
              <Card key={day} className={isToday ? "border-brand-400 p-5" : "p-5"}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide ink-secondary">
                    📅 {formatDate(day, "day")}
                    {isToday && (
                      <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-900/60 dark:text-brand-200">
                        Hoy
                      </span>
                    )}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setCreating(day)}>
                    + Añadir
                  </Button>
                </div>

                {items.length === 0 ? (
                  <p className="mt-3 text-sm ink-muted">Día libre.</p>
                ) : (
                  <ol className="mt-4 space-y-3">
                    {items.map((item) => (
                      <li key={item.id} className="group flex gap-4">
                        <span className="w-14 shrink-0 pt-0.5 text-sm font-semibold tabular-nums ink-muted">
                          {formatTime(item.startTime) || "—"}
                        </span>
                        <span className="relative min-w-0 flex-1 border-l border-subtle pb-1 pl-4">
                          <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
                          <span className="block text-sm font-medium ink-primary">
                            {item.icon ? `${item.icon} ` : ""}
                            {item.title}
                          </span>
                          {item.tripPlace && (
                            <span className="block text-xs ink-muted">
                              📍 {item.tripPlace.place.name}
                            </span>
                          )}
                          {item.description && (
                            <span className="mt-1 block text-sm ink-secondary">{item.description}</span>
                          )}
                        </span>
                        <button
                          onClick={() => void remove(item)}
                          aria-label={`Eliminar ${item.title}`}
                          className="shrink-0 self-start rounded-lg p-1.5 ink-muted transition-opacity hover:text-rose-600 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <ActivityModal
          date={creating}
          onClose={() => setCreating(null)}
          onSaved={() => {
            setCreating(null);
            void refresh();
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
}

function ActivityModal({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { trip } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string>("📍");
  const [startTime, setStartTime] = useState("");
  const [activityDate, setActivityDate] = useState(date);
  const [description, setDescription] = useState("");
  const [tripPlace, setTripPlace] = useState<TripPlace | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (title.trim().length < 2 && !tripPlace) {
      return setError("Escribe un título o elige un lugar.");
    }
    if (!trip || !session?.user) return;

    setSaving(true);
    try {
      await itineraryRepo.create(getSupabaseBrowserClient(), trip.id, session.user.id, {
        title: title.trim() || tripPlace!.place.name,
        description: description.trim() || null,
        date: activityDate,
        startTime: startTime || null,
        endTime: null,
        icon,
        tripPlaceId: tripPlace?.id ?? null,
      });
      toast("Actividad añadida");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Nueva actividad"
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
          <div className="space-y-1.5">
            <span className="block text-sm font-medium ink-secondary">Lugar</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex-1 truncate rounded-xl border border-subtle px-3.5 py-2.5 text-left text-sm ink-primary hover:surface-2"
              >
                {tripPlace ? `📍 ${tripPlace.place.name}` : "🔎 Buscar lugar…"}
              </button>
              {tripPlace && (
                <Button variant="ghost" size="sm" onClick={() => setTripPlace(null)}>
                  Quitar
                </Button>
              )}
            </div>
          </div>

          <Field label="Título">
            {(id) => (
              <TextInput
                id={id}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tripPlace ? tripPlace.place.name : "Comida en Ichiran"}
              />
            )}
          </Field>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium ink-secondary">Icono</span>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setIcon(option)}
                  aria-pressed={icon === option}
                  className={
                    "h-9 w-9 rounded-lg border text-base transition-colors " +
                    (icon === option ? "border-brand-500 bg-brand-50 dark:bg-brand-900/40" : "border-subtle hover:surface-2")
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={activityDate}
                  min={trip?.startDate}
                  max={trip?.endDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                />
              )}
            </Field>
            <Field label="Hora">
              {(id) => (
                <TextInput
                  id={id}
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field label="Notas (opcional)">
            {() => (
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Reservar antes, llevar efectivo…"
              />
            )}
          </Field>

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <PlacePicker
        open={picking}
        onClose={() => setPicking(false)}
        onSelect={setTripPlace}
        title="Lugar de la actividad"
      />
    </>
  );
}
