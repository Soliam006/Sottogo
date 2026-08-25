"use client";

import { useState } from "react";
import type { Photo } from "@/core/models";
import { todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import {
  createRelatedContent,
  ensureSharedPhoto,
  photoMeta,
  type RelatedContext,
} from "@/services/content/relatedContent";
import {
  contextFromPhoto,
  emptyRelatedDraft,
  hasRelatedWork,
  validateRelatedDraft,
  type RelatedDraft,
  type RelatedTarget,
} from "@/core/content/related";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { RelatedContentSection } from "./RelatedContentSection";

/**
 * Crear contenido a partir de una Photo QUE YA EXISTE.
 *
 * Es el camino "a posteriori" del recurso compartido: la fila `photos` y su
 * archivo no se tocan, solo se anaden referencias (`moment_photos`,
 * `expenses.photo_id`). Nunca se sube nada aqui.
 */
export function RelatedFromPhotoModal({
  photo,
  onClose,
  onDone,
}: {
  photo: Photo;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { trip } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();

  // La galeria solo se ofrece si la foto aun no esta en ella.
  const offered: readonly RelatedTarget[] = photo.inGallery
    ? ["moment", "expense"]
    : ["gallery", "moment", "expense"];

  const photoContext = contextFromPhoto(photo);

  const [draft, setDraft] = useState<RelatedDraft>(() =>
    emptyRelatedDraft({
      // La foto manda: su fecha y su lugar se proponen al momento y al gasto.
      date: photoContext.date ?? todayISO(),
      currency: trip?.baseCurrency ?? "EUR",
      paidBy: session?.user?.id ?? "",
      tripPlace: photoContext.tripPlace,
      description: photo.description ?? "",
    }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!trip || !session?.user) return;

    if (!hasRelatedWork(draft, offered)) {
      return setError("Marca al menos una opción.");
    }
    const problem = validateRelatedDraft(draft, offered);
    if (problem) return setError(problem);

    setSaving(true);
    try {
      const db = getSupabaseBrowserClient();
      const ctx: RelatedContext = {
        tripId: trip.id,
        userId: session.user.id,
        baseCurrency: trip.baseCurrency,
      };

      // Reutiliza la Photo existente. Como mucho la promociona a la galeria.
      const shared = await ensureSharedPhoto(
        db,
        ctx,
        { kind: "photo", photo },
        photoMeta({
          description: photo.description,
          tripPlace: photo.tripPlace ?? null,
          inGallery: draft.enabled.gallery || photo.inGallery,
        }),
      );

      const extra = await createRelatedContent(db, ctx, [shared], draft, offered);

      const parts: string[] = [];
      if (!photo.inGallery && draft.enabled.gallery) parts.push("📸 Foto en la galería");
      if (extra.moment) parts.push("✨ Momento creado");
      if (extra.expense) parts.push("💰 Gasto creado");
      toast(parts.join(" · "));

      onDone?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "No se ha podido crear el contenido."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Hacer algo más con esta foto"
      description="Se reutiliza la misma imagen: no se sube de nuevo."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Crear
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl surface-2 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbUrl ?? photo.url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium ink-primary">
              {photo.description || "Foto del viaje"}
            </p>
            <p className="truncate text-xs ink-muted">
              {photo.tripPlace ? `📍 ${photo.tripPlace.place.name} · ` : ""}
              {photoContext.date}
            </p>
          </div>
        </div>

        <RelatedContentSection
          offered={offered}
          draft={draft}
          onChange={setDraft}
          context={{}}
          available
          title="¿Qué quieres crear?"
        />

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
  );
}
