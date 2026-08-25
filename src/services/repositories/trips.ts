import type { Trip, TripMember, UUID } from "@/core/models";
import { asRow, asRows, type Db, unwrap, unwrapVoid } from "./base";
import { toTrip, toTripMember } from "@/services/mappers";

export interface CreateTripInput {
  name: string;
  destination: string;
  countryCode?: string | null;
  startDate: string;
  endDate: string;
  baseCurrency: string;
  coverImage?: string | null;
}

const MEMBER_SELECT =
  "*, profile:profiles!trip_members_user_id_fkey(id,name,username,unique_code,avatar_url)";

export const tripsRepo = {
  /** Viajes propios + aquellos donde el usuario participa. */
  async listForUser(db: Db, userId: UUID): Promise<Trip[]> {
    const result = await db
      .from("trip_members")
      .select("trip:trips(*)")
      .eq("user_id", userId);

    return asRows(unwrap(result, "Listar viajes"))
      .map((row) => toTrip(asRow(row.trip)))
      .filter((trip) => trip.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  },

  async get(db: Db, tripId: UUID): Promise<Trip> {
    const result = await db.from("trips").select("*").eq("id", tripId).single();
    return toTrip(asRow(unwrap(result, "Cargar viaje")));
  },

  async create(db: Db, ownerId: UUID, input: CreateTripInput): Promise<Trip> {
    const result = await db
      .from("trips")
      .insert({
        owner_id: ownerId,
        name: input.name.trim(),
        destination: input.destination.trim(),
        country_code: input.countryCode ?? null,
        start_date: input.startDate,
        end_date: input.endDate,
        base_currency: input.baseCurrency,
        cover_image: input.coverImage ?? null,
      })
      .select("*")
      .single();

    return toTrip(asRow(unwrap(result, "Crear viaje")));
  },

  async update(db: Db, tripId: UUID, patch: Partial<CreateTripInput>): Promise<Trip> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name.trim();
    if (patch.destination !== undefined) payload.destination = patch.destination.trim();
    if (patch.countryCode !== undefined) payload.country_code = patch.countryCode;
    if (patch.startDate !== undefined) payload.start_date = patch.startDate;
    if (patch.endDate !== undefined) payload.end_date = patch.endDate;
    if (patch.baseCurrency !== undefined) payload.base_currency = patch.baseCurrency;
    if (patch.coverImage !== undefined) payload.cover_image = patch.coverImage;

    const result = await db.from("trips").update(payload).eq("id", tripId).select("*").single();
    return toTrip(asRow(unwrap(result, "Actualizar viaje")));
  },

  async remove(db: Db, tripId: UUID): Promise<void> {
    unwrapVoid(await db.from("trips").delete().eq("id", tripId), "Eliminar viaje");
  },

  async listMembers(db: Db, tripId: UUID): Promise<TripMember[]> {
    const result = await db
      .from("trip_members")
      .select(MEMBER_SELECT)
      .eq("trip_id", tripId)
      .order("joined_at", { ascending: true });

    return asRows(unwrap(result, "Listar participantes")).map(toTripMember);
  },

  async removeMember(db: Db, memberId: UUID): Promise<void> {
    unwrapVoid(
      await db.from("trip_members").delete().eq("id", memberId),
      "Eliminar participante",
    );
  },
};
