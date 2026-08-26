"use client";

import { useEffect, useRef, useState } from "react";
import type { Moment, MomentComment, Photo, PublicProfile, TripMember } from "@/core/models";
import { formatDate } from "@/lib/format";
import { shareContent } from "@/lib/share";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/providers/ToastProvider";
import { Avatar } from "@/components/ui/Avatar";
import {
  CommentIcon,
  DeleteIcon,
  ImageIcon,
  MoreIcon,
  NextIcon,
  PlaceIcon,
  PrevIcon,
  ShareIcon,
} from "@/components/ui/icons";
import { Rating } from "@/components/ui/Misc";
import { MomentComments } from "./MomentComments";

/**
 * Un momento en el muro.
 *
 * La foto manda: ocupa el ancho completo de la tarjeta, sin margenes, y todo lo
 * demas se apoya debajo. No hay "me gusta" a proposito; las dos acciones son
 * comentar y compartir.
 */
export function MomentCard({
  moment,
  members,
  comments,
  currentUserId,
  canDelete,
  onDelete,
  onOpenPhoto,
  onComment,
  onDeleteComment,
}: {
  moment: Moment;
  members: TripMember[];
  comments: MomentComment[];
  currentUserId: string | null;
  canDelete: boolean;
  onDelete: () => void;
  onOpenPhoto: (photo: Photo, photos: Photo[]) => void;
  onComment: (body: string) => Promise<void>;
  onDeleteComment: (comment: MomentComment) => void;
}) {
  const photos = moment.photos ?? [];
  const author: PublicProfile | null =
    members.find((m) => m.userId === moment.createdBy)?.profile ?? null;

  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const place = moment.locationName ?? moment.tripPlace?.place.name ?? null;

  async function share() {
    setSharing(true);
    const url = `${window.location.origin}${window.location.pathname}#moment-${moment.id}`;
    const outcome = await shareContent({
      title: moment.title,
      text: [moment.description, place].filter(Boolean).join(" · ") || undefined,
      url,
    });
    setSharing(false);

    // `shared` y `cancelled` ya se explican solos en la hoja del sistema; los
    // otros dos casos, no: sin aviso el boton pareceria roto.
    if (outcome === "copied") toast("Enlace copiado");
    if (outcome === "unavailable") {
      toast("No se ha podido compartir. Copia la dirección desde el navegador.", "error");
    }
  }

  return (
    <article
      id={`moment-${moment.id}`}
      className="overflow-hidden max-w-full xl:max-w-[800px] rounded-xl border border-subtle surface-1 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
    >
      {/* Cabecera */}
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar profile={author} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold ink-primary">
            {author?.name ?? "Alguien"}
          </p>
          <p className="flex items-center gap-1 truncate text-xs ink-muted">
            <span>{formatDate(moment.date, "long")}</span>
            {place && (
              <>
                <span aria-hidden>·</span>
                <PlaceIcon size={12} weight="fill" className="shrink-0" aria-hidden />
                <span className="truncate">{place}</span>
              </>
            )}
          </p>
        </div>

        {canDelete && (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Opciones del momento"
              aria-expanded={menuOpen}
              className="rounded-lg p-1.5 ink-muted transition-colors hover:surface-2"
            >
              <MoreIcon size={20} weight="bold" aria-hidden />
            </button>
            {menuOpen && (
              <>
                {/* Capa para cerrar al pulsar fuera. */}
                <button
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Cerrar menú"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-10 z-20 w-44 animate-rise overflow-hidden rounded-xl border border-subtle surface-1 shadow-xl">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-rose-600 transition-colors hover:surface-2 dark:text-rose-400"
                  >
                    <DeleteIcon size={16} aria-hidden />
                    Eliminar momento
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* La foto, a sangre */}
      <PhotoCarousel
        photos={photos}
        title={moment.title}
        onOpen={(photo) => onOpenPhoto(photo, photos)}
      />

      {/* Acciones: comentar y compartir. Sin "me gusta". */}
      <div className="flex items-center gap-1 px-2 pt-2">
        <button
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm ink-secondary transition-colors hover:surface-2"
        >
          <CommentIcon size={22} weight={commentsOpen ? "fill" : "regular"} aria-hidden />
          {comments.length > 0 && (
            <span className="tabular-nums">{comments.length}</span>
          )}
          <span className="sr-only">
            {commentsOpen ? "Ocultar comentarios" : "Ver comentarios"}
          </span>
        </button>

        <button
          onClick={() => void share()}
          disabled={sharing}
          aria-label="Compartir momento"
          className="rounded-lg px-2 py-2 ink-secondary transition-colors hover:surface-2 disabled:opacity-50"
        >
          <ShareIcon size={22} aria-hidden />
        </button>
      </div>

      {/* Texto */}
      <div className="space-y-1.5 px-4 pb-1 pt-1">
        <p className="text-sm leading-relaxed ink-primary">
          <span className="font-semibold">{author?.name ?? "Alguien"}</span>{" "}
          <span className="font-semibold">{moment.title}</span>
        </p>
        {moment.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed ink-secondary">
            {moment.description}
          </p>
        )}
        {moment.rating !== null && <Rating value={moment.rating} readOnly />}
      </div>

      <MomentComments
        comments={comments}
        members={members}
        currentUserId={currentUserId}
        open={commentsOpen}
        onToggle={() => setCommentsOpen((v) => !v)}
        onSubmit={onComment}
        onDelete={onDeleteComment}
      />
    </article>
  );
}

/**
 * Carrusel de fotos con scroll-snap nativo: en movil se pasa con el dedo y
 * hereda el desplazamiento suave del sistema; en escritorio hay flechas.
 */
function PhotoCarousel({
  photos,
  title,
  onOpen,
}: {
  photos: Photo[];
  title: string;
  onOpen: (photo: Photo) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  // El indice sale de la posicion real del scroll, no de un estado paralelo:
  // asi el contador acierta tambien cuando se desliza con el dedo.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const width = track.clientWidth || 1;
      setIndex(Math.round(track.scrollLeft / width));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  function go(delta: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: (index + delta) * track.clientWidth, behavior: "smooth" });
  }

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center surface-2">
        <ImageIcon size={40} weight="duotone" className="ink-muted" aria-hidden />
      </div>
    );
  }

  return (
    <div className="group relative">
      <div
        ref={trackRef}
        className="app-scroll-x no-scrollbar flex snap-x snap-mandatory"
        aria-label={`Fotos de ${title}`}
      >
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => onOpen(photo)}
            className="aspect-[4/3] w-full shrink-0 snap-center surface-2"
            aria-label={photo.description || "Ampliar foto"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url ?? photo.thumbUrl}
              alt={photo.description ?? ""}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium tabular-nums text-white backdrop-blur">
            {index + 1}/{photos.length}
          </span>

          {/* Flechas solo con raton: en tactil sobra con deslizar. */}
          {index > 0 && <Arrow side="left" onClick={() => go(-1)} />}
          {index < photos.length - 1 && <Arrow side="right" onClick={() => go(1)} />}

          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {photos.map((photo, i) => (
              <span
                key={photo.id}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/50",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Glyph = side === "left" ? PrevIcon : NextIcon;
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Foto anterior" : "Foto siguiente"}
      className={cn(
        "absolute top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white",
        "opacity-0 backdrop-blur transition-opacity hover:bg-black/70 group-hover:opacity-100",
        "focus-visible:opacity-100 lg:block",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Glyph size={18} weight="bold" aria-hidden />
    </button>
  );
}
