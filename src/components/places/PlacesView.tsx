"use client";

import { useMemo, useState } from "react";
import type { Photo, TripPlace, TripPlaceStatus } from "@/core/models";
import { coverUrlOf, photosOfPlace } from "@/core/places/cover";
import { baseAmount } from "@/core/expenses/balance";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { placesRepo } from "@/services/repositories";
import { useTrip } from "@/components/providers/TripProvider";
import { useExpenses, usePhotos } from "@/hooks/useTripCollections";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { CheckIcon, ExpenseIcon, FavouriteIcon, ImageIcon, MapIcon, PhotoIcon, PlaceIcon, VisitedIcon } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { ProgressBar, Rating, SegmentedControl } from "@/components/ui/Misc";
import { TextArea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PlacePicker } from "./PlacePicker";

type Filter = "all" | TripPlaceStatus;

export function PlacesView() {
  const { trip, tripPlaces, loading, refresh, canEdit } = useTrip();
  const tripId = trip?.id ?? "";
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const { data: photos } = usePhotos(tripId);
  const { data: expenses } = useExpenses(tripId, canEdit);

  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TripPlace | null>(null);

  const visitedCount = tripPlaces.filter((tp) => tp.status === "visited").length;

  const stats = useMemo(() => {
    const map = new Map<string, { photos: number; spent: number }>();
    for (const tp of tripPlaces) map.set(tp.id, { photos: 0, spent: 0 });
    for (const photo of photos ?? []) {
      if (!photo.tripPlaceId) continue;
      const entry = map.get(photo.tripPlaceId);
      if (entry) entry.photos += 1;
    }
    for (const expense of expenses ?? []) {
      if (!expense.tripPlaceId) continue;
      const entry = map.get(expense.tripPlaceId);
      if (entry) entry.spent += baseAmount(expense);
    }
    return map;
  }, [tripPlaces, photos, expenses]);

  const filtered = tripPlaces.filter((tp) => filter === "all" || tp.status === filter);

  const coverFor = (tripPlace: TripPlace) => coverUrlOf(tripPlace, photos ?? []);

  async function toggleStatus(tripPlace: TripPlace) {
    const next: TripPlaceStatus = tripPlace.status === "visited" ? "wishlist" : "visited";
    try {
      await placesRepo.update(getSupabaseBrowserClient(), tripPlace.id, {
        status: next,
        visitedAt: next === "visited" ? (tripPlace.visitedAt ?? todayISO()) : null,
      });
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function remove(tripPlace: TripPlace) {
    const ok = await confirm({
      title: "Quitar lugar del viaje",
      body: `“${tripPlace.place.name}” dejará de aparecer en el mapa. Las fotos y gastos asociados se conservan, pero perderán el enlace al lugar.`,
      confirmLabel: "Quitar",
    });
    if (!ok) return;

    try {
      await placesRepo.remove(getSupabaseBrowserClient(), tripPlace.id);
      toast("Lugar eliminado", "info");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  if (loading && !tripPlaces.length) return <LoadingState label="Cargando lugares…" />;

  return (
    <div className="app-page max-w-6xl space-y-6">
      <PageHeader
        title="Lugares"
        subtitle="Lo que quieres ver y lo que ya has vivido."
        action={<Button onClick={() => setAdding(true)}>+ Lugar</Button>}
      />

      <Card className="p-5">
        <ProgressBar value={visitedCount} total={tripPlaces.length} label="Lugares visitados" />
      </Card>

      <SegmentedControl<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Todos", count: tripPlaces.length },
          { value: "wishlist", label: "Quiero visitar", Icon: FavouriteIcon, count: tripPlaces.length - visitedCount },
          { value: "visited", label: "Visitados", Icon: VisitedIcon, count: visitedCount },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={PlaceIcon}
          title="Ningún lugar aquí"
          description="Busca un lugar real (Senso-ji, Akihabara…) y añádelo al viaje."
          action={<Button onClick={() => setAdding(true)}>Buscar lugar</Button>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tripPlace) => {
            const stat = stats.get(tripPlace.id);
            const cover = coverFor(tripPlace);

            return (
              <li key={tripPlace.id}>
                <Card className="flex h-full min-w-0 flex-col overflow-hidden">
                  <div className="relative h-32 surface-2">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-3xl" aria-hidden>
                        <MapIcon size={28} weight="duotone" className="ink-muted" aria-hidden />
                      </span>
                    )}
                    <button
                      onClick={() => void toggleStatus(tripPlace)}
                      className="absolute right-2 top-2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/70"
                    >
                      {tripPlace.status === "visited" ? "Visitado" : "Pendiente"}
                    </button>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                    <div>
                      <p className="truncate font-semibold ink-primary">{tripPlace.place.name}</p>
                      {tripPlace.place.address && (
                        <p className="truncate text-xs ink-muted">{tripPlace.place.address}</p>
                      )}
                    </div>

                    <p className="text-xs ink-muted">
                      <PhotoIcon size={13} weight="fill" className="inline align-[-2px]" aria-hidden />{" "}
                      {stat?.photos ?? 0} · <ExpenseIcon size={13} weight="fill" className="inline align-[-2px]" aria-hidden />{" "}
                      {formatMoney(stat?.spent ?? 0, trip?.baseCurrency ?? "EUR", { compact: true })}
                      {tripPlace.visitedAt ? ` · ${formatDate(tripPlace.visitedAt)}` : ""}
                    </p>

                    {tripPlace.rating !== null && <Rating value={tripPlace.rating} readOnly />}
                    {tripPlace.notes && (
                      <p className="line-clamp-2 text-sm ink-secondary">{tripPlace.notes}</p>
                    )}

                    <div className="mt-auto flex gap-1.5 pt-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(tripPlace)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void remove(tripPlace)}>
                        Quitar
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <PlacePicker open={adding} onClose={() => setAdding(false)} onSelect={() => void refresh()} />

      {editing && (
        <EditPlaceModal
          tripPlace={editing}
          photos={photosOfPlace(editing, photos ?? [])}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
}

function EditPlaceModal({
  tripPlace,
  photos,
  onClose,
  onSaved,
}: {
  tripPlace: TripPlace;
  /** Fotos ya asignadas a este lugar: las candidatas a portada. */
  photos: Photo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(tripPlace.notes ?? "");
  const [rating, setRating] = useState<number | null>(tripPlace.rating);
  // `null` = automatica (la primera foto del lugar).
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(tripPlace.coverPhotoId);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await placesRepo.update(getSupabaseBrowserClient(), tripPlace.id, {
        notes: notes.trim() || null,
        rating,
        coverPhotoId,
      });
      toast("Lugar actualizado");
      onSaved();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tripPlace.place.name}
      description={tripPlace.place.address ?? undefined}
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
          <span className="block text-sm font-medium ink-secondary">Portada</span>
          {photos.length === 0 ? (
            <p className="text-sm ink-muted">
              Sube fotos a la galería y asígnalas a este lugar para poder elegir su portada.
            </p>
          ) : (
            <>
              <ul className="app-scroll-x no-scrollbar flex gap-2 pb-1">
                <li>
                  {/* Sin elegir nada, la portada la pone la primera foto. */}
                  <button
                    type="button"
                    onClick={() => setCoverPhotoId(null)}
                    aria-pressed={coverPhotoId === null}
                    className={
                      "flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-[10px] transition-colors " +
                      (coverPhotoId === null
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                        : "border-subtle ink-muted hover:surface-2")
                    }
                  >
                    <ImageIcon size={18} weight="duotone" aria-hidden />
                    Auto
                  </button>
                </li>
                {photos.map((photo) => {
                  const active = coverPhotoId === photo.id;
                  return (
                    <li key={photo.id}>
                      <button
                        type="button"
                        onClick={() => setCoverPhotoId(photo.id)}
                        aria-pressed={active}
                        aria-label={photo.description || "Usar como portada"}
                        className={
                          "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors " +
                          (active ? "border-brand-500" : "border-transparent hover:border-subtle")
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.thumbUrl ?? photo.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {active && (
                          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                            <CheckIcon size={11} weight="bold" aria-hidden />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs ink-muted">
                {coverPhotoId === null
                  ? "Automática: se usa la primera foto del lugar."
                  : "Portada fijada."}
              </p>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium ink-secondary">Valoración</span>
          <Rating value={rating} onChange={setRating} />
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium ink-secondary">Notas</span>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lo mejor del día, qué pedir, a qué hora ir…"
          />
        </div>
      </div>
    </Modal>
  );
}
