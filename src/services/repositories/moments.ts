import type { Moment, UUID } from "@/core/models";
import { asRow, asRows, type Db, unwrap, unwrapVoid } from "./base";
import { toMoment } from "@/services/mappers";

const SELECT = `
  *,
  trip_place:trip_places(*, place:places(*)),
  moment_photos(photo:photos(*))
`;

export interface MomentInput {
  title: string;
  description: string | null;
  date: string;
  rating: number | null;
  /** Lugar del itinerario (contexto general). Opcional. */
  tripPlaceId: UUID | null;
  /** Ubicacion EXACTA donde ocurrio. Independiente de tripPlaceId. */
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  placeId?: UUID | null;
  photoIds: UUID[];
}

export const momentsRepo = {
  async listByTrip(db: Db, tripId: UUID): Promise<Moment[]> {
    const result = await db
      .from("moments")
      .select(SELECT)
      .eq("trip_id", tripId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    return asRows(unwrap(result, "Listar momentos")).map(toMoment);
  },

  async create(db: Db, tripId: UUID, userId: UUID, input: MomentInput): Promise<Moment> {
    const created = await db
      .from("moments")
      .insert({
        trip_id: tripId,
        created_by: userId,
        title: input.title.trim(),
        description: input.description,
        date: input.date,
        rating: input.rating,
        trip_place_id: input.tripPlaceId,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        location_name: input.locationName ?? null,
        place_id: input.placeId ?? null,
      })
      .select("id")
      .single();

    const momentId = String(asRow(unwrap(created, "Crear momento")).id);

    if (input.photoIds.length) {
      unwrapVoid(
        await db
          .from("moment_photos")
          .insert(input.photoIds.map((photoId) => ({ moment_id: momentId, photo_id: photoId }))),
        "Asociar fotos al momento",
      );
    }

    const result = await db.from("moments").select(SELECT).eq("id", momentId).single();
    return toMoment(asRow(unwrap(result, "Cargar momento")));
  },

  async remove(db: Db, id: UUID): Promise<void> {
    unwrapVoid(await db.from("moments").delete().eq("id", id), "Eliminar momento");
  },
};
