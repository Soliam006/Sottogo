"use client";

import { useState } from "react";
import type { Moment, MomentComment, Photo, TripPlace } from "@/core/models";
import type { MemoryLocation } from "@/core/map/location";
import { todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { momentCommentsRepo, momentsRepo } from "@/services/repositories";
import {
  createRelatedContent,
  ensureSharedPhoto,
  photoMeta,
  type RelatedContext,
} from "@/services/content/relatedContent";
import {
  emptyRelatedDraft,
  validateRelatedDraft,
  type RelatedDraft,
  type RelatedTarget,
} from "@/core/content/related";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useMomentComments, usePhotos } from "@/hooks/useTripCollections";
import { useMomentFeed } from "@/hooks/useMomentFeed";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { CheckIcon, MomentIcon, PlaceIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Rating } from "@/components/ui/Misc";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { LoadMore } from "@/components/ui/LoadMore";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PhotoLightbox } from "@/components/photos/PhotoLightbox";
import { MomentCard } from "./MomentCard";
import { PlacePicker } from "@/components/places/PlacePicker";
import { MemoryLocationField } from "@/components/map/MemoryLocationField";
import { RelatedContentSection } from "@/components/content/RelatedContentSection";

/**
 * Momentos: la seccion emocional del viaje. Un momento agrupa fotos, lugar,
 * fecha y una historia corta.
 */
