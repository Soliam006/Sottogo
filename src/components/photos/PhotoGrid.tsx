"use client";

import type { Photo } from "@/core/models";
import { cn } from "@/lib/cn";

export function PhotoTile({
  photo,
  onClick,
  className,
}: {
  photo: Photo;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative aspect-square w-full overflow-hidden rounded-xl surface-2",
        className,
      )}
    >
      {photo.thumbUrl || photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.thumbUrl ?? photo.url}
          alt={photo.description ?? "Foto del viaje"}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-2xl" aria-hidden>🖼️</span>
      )}

      {photo.featured && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white backdrop-blur">
          ⭐
        </span>
      )}

      {photo.tripPlace && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[10px] font-medium text-white">
          📍 {photo.tripPlace.place.name}
        </span>
      )}
    </button>
  );
}

export function PhotoGrid({
  photos,
  onSelect,
  columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
}: {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  columns?: string;
}) {
  return (
    <ul className={cn("grid gap-2", columns)}>
      {photos.map((photo) => (
        <li key={photo.id}>
          <PhotoTile photo={photo} onClick={() => onSelect(photo)} />
        </li>
      ))}
    </ul>
  );
}
