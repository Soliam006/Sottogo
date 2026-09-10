"use client";

import { useState } from "react";
import type { MomentComment, TripMember } from "@/core/models";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/components/providers/ToastProvider";
import { Avatar } from "@/components/ui/Avatar";
import { CloseIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Button";

/** Cuantos comentarios se ven sin desplegar. */
const PREVIEW = 2;

/**
 * Comentarios de un momento: plegados por defecto y desplegables.
 *
 * Con la lista cerrada se ven los ultimos {PREVIEW}; el enlace "Ver los N
 * comentarios" abre el resto y el campo para escribir. Asi el muro sigue siendo
 * un muro de fotos y no una pared de texto.
 */
export function MomentComments({
  comments,
  members,
  currentUserId,
  open,
  onToggle,
  onSubmit,
  onDelete,
}: {
  comments: MomentComment[];
  members: TripMember[];
  currentUserId: string | null;
  open: boolean;
  onToggle: () => void;
  onSubmit: (body: string) => Promise<void>;
  onDelete: (comment: MomentComment) => void;
}) {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const profileOf = (userId: string | null) =>
    members.find((m) => m.userId === userId)?.profile ?? null;

  /*
   * En los comentarios manda el usuario y no el nombre.
   *
   * Un nombre completo empuja el comentario a la linea de abajo, y encima se
   * repetia con el `@usuario` de la fecha: tres datos para decir quien habla.
   * El usuario es lo corto, lo unico y lo que se dicta para invitar a alguien.
   */
  const quienHabla = (userId: string | null) => profileOf(userId)?.username ?? "alguien";

  const hidden = Math.max(0, comments.length - PREVIEW);
  const visible = open ? comments : comments.slice(-PREVIEW);

  async function send() {
    const text = body.trim();
    if (text.length === 0 || sending) return;
    setSending(true);
    try {
      await onSubmit(text);
      setBody("");
    } catch (err) {
      toast(errorMessage(err, "No se ha podido publicar el comentario."), "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-4 pb-4">
      {!open && hidden > 0 && (
        <button
          onClick={onToggle}
          className="mt-1 text-sm ink-muted transition-colors hover:ink-secondary"
        >
          Ver los {comments.length} comentarios
        </button>
      )}

      {visible.length > 0 && (
        <ul className={open ? "mt-3 space-y-3" : "mt-2 space-y-2"}>
          {visible.map((comment) => {
            const profile = profileOf(comment.authorId);
            const mine = comment.authorId !== null && comment.authorId === currentUserId;

            // Plegado: una linea por comentario, como un pie de foto. Con la
            // cara delante: un usuario en minusculas cuesta de reconocer de un
            // vistazo, y la foto se lee antes que cualquier texto.
            if (!open) {
              return (
                <li key={comment.id} className="flex min-w-0 items-center gap-2 text-sm ink-secondary">
                  <Avatar profile={profile} size="xs" className="shrink-0" />
                  <span className="min-w-0 truncate">
                    <span className="font-semibold ink-primary">
                      {quienHabla(comment.authorId)}
                    </span>{" "}
                    {comment.body}
                  </span>
                </li>
              );
            }

            return (
              <li key={comment.id} className="group flex items-start gap-2.5">
                <Avatar profile={profile} size="xs" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug ink-secondary">
                    <span className="font-semibold ink-primary">
                      {quienHabla(comment.authorId)}
                    </span>{" "}
                    <span className="whitespace-pre-line">{comment.body}</span>
                  </p>
                  {/* Cuanto hace, no el dia exacto: en un hilo lo que importa
                      es si algo es de hace un rato o de hace meses. La fecha
                      completa sigue ahi, al pasar el raton. */}
                  <p
                    className="mt-0.5 text-[11px] ink-muted"
                    title={formatDate(comment.createdAt, "long")}
                  >
                    {formatRelativeTime(comment.createdAt)}
                  </p>
                </div>
                {mine && (
                  <button
                    onClick={() => onDelete(comment)}
                    aria-label="Eliminar comentario"
                    className="shrink-0 rounded-lg p-1 ink-muted transition-opacity hover:text-rose-600 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <CloseIcon size={13} weight="bold" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <>
          {comments.length === 0 && (
            <p className="mt-3 text-sm ink-muted">
              Todavía no hay comentarios. Escribe el primero.
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="mt-3 flex items-center gap-2 rounded-xl border border-subtle px-3 py-1.5 focus-within:border-brand-500"
          >
            <Avatar profile={profileOf(currentUserId)} size="xs" />
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Añade un comentario…"
              maxLength={1000}
              aria-label="Añade un comentario"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm ink-primary outline-none placeholder:text-[var(--text-muted)]"
            />
            <button
              type="submit"
              disabled={body.trim().length === 0 || sending}
              className="shrink-0 text-sm font-semibold text-brand-600 transition-opacity disabled:opacity-40 dark:text-brand-400"
            >
              {sending ? <Spinner className="h-4 w-4" /> : "Publicar"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
