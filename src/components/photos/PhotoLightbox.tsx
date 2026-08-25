"use client";

import { useEffect } from "react";
import type { Photo, PublicProfile } from "@/core/models";
import { formatDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

export function PhotoLightbox({
  photo,
  photos,
  onNavigate,
  onClose,
  onToggleFeatured,
  onDelete,
  onCreateRelated,
  uploader,
}: {
  photo: Photo;
  photos: Photo[];
  onNavigate: (photo: Photo) => void;
  onClose: () => void;
  onToggleFeatured?: (photo: Photo) => void;
  onDelete?: (photo: Photo) => void;
  /** Crear un momento o un gasto reutilizando esta misma foto. */
  onCreateRelated?: (photo: Photo) => void;
  uploader?: PublicProfile | null;
}) {
  const index = photos.findIndex((p) => p.id === photo.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < photos.length - 1) onNavigate(photos[index + 1]);
      if (e.key === "ArrowLeft" && index > 0) onNavigate(photos[index - 1]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, photos, onNavigate, onClose]);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-black/92">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm text-white/70 tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 hover:bg-white/10">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4">
        {index > 0 && (
          <NavButton side="left" onClick={() => onNavigate(photos[index - 1])} />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url ?? photo.thumbUrl}
          alt={photo.description ?? "Foto del viaje"}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
        {index < photos.length - 1 && (
          <NavButton side="right" onClick={() => onNavigate(photos[index + 1])} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-white">
        <div className="min-w-0">
          {photo.description && <p className="truncate font-medium">{photo.description}</p>}
          <p className="flex items-center gap-2 text-sm text-white/60">
            {uploader && <Avatar profile={uploader} size="xs" />}
            {photo.tripPlace && <span>📍 {photo.tripPlace.place.name}</span>}
            <span>{formatDate(photo.takenAt ?? photo.createdAt, "long")}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {onCreateRelated && (
            <Button variant="secondary" size="sm" onClick={() => onCreateRelated(photo)}>
              📎 Hacer algo más
            </Button>
          )}
          {onToggleFeatured && (
            <Button variant="secondary" size="sm" onClick={() => onToggleFeatured(photo)}>
              {photo.featured ? "Quitar de destacadas" : "⭐ Destacar"}
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(photo)}>
              Eliminar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Anterior" : "Siguiente"}
      className={
        "absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur transition-colors hover:bg-white/20 " +
        (side === "left" ? "left-2" : "right-2")
      }
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={side === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
