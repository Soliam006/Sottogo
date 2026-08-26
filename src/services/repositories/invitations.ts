import type { PublicProfile, TripInvitation, TripRole, UUID } from "@/core/models";
import { parseHandle } from "@/core/identity/handle";
import { asRow, asRows, type Db, RepositoryError, unwrap, unwrapVoid } from "./base";
import { toInvitation, toProfile } from "@/services/mappers";

const INVITATION_SELECT = `
  *,
  trip:trips(id,name,destination,start_date,end_date,cover_image),
  sender:profiles!trip_invitations_sender_id_fkey(id,name,username,unique_code,avatar_url),
  receiver:profiles!trip_invitations_receiver_id_fkey(id,name,username,unique_code,avatar_url)
`;

export const invitationsRepo = {
  /** Busca un usuario por su identificador publico `Nombre#Codigo`. */
  async findByHandle(db: Db, handle: string): Promise<PublicProfile | null> {
    const parsed = parseHandle(handle);
    if (!parsed) {
      throw new RepositoryError("Formato no válido. Usa Nombre#0000 (por ejemplo Mei#7314).");
    }

    const result = await db.rpc("find_profile_by_handle", {
      p_name: parsed.name,
      p_code: parsed.code,
    });

    if (result.error) throw new RepositoryError(result.error.message, result.error);

    const rows = asRows(result.data);
    return rows.length ? toProfile(rows[0]) : null;
  },

  /**
   * Envia una invitacion con el rol elegido. Por defecto `member`, que es como
   * se comportaba antes de existir los visitantes.
   */
  async invite(
    db: Db,
    tripId: UUID,
    senderId: UUID,
    receiverId: UUID,
    role: TripRole = "member",
  ): Promise<TripInvitation> {
    const result = await db
      .from("trip_invitations")
      .insert({ trip_id: tripId, sender_id: senderId, receiver_id: receiverId, role })
      .select(INVITATION_SELECT)
      .single();

    return toInvitation(asRow(unwrap(result, "Enviar invitación")));
  },

  /** Invitaciones pendientes recibidas: alimentan las notificaciones in-app. */
  async listIncoming(db: Db, userId: UUID): Promise<TripInvitation[]> {
    const result = await db
      .from("trip_invitations")
      .select(INVITATION_SELECT)
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    return asRows(unwrap(result, "Listar invitaciones")).map(toInvitation);
  },

  async listForTrip(db: Db, tripId: UUID): Promise<TripInvitation[]> {
    const result = await db
      .from("trip_invitations")
      .select(INVITATION_SELECT)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    return asRows(unwrap(result, "Listar invitaciones del viaje")).map(toInvitation);
  },

  async respond(db: Db, invitationId: UUID, accept: boolean): Promise<void> {
    const result = await db.rpc("respond_to_invitation", {
      p_invitation: invitationId,
      p_accept: accept,
    });
    if (result.error) throw new RepositoryError(result.error.message, result.error);
  },

  async cancel(db: Db, invitationId: UUID): Promise<void> {
    unwrapVoid(
      await db
        .from("trip_invitations")
        .update({ status: "cancelled", responded_at: new Date().toISOString() })
        .eq("id", invitationId),
      "Cancelar invitación",
    );
  },
};
