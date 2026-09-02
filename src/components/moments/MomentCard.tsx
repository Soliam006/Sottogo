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
  StarIcon,
} from "@/components/ui/icons";
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
    <article id={`moment-${moment.id}`} className="pb-6 pt-5">
      {/* Cabecera: manda el LUGAR, no el autor.
          En un viaje el "donde" es el eje que ordena el recuerdo; quien lo
          subio es contexto. Es justo al reves que en un muro al uso, y es
          parte de lo que hace que esto sea un diario y no una corriente. */}
      <header className="flex items-center gap-3">
        <Avatar profile={author} size="sm" />
        <div className="min-w-0 flex-1">
          {place ? (
            <p className="flex min-w-0 items-center gap-1 text-sm font-semibold ink-primary">
              <PlaceIcon size={13} weight="fill" className="shrink-0 text-brand-500" aria-hidden />
              <span className="truncate">{place}</span>
            </p>
          ) : (
            <p className="truncate text-sm font-semibold ink-primary">
              {author?.name ?? "Alguien"}
            </p>
          )}
          <p className="truncate text-xs ink-muted">
            {place ? author?.name ?? "Alguien" : formatDate(moment.date, "long")}
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

      {/* La foto sale del margen de la pagina en movil: de borde a borde, sin
          marco que la encoja. A partir de `sm` vuelve dentro y se redondea, que
          es donde el recorte a sangre dejaria de tener sentido. */}
      <div className="-mx-5 mt-3 sm:mx-0 sm:overflow-hidden sm:rounded-lg">
        <PhotoCarousel
          photos={photos}
          title={moment.title}
          onOpen={(photo) => onOpenPhoto(photo, photos)}
        />
      </div>

      {/* Acciones a la izquierda, valoracion a la derecha. Sin "me gusta". */}
      <div className="mt-2 flex items-center gap-1">
        <button
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          className="-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ink-secondary transition-colors hover:surface-2"
        >
          <CommentIcon size={21} weight={commentsOpen ? "fill" : "regular"} aria-hidden />
          {comments.length > 0 && <span className="tabular-nums">{comments.length}</span>}
          <span className="sr-only">
            {commentsOpen ? "Ocultar comentarios" : "Ver comentarios"}
          </span>
        </button>

        <button
          onClick={() => void share()}
          disabled={sharing}
          aria-label="Compartir momento"
          className="rounded-lg px-2 py-1.5 ink-secondary transition-colors hover:surface-2 disabled:opacity-50"
        >
          <ShareIcon size={21} aria-hidden />
        </button>

        {/* La valoracion, compacta: cinco estrellas doradas a tamano completo
            eran lo mas ruidoso de la fila y le daban aire de juguete. Una
            estrella y el numero dicen lo mismo sin gritar. */}
        {moment.rating !== null && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-sm ink-secondary"
            aria-label={`Valoración: ${moment.rating} de 5`}
          >
            <StarIcon size={15} weight="fill" className="text-amber-400" aria-hidden />
            <span className="tabular-nums">
              {moment.rating}
              <span className="ink-muted">/5</span>
            </span>
          </span>
        )}
      </div>

      {/* Titulo y relato en lineas distintas. Antes se concatenaban con el
          nombre del autor y se leia como una sola frase. */}
      <div className="mt-1.5 space-y-1">
        <h3 className="text-[0.95rem] font-semibold leading-snug ink-primary">{moment.title}</h3>
        {moment.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed ink-secondary">
            {moment.description}
          </p>
        )}
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
