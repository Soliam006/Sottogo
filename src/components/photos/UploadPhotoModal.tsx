"use client";

import { useEffect, useState } from "react";
import type { Photo, TripPlace } from "@/core/models";
import type { MemoryLocation } from "@/core/map/location";
import { todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { photosRepo } from "@/services/repositories";
import { uploadPhotoFile } from "@/services/storage/photoStorage";
import {
  createRelatedContent,
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
import { useToast } from "@/components/providers/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { PlacePicker } from "@/components/places/PlacePicker";
import { MemoryLocationField } from "@/components/map/MemoryLocationField";
import { RelatedContentSection } from "@/components/content/RelatedContentSection";

/** Lo que este modal puede crear ademas de las propias fotos. */
const PHOTO_RELATED: readonly RelatedTarget[] = ["moment", "expense"];

/**
 * Subida de fotos. La ubicacion puede venir de un lugar del viaje, de una
 * busqueda real o de un punto del mapa: en los tres casos la foto queda
 * geolocalizada y aparece en el modo 📸 Fotos del mapa.
 */
export function UploadPhotoModal({
  open,
  onClose,
  onUploaded,
  defaultTripPlace = null,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (photos: Photo[]) => void;
  defaultTripPlace?: TripPlace | null;
}) {
  const { trip } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();

  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [tripPlace, setTripPlace] = useState<TripPlace | null>(defaultTripPlace);
  const [location, setLocation] = useState<MemoryLocation | null>(null);
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [related, setRelated] = useState<RelatedDraft>(() =>
    emptyRelatedDraft({
      date: todayISO(),
      currency: trip?.baseCurrency ?? "EUR",
      paidBy: session?.user?.id ?? "",
    }),
  );

  useEffect(() => {
    if (open) setTripPlace(defaultTripPlace);
  }, [open, defaultTripPlace]);

  // Solo al abrir: `trip` cambia con cada refresco en tiempo real y no debe
  // borrar lo que el usuario esté escribiendo.
  useEffect(() => {
    if (!open) return;
    setRelated(
      emptyRelatedDraft({
        date: todayISO(),
        currency: trip?.baseCurrency ?? "EUR",
        paidBy: session?.user?.id ?? "",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // La fecha del archivo se propone al momento/gasto relacionados.
  const shotDate = files[0]?.lastModified
    ? new Date(files[0].lastModified).toISOString().slice(0, 10)
    : undefined;

  function reset() {
    setFiles([]);
    setDescription("");
    setTripPlace(null);
    setLocation(null);
    setProgress(null);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!files.length) return setError("Selecciona al menos una imagen.");
    if (!trip || !session?.user) return;

    const relatedProblem = validateRelatedDraft(related, PHOTO_RELATED);
    if (relatedProblem) return setError(relatedProblem);

    setProgress({ done: 0, total: files.length });
    const uploaded: Photo[] = [];

    try {
      const db = getSupabaseBrowserClient();
      for (const [index, file] of files.entries()) {
        const upload = await uploadPhotoFile(db, trip.id, file);
        const photo = await photosRepo.create(db, trip.id, session.user.id, upload, {
          description: description.trim() || null,
          tripPlaceId: tripPlace?.id ?? null,
          // La ubicacion exacta manda; si no la hay, se hereda la del lugar.
          latitude: location?.latitude ?? tripPlace?.place.latitude ?? null,
          longitude: location?.longitude ?? tripPlace?.place.longitude ?? null,
          locationName: location?.name ?? null,
          placeId: location?.placeId ?? null,
          inGallery: true,
        });
        uploaded.push(photo);
        setProgress({ done: index + 1, total: files.length });
      }

      // Contenido relacionado sobre las fotos ya subidas: no se vuelve a subir
      // nada. El momento las enlaza todas; el gasto usa la primera.
      const ctx: RelatedContext = {
        tripId: trip.id,
        userId: session.user.id,
        baseCurrency: trip.baseCurrency,
      };
      const extra = await createRelatedContent(db, ctx, uploaded, related, PHOTO_RELATED);

      const parts = [
        `📸 ${uploaded.length} foto${uploaded.length === 1 ? "" : "s"} subida${uploaded.length === 1 ? "" : "s"}`,
      ];
      if (extra.moment) parts.push("✨ Momento creado");
      if (extra.expense) parts.push("💰 Gasto creado");
      toast(parts.join(" · "));

      onUploaded(uploaded);
      reset();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "No se han podido subir las fotos."));
      setProgress(null);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Añadir fotos"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={Boolean(progress)}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} loading={Boolean(progress)}>
              {progress ? `Subiendo ${progress.done}/${progress.total}…` : "Subir"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Imágenes" required hint="Puedes seleccionar varias a la vez. Máximo 15 MB por foto.">
            {(id) => (
              <input
                id={id}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-sm ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 dark:file:bg-brand-900/40 dark:file:text-brand-200"
              />
            )}
          </Field>

          {files.length > 0 && (
            <p className="text-sm ink-muted">
              {files.length} archivo{files.length === 1 ? "" : "s"} seleccionado
              {files.length === 1 ? "" : "s"}.
            </p>
          )}

          <div className="space-y-1.5">
            <span className="block text-sm font-medium ink-secondary">Lugar</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex-1 truncate rounded-xl border border-subtle px-3.5 py-2.5 text-left text-sm ink-primary hover:surface-2"
              >
                {tripPlace ? `📍 ${tripPlace.place.name}` : "📍 Elegir lugar…"}
              </button>
              {tripPlace && (
                <Button variant="ghost" size="sm" onClick={() => setTripPlace(null)}>
                  Quitar
                </Button>
              )}
            </div>
            <p className="text-xs ink-muted">
              Contexto general del viaje. La ubicación exacta va debajo.
            </p>
          </div>

          <MemoryLocationField
            value={location}
            onChange={setLocation}
            tripPlace={tripPlace}
            onPickTripPlace={setTripPlace}
            hint="Dónde se tomó exactamente. Es lo que la sitúa en el mapa de recuerdos."
          />

          <Field label="Descripción (opcional)">
            {(id) => (
              <TextInput
                id={id}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Akihabara de noche"
                maxLength={140}
              />
            )}
          </Field>

          <RelatedContentSection
            offered={PHOTO_RELATED}
            draft={related}
            onChange={setRelated}
            context={{ tripPlace, description, date: shotDate }}
            available={files.length > 0}
            title="✨ Crear contenido relacionado"
            unavailableHint="Selecciona una imagen para poder crear un momento o un gasto con ella."
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
        title="Ubicación de la foto"
      />
    </>
  );
}
