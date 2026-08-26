import type { MomentComment, UUID } from "@/core/models";
import { asRow, asRows, type Db, unwrap, unwrapVoid } from "./base";
import { toMomentComment } from "@/services/mappers";

/**
 * Comentarios de los momentos.
 *
 * Se leen de una vez para todo el viaje y la vista los agrupa por momento: es
 * una sola consulta y una sola suscripcion en vez de una por tarjeta.
 */
export const momentCommentsRepo = {
  async listByTrip(db: Db, tripId: UUID): Promise<MomentComment[]> {
    const result = await db
      .from("moment_comments")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });

    return asRows(unwrap(result, "Listar comentarios")).map(toMomentComment);
  },

  async create(
    db: Db,
    tripId: UUID,
    momentId: UUID,
    authorId: UUID,
    body: string,
  ): Promise<MomentComment> {
    const result = await db
      .from("moment_comments")
      .insert({ trip_id: tripId, moment_id: momentId, author_id: authorId, body: body.trim() })
      .select("*")
      .single();

    return toMomentComment(asRow(unwrap(result, "Publicar comentario")));
  },

  async remove(db: Db, id: UUID): Promise<void> {
    unwrapVoid(
      await db.from("moment_comments").delete().eq("id", id),
      "Eliminar comentario",
    );
  },
};
