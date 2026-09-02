"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Photo } from "@/core/models";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { photosRepo } from "@/services/repositories";
import { removePhotoFiles } from "@/services/storage/photoStorage";
import { useTrip } from "@/components/providers/TripProvider";
import { usePhotoFeed } from "@/hooks/usePhotoFeed";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Spinner } from "@/components/ui/Button";
import { GalleryIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/Misc";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoLightbox } from "./PhotoLightbox";
import { UploadPhotoModal } from "./UploadPhotoModal";
import { RelatedFromPhotoModal } from "@/components/content/RelatedFromPhotoModal";

type GroupBy = "date" | "place" | "person";
/** Que fotos se listan: solo las de galeria o todas las del viaje. */
type Scope = "gallery" | "all";

export function GalleryView() {
  const { trip, members, canEdit } = useTrip();
  const tripId = trip?.id ?? "";
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [scope, setScope] = useState<Scope>("gallery");
  const feed = usePhotoFeed(tripId, scope === "gallery");
  const { photos, totals, loading, error, hasMore, loadMore, refresh } = feed;
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [relating, setRelating] = useState<Photo | null>(null);

  // La galeria muestra solo las fotos marcadas como tal. Las que nacen como
  // ticket de un gasto o adjunto de un momento siguen existiendo (y se ven en
  // su gasto / momento y en el mapa), pero no llenan la galeria salvo que se
  // haya pedido explicitamente. «Todas» las deja alcanzables para poder
  // promocionarlas o crear contenido desde ellas mas adelante.
  //
  // El recorte ya viene hecho de la consulta: aqui no se filtra nada.
  const hiddenCount = totals.all - totals.gallery;
  const total = scope === "all" ? totals.all : totals.gallery;

  // Centinela al final de la cuadricula.
  //
  // Sin `rootMargin`: el siguiente lote se pide cuando el centinela entra de
  // verdad en pantalla, es decir al llegar al final de las fotos que ya hay.
  // Con margen se adelantaba y cargaba cosas que aun no se veian, que es
  // trabajo (y trafico) que quiza nadie iba a mirar.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, photos.length]);

  const groups = useMemo(() => {
    const map = new Map<string, Photo[]>();

    for (const photo of photos) {
      let key: string;
      if (groupBy === "place") {
        key = photo.tripPlace ? photo.tripPlace.place.name : "Sin ubicación";
      } else if (groupBy === "person") {
        key = members.find((m) => m.userId === photo.uploadedBy)?.profile.name ?? "Desconocido";
      } else {
        key = (photo.takenAt ?? photo.createdAt).slice(0, 10);
      }
      const list = map.get(key) ?? [];
      list.push(photo);
      map.set(key, list);
    }

    return [...map.entries()].sort((a, b) =>
      groupBy === "date" ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]),
    );
  }, [photos, groupBy, members]);

  async function toggleFeatured(photo: Photo) {
    try {
      await photosRepo.update(getSupabaseBrowserClient(), photo.id, { featured: !photo.featured });
      setSelected((current) =>
        current && current.id === photo.id ? { ...current, featured: !photo.featured } : current,
      );
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function remove(photo: Photo) {
    const ok = await confirm({
      title: "Eliminar foto",
      body: "La foto se borrará del viaje y del almacenamiento. Esta acción no se puede deshacer.",
    });
    if (!ok) return;

    try {
      const db = getSupabaseBrowserClient();
      await photosRepo.remove(db, photo.id);
      await removePhotoFiles(db, photo);
      setSelected(null);
      toast("Foto eliminada", "info");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  if (loading) return <LoadingState label="Cargando galería…" />;

  return (
    <div className="app-page max-w-6xl space-y-6">
      <PageHeader
        title="Galería"
        subtitle={
          // Mientras queden lotes por traer se dice cuantas se ven de cuantas:
          // sin eso, "24 recuerdos" en un viaje de 300 fotos seria enganoso.
          hasMore
            ? `${photos.length} de ${total} recuerdos`
            : `${total} recuerdo${total === 1 ? "" : "s"} compartido${total === 1 ? "" : "s"}`
        }
        action={canEdit ? <Button onClick={() => setUploading(true)}>+ Foto</Button> : undefined}
      />

      {error && <ErrorState message={error} onRetry={() => void refresh()} />}

      {photos.length === 0 ? (
        <EmptyState
          icon={GalleryIcon}
          title="La galería está vacía"
          description={
            hiddenCount > 0
              ? `Hay ${hiddenCount} foto${hiddenCount === 1 ? "" : "s"} en gastos y momentos que aún no están en la galería.`
              : canEdit
                ? "Sube las primeras fotos y asígnales un lugar para verlas en el mapa."
                : "Todavía no hay fotos en este viaje."
          }
          action={
            hiddenCount > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {canEdit && <Button onClick={() => setUploading(true)}>Subir fotos</Button>}
                <Button variant="secondary" onClick={() => setScope("all")}>
                  Ver todas las fotos
                </Button>
              </div>
            ) : (
              canEdit ? <Button onClick={() => setUploading(true)}>Subir fotos</Button> : undefined
            )
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<GroupBy>
              value={groupBy}
              onChange={setGroupBy}
              options={[
                { value: "date", label: "Por fecha" },
                { value: "place", label: "Por lugar" },
                { value: "person", label: "Por persona" },
              ]}
            />
            {hiddenCount > 0 && (
              <SegmentedControl<Scope>
                value={scope}
                onChange={setScope}
                options={[
                  { value: "gallery", label: "Galería" },
                  { value: "all", label: "Todas", count: totals.all },
                ]}
              />
            )}
          </div>

          <div className="space-y-2">
            {groups.map(([key, items]) => (
              <section key={key}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide ink-muted">
                  {groupBy === "date" ? formatDate(key, "day") : key}
                  <span className="ml-2 font-normal normal-case">({items.length})</span>
                </h2>
                <PhotoGrid photos={items} onSelect={setSelected} />
              </section>
            ))}
          </div>

          {/* El centinela vive fuera de la cuadricula: si estuviera dentro de
              un grupo, cambiar de agrupacion lo desmontaria y el observador
              dejaria de disparar. */}
          {/* Llegar hasta aqui es lo que pide el lote siguiente, asi que se
              ensena la rueda directamente: entre que el centinela aparece y
              empieza la carga no hay hueco que merezca otro estado. */}
          {hasMore && (
            <div
              ref={sentinel}
              className="flex items-center justify-center gap-2 py-8 ink-muted"
              role="status"
              aria-live="polite"
            >
              <Spinner className="h-5 w-5" />
              <span className="text-sm">Cargando más fotos…</span>
            </div>
          )}
        </>
      )}

      <UploadPhotoModal
        open={uploading}
        onClose={() => setUploading(false)}
        onUploaded={() => void refresh()}
      />

      {selected && (
        <PhotoLightbox
          photo={selected}
          photos={photos}
          onNavigate={setSelected}
          onClose={() => setSelected(null)}
          onToggleFeatured={canEdit ? (p) => void toggleFeatured(p) : undefined}
          onDelete={canEdit ? (p) => void remove(p) : undefined}
          onCreateRelated={canEdit ? setRelating : undefined}
          uploader={members.find((m) => m.userId === selected.uploadedBy)?.profile ?? null}
        />
      )}
      {relating && (
        <RelatedFromPhotoModal
          photo={relating}
          onClose={() => setRelating(null)}
          onDone={() => void refresh()}
        />
      )}
      {confirmDialog}
    </div>
  );
}