export function MomentsView() {
  const { trip, members, role, canEdit } = useTrip();
  const tripId = trip?.id ?? "";
  const { session } = useSession();
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const { moments, total, loading, error, hasMore, loadMore, refresh } = useMomentFeed(tripId);
  const { data: commentData, refresh: refreshComments } = useMomentComments(tripId);
  const [creating, setCreating] = useState(false);
  const [lightbox, setLightbox] = useState<{ photo: Photo; photos: Photo[] } | null>(null);

  const userId = session?.user?.id ?? null;

  // Los comentarios llegan en una sola consulta y se reparten por momento.
  const commentsByMoment = new Map<string, MomentComment[]>();
  for (const comment of commentData ?? []) {
    const list = commentsByMoment.get(comment.momentId) ?? [];
    list.push(comment);
    commentsByMoment.set(comment.momentId, list);
  }

  async function addComment(moment: Moment, body: string) {
    if (!trip || !userId) return;
    await momentCommentsRepo.create(
      getSupabaseBrowserClient(),
      trip.id,
      moment.id,
      userId,
      body,
    );
    await refreshComments();
  }

  async function removeComment(comment: MomentComment) {
    const ok = await confirm({
      title: "Eliminar comentario",
      body: "Se eliminará tu comentario. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    try {
      await momentCommentsRepo.remove(getSupabaseBrowserClient(), comment.id);
      await refreshComments();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function remove(moment: Moment) {
    const ok = await confirm({ title: "Eliminar momento", body: `Se eliminará “${moment.title}”. Las fotos se conservan en la galería.` });
    if (!ok) return;
    try {
      await momentsRepo.remove(getSupabaseBrowserClient(), moment.id);
      toast("Momento eliminado", "info");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  if (loading) return <LoadingState label="Cargando momentos…" />;

  return (
    <div className="app-page max-w-4xl space-y-6">
      <PageHeader
        title="Momentos"
        subtitle={
          // Mientras queden lotes se dice cuantos se ven de cuantos: sin eso,
          // en un viaje de cuarenta momentos pareceria que solo hay cinco.
          hasMore
            ? `${moments.length} de ${total} momentos`
            : "Los recuerdos que querrás releer dentro de años."
        }
        action={canEdit ? <Button onClick={() => setCreating(true)}>+ Momento</Button> : undefined}
      />

      {error && <ErrorState message={error} onRetry={() => void refresh()} />}

      {moments.length === 0 ? (
        <EmptyState
          icon={MomentIcon}
          title="Aún no hay momentos"
          description={
            canEdit
              ? "“Nuestro primer ramen”, “el atardecer en Kioto”… guarda lo que te importa."
              : "Todavía no hay momentos en este viaje."
          }
          action={canEdit ? <Button onClick={() => setCreating(true)}>Crear momento</Button> : undefined}
        />
      ) : (
        <ul className="space-y-1">
          {moments.map((moment) => (
            <li key={moment.id}>
              <MomentCard
                moment={moment}
                members={members}
                comments={commentsByMoment.get(moment.id) ?? []}
                currentUserId={userId}
                canDelete={canEdit && (moment.createdBy === userId || role === "owner")}
                onDelete={() => void remove(moment)}
                onOpenPhoto={(photo, photos) => setLightbox({ photo, photos })}
                onComment={(body) => addComment(moment, body)}
                onDeleteComment={(comment) => void removeComment(comment)}
              />
            </li>
          ))}
        </ul>
      )}

      {moments.length > 0 && (
        <LoadMore
          hasMore={hasMore}
          count={moments.length}
          onLoadMore={loadMore}
          label="Cargando más momentos…"
        />
      )}

      {creating && (
        <MomentModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      )}

      {lightbox && (
        <PhotoLightbox
          photo={lightbox.photo}
          photos={lightbox.photos}
          onNavigate={(photo) => setLightbox({ photo, photos: lightbox.photos })}
          onClose={() => setLightbox(null)}
        />
      )}
      {confirmDialog}
    </div>
  );
}

/** Objetivos que el modal de momento puede crear ademas del propio momento. */
const MOMENT_RELATED: readonly RelatedTarget[] = ["gallery", "expense"];

function MomentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { trip } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();
  const { data: photos } = usePhotos(trip?.id ?? "");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [rating, setRating] = useState<number | null>(null);
  const [tripPlace, setTripPlace] = useState<TripPlace | null>(null);
  const [location, setLocation] = useState<MemoryLocation | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [related, setRelated] = useState<RelatedDraft>(() =>
    emptyRelatedDraft({
      date: todayISO(),
      currency: trip?.baseCurrency ?? "EUR",
      paidBy: session?.user?.id ?? "",
    }),
  );

  /**
   * La foto que se comparte con la galeria / el gasto: la recien subida o, si
   * no se sube ninguna, la primera de las ya existentes que se hayan marcado.
   */
  const sharedExisting = file ? null : (photos ?? []).find((p) => p.id === selectedPhotos[0]) ?? null;
  const hasSharedPhoto = Boolean(file || sharedExisting);

  function togglePhoto(id: string) {
    setSelectedPhotos((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }

  async function save() {
    setError(null);
    if (title.trim().length < 2) return setError("Ponle un título al momento.");
    if (!trip || !session?.user) return;

    const relatedProblem = hasSharedPhoto ? validateRelatedDraft(related, MOMENT_RELATED) : null;
    if (relatedProblem) return setError(relatedProblem);

    setSaving(true);
    try {
      const db = getSupabaseBrowserClient();
      const ctx: RelatedContext = {
        tripId: trip.id,
        userId: session.user.id,
        baseCurrency: trip.baseCurrency,
      };

      // 1. Foto compartida: una sola subida y una sola fila `photos`.
      let shared: Photo | null = null;
      if (file) {
        shared = await ensureSharedPhoto(
          db,
          ctx,
          { kind: "file", file },
          photoMeta({
            description: title.trim() || null,
            tripPlace,
            location,
            inGallery: related.enabled.gallery,
          }),
        );
      } else if (sharedExisting) {
        // Ya existe en la galeria: se reutiliza tal cual, nunca se duplica.
        shared = await ensureSharedPhoto(
          db,
          ctx,
          { kind: "photo", photo: sharedExisting },
          photoMeta({ description: null, tripPlace, location, inGallery: related.enabled.gallery }),
        );
      }

      // 2. Momento con la foto nueva + las ya elegidas, sin repetir ids.
      const photoIds = [...new Set([...(shared ? [shared.id] : []), ...selectedPhotos])];
      await momentsRepo.create(db, trip.id, session.user.id, {
        title,
        description: description.trim() || null,
        date,
        rating,
        tripPlaceId: tripPlace?.id ?? null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        locationName: location?.name ?? null,
        placeId: location?.placeId ?? null,
        photoIds,
      });

      // 3. Gasto relacionado sobre esa MISMA foto (si se ha marcado).
      const extra = shared
        ? await createRelatedContent(db, ctx, [shared], related, MOMENT_RELATED)
        : { expense: null };

      const parts = ["Momento creado"];
      if (shared && file && related.enabled.gallery) parts.push("Foto en la galería");
      if (extra.expense) parts.push("Gasto creado");
      toast(parts.join(" · "));
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
        title="Nuevo momento"
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
          <Field label="Título" required>
            {(id) => (
              <TextInput
                id={id}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nuestro primer ramen"
                autoFocus
              />
            )}
          </Field>

          <Field label="Historia">
            {() => (
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Qué pasó, cómo os sentisteis…"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha">
              {(id) => (
                <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              )}
            </Field>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium ink-secondary">Valoración</span>
              <Rating value={rating} onChange={setRating} />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium ink-secondary">Lugar del viaje</span>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="w-full truncate rounded-xl border border-subtle px-3.5 py-2.5 text-left text-sm ink-primary hover:surface-2"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <PlaceIcon size={16} weight="fill" className="shrink-0 text-brand-500" aria-hidden />
                <span className="truncate">
                  {tripPlace ? tripPlace.place.name : "Elegir lugar…"}
                </span>
              </span>
            </button>
            <p className="text-xs ink-muted">Contexto general. La ubicación exacta va debajo.</p>
          </div>

          <MemoryLocationField
            value={location}
            onChange={setLocation}
            tripPlace={tripPlace}
            onPickTripPlace={setTripPlace}
            hint="Dónde ocurrió exactamente. Es lo que lo sitúa en el mapa de recuerdos."
          />

          <Field
            label="Subir una foto"
            hint="Opcional. Se sube una sola vez y podrás reutilizarla más abajo."
          >
            {(id) => (
              <input
                id={id}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 dark:file:bg-brand-900/40 dark:file:text-brand-200"
              />
            )}
          </Field>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium ink-secondary">
              O elegir fotos ya subidas {selectedPhotos.length > 0 && `(${selectedPhotos.length})`}
            </span>
            {(photos ?? []).length === 0 ? (
              <p className="text-sm ink-muted">Sube fotos a la galería para poder asociarlas.</p>
            ) : (
              <ul className="app-scroll-y grid max-h-64 grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6">
                {(photos ?? []).map((photo) => {
                  const active = selectedPhotos.includes(photo.id);
                  return (
                    <li key={photo.id}>
                      <button
                        type="button"
                        onClick={() => togglePhoto(photo.id)}
                        aria-pressed={active}
                        className={
                          "relative aspect-square w-full overflow-hidden rounded-lg ring-offset-2 " +
                          (active ? "ring-2 ring-brand-500" : "")
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
            )}
          </div>

          <RelatedContentSection
            offered={MOMENT_RELATED}
            draft={related}
            onChange={setRelated}
            context={{ tripPlace, date, description: title }}
            available={hasSharedPhoto}
            unavailableHint="Sube una foto o elige una existente para poder relacionar contenido."
          />

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
        title="Lugar del momento"
      />
    </>
  );
}
