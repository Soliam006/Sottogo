"use client";

import { useEffect, useMemo, useState } from "react";
import type { ItineraryItem } from "@/core/models";
import {
  defaultItineraryDay,
  itemsOnDay,
  itineraryDays,
} from "@/core/itinerary/days";
import { itineraryPlaceLabel } from "@/core/itinerary/location";
import type { MemoryLocation } from "@/core/map/location";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { itineraryRepo } from "@/services/repositories";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useItinerary } from "@/hooks/useTripCollections";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { AddIcon, DeleteIcon, ItineraryIcon, PlaceIcon, SearchIcon } from "@/components/ui/icons";
import { Tabs, type TabOption } from "@/components/ui/Tabs";
import { SegmentedControl } from "@/components/ui/Misc";
import { MapIcon, ListIcon } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { MemoryLocationPicker } from "@/components/map/MemoryLocationPicker";
import { ITINERARY_ICONS, ItineraryItemIcon } from "@/components/ui/iconFor";
import { ItineraryMap } from "./ItineraryMap";

export function ItineraryView() {
  const { trip } = useTrip();
  const tripId = trip?.id ?? "";
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const { data, loading, error, refresh } = useItinerary(tripId);
  /** Alta (con la fecha propuesta) o edicion (con la actividad). */
  const [editing, setEditing] = useState<{ date: string; item: ItineraryItem | null } | null>(
    null,
  );

  const items = useMemo(() => data ?? [], [data]);
  const today = todayISO();

  const days = useMemo(
    () => itineraryDays(trip?.startDate ?? "", trip?.endDate ?? "", items),
    [trip?.startDate, trip?.endDate, items],
  );

  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const fallbackDay = defaultItineraryDay(days, trip?.startDate ?? "", trip?.endDate ?? "", today);
  // Si el dia elegido deja de existir (se movio la ultima actividad de un dia
  // fuera del viaje), se vuelve al que toque en lugar de quedarse en blanco.
  const day =
    pickedDay && days.some((d) => d.date === pickedDay) ? pickedDay : fallbackDay;

  const dayItems = useMemo(() => (day ? itemsOnDay(items, day) : []), [items, day]);

  // Al guardar, seguir a la actividad: si le cambiaste la fecha, la pestana se
  // mueve con ella en vez de dejarte mirando el dia del que acaba de salir.
  const [followDate, setFollowDate] = useState<string | null>(null);
  useEffect(() => {
    if (followDate && days.some((d) => d.date === followDate)) {
      setPickedDay(followDate);
      setFollowDate(null);
    }
  }, [followDate, days]);

  const [view, setView] = useState<"list" | "map">("list");

  const dayTabs: TabOption<string>[] = days.map((entry) => ({
    value: entry.date,
    label: entry.date === today ? "Hoy" : formatDate(entry.date, "compact"),
    count: entry.count,
  }));

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
        action={
          <Button onClick={() => setEditing({ date: day ?? today, item: null })}>
            <AddIcon size={16} weight="bold" aria-hidden />
            Actividad
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={() => void refresh()} />}

      {days.length === 0 || day === null ? (
        <EmptyState icon={ItineraryIcon} title="Sin fechas" description="Revisa las fechas del viaje." />
      ) : (
        <>
          {/* Vista y fecha son ejes distintos: el conmutador elige COMO se ve
              el dia, las pestanas eligen QUE dia. El mapa respeta la fecha. */}
          <div className="flex justify-end">
            <SegmentedControl<"list" | "map">
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: "Itinerario", Icon: ListIcon },
                { value: "map", label: "Mapa", Icon: MapIcon },
              ]}
            />
          </div>

          {/* Un dia por pestana: el itinerario deja de ser un scroll infinito. */}
          <Tabs value={day} onChange={setPickedDay} options={dayTabs} />

          {view === "map" ? (
            <ItineraryMap
              items={dayItems}
              date={day}
              onEdit={(item) => setEditing({ date: item.date, item })}
            />
          ) : (
          <Card className={day === today ? "border-brand-400 p-5" : "p-5"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide ink-secondary">
                <ItineraryIcon size={16} weight="fill" className="text-brand-500" aria-hidden />
                {formatDate(day, "day")}
                {day === today && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-900/60 dark:text-brand-200">
                    Hoy
                  </span>
                )}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setEditing({ date: day, item: null })}>
                <AddIcon size={15} weight="bold" aria-hidden />
                Añadir
              </Button>
            </div>

            {dayItems.length === 0 ? (
              <p className="mt-3 text-sm ink-muted">Día libre.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {dayItems.map((item) => (
                  <li key={item.id} className="group flex gap-3 sm:gap-4">
                    <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums ink-muted sm:w-14">
                      {formatTime(item.startTime) || "—"}
                    </span>
                    <span className="relative min-w-0 flex-1 border-l border-subtle pb-1 pl-4">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
                      <span className="flex items-center gap-1.5 text-sm font-medium ink-primary">
                        <ItineraryItemIcon
                          icon={item.icon}
                          size={15}
                          className="shrink-0 text-brand-500"
                        />
                        <span className="min-w-0">{item.title}</span>
                      </span>
                      {item.endTime && (
                        <span className="block text-xs tabular-nums ink-muted">
                          Hasta las {formatTime(item.endTime)}
                        </span>
                      )}
                      {item.tripPlace && (
                        <span className="block text-xs ink-muted">{item.tripPlace.place.name}</span>
                      )}
                      {item.description && (
                        <span className="mt-1 block text-sm ink-secondary">{item.description}</span>
                      )}
                    </span>

                    <span className="flex shrink-0 self-start gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ date: item.date, item })}
                      >
                        Editar
                      </Button>
                      <button
                        onClick={() => void remove(item)}
                        aria-label={`Eliminar ${item.title}`}
                        className="rounded-lg p-1.5 ink-muted transition-opacity hover:text-rose-600 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                      >
                        <DeleteIcon size={15} aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          )}
        </>
      )}

      {editing && (
        <ActivityModal
          date={editing.date}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={(savedDate) => {
            setEditing(null);
            // La actividad manda: si cambio de dia, la pestana la sigue.
            setFollowDate(savedDate);
            void refresh();
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
}

/**
 * Alta y edicion de una actividad. Es el MISMO formulario en los dos casos:
 * con `item` carga sus valores y actualiza; sin el, crea.
 *
 * No toca ninguna posicion: el orden se deriva de (fecha, hora), asi que
 * cambiar cualquiera de las dos recoloca la actividad sola.
 */
function ActivityModal({
  date,
  item = null,
  onClose,
  onSaved,
}: {
  /** Fecha propuesta al crear. */
  date: string;
  /** Actividad a editar. `null` = alta. */
  item?: ItineraryItem | null;
  onClose: () => void;
  /** Recibe la fecha con la que quedo guardada, que puede no ser la inicial. */
  onSaved: (savedDate: string) => void;
}) {
  const { trip } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();

  const [title, setTitle] = useState(item?.title ?? "");
  const [icon, setIcon] = useState<string>(item?.icon ?? ITINERARY_ICONS[0].key);
  const [startTime, setStartTime] = useState(formatTime(item?.startTime ?? null));
  const [endTime, setEndTime] = useState(formatTime(item?.endTime ?? null));
  const [activityDate, setActivityDate] = useState(item?.date ?? date);
  const [description, setDescription] = useState(item?.description ?? "");
  // Ubicacion PROPIA de la actividad: coordenadas y, como mucho, un lugar del
  // catalogo global. No se crea ningun `trip_place`, asi que no aparece en el
  // mapa general del viaje.
  const [location, setLocation] = useState<MemoryLocation | null>(() =>
    item && item.latitude !== null && item.longitude !== null
      ? {
          latitude: item.latitude,
          longitude: item.longitude,
          name: itineraryPlaceLabel(item),
          placeId: item.placeId,
          source: "search",
        }
      : item?.tripPlace
        ? {
            // Fila heredada: se conserva su ubicacion tal cual estaba.
            latitude: item.tripPlace.place.latitude,
            longitude: item.tripPlace.place.longitude,
            name: item.tripPlace.place.name,
            placeId: item.tripPlace.place.id,
            source: "search",
          }
        : null,
  );
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (title.trim().length < 2 && !location?.name) {
      return setError("Escribe un título o elige un lugar.");
    }
    if (startTime && endTime && endTime < startTime) {
      return setError("La hora de fin no puede ser anterior a la de inicio.");
    }
    if (!trip || !session?.user) return;

    setSaving(true);
    try {
      const db = getSupabaseBrowserClient();
      const input = {
        title: title.trim() || location?.name || "Actividad",
        description: description.trim() || null,
        date: activityDate,
        startTime: startTime || null,
        endTime: endTime || null,
        icon,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        locationName: location?.name ?? null,
        placeId: location?.placeId ?? null,
        // Se deja de enlazar con los lugares del viaje: era lo que metia las
        // paradas del itinerario en el mapa general.
        tripPlaceId: null,
      };

      if (item) await itineraryRepo.update(db, item.id, input);
      else await itineraryRepo.create(db, trip.id, session.user.id, input);

      toast(item ? "Actividad actualizada" : "Actividad añadida");
      onSaved(activityDate);
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
        title={item ? "Editar actividad" : "Nueva actividad"}
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
            <span className="block text-sm font-medium ink-secondary">Ubicación</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="min-w-0 flex-1 rounded-xl border border-subtle px-3.5 py-2.5 text-left text-sm ink-primary hover:surface-2"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  {location ? (
                    <PlaceIcon size={16} weight="fill" className="shrink-0 text-brand-500" aria-hidden />
                  ) : (
                    <SearchIcon size={16} className="shrink-0" aria-hidden />
                  )}
                  <span className="truncate">
                    {location
                      ? (location.name ??
                        `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`)
                      : "Buscar lugar…"}
                  </span>
                </span>
              </button>
              {location && (
                <Button variant="ghost" size="sm" onClick={() => setLocation(null)}>
                  Quitar
                </Button>
              )}
            </div>
            <p className="text-xs ink-muted">
              Solo aparece en el mapa del itinerario. No se añade a los lugares del viaje.
            </p>
          </div>

          <Field label="Título">
            {(id) => (
              <TextInput
                id={id}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={location?.name ?? "Comida en Ichiran"}
              />
            )}
          </Field>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium ink-secondary">Icono</span>
            <div className="flex flex-wrap gap-1.5">
              {ITINERARY_ICONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setIcon(option.key)}
                  aria-pressed={icon === option.key}
                  aria-label={option.label}
                  title={option.label}
                  className={
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors " +
                    (icon === option.key
                      ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"
                      : "border-subtle ink-secondary hover:surface-2")
                  }
                >
                  <option.Icon size={18} weight={icon === option.key ? "fill" : "regular"} aria-hidden />
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
            <Field label="Hora de inicio">
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

          <Field label="Hora de fin (opcional)">
            {(id) => (
              <TextInput
                id={id}
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            )}
          </Field>

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

      {/* Mismo selector que fotos, momentos y reservas: devuelve coordenadas y,
          opcionalmente, un lugar del catalogo. Nunca crea un `trip_place`. */}
      <MemoryLocationPicker
        open={picking}
        onClose={() => setPicking(false)}
        onSelect={setLocation}
        title="Ubicación de la actividad"
        description="Solo se usa en el mapa del itinerario. No se añade a los lugares del viaje."
      />
    </>
  );
}
