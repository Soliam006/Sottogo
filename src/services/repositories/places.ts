import type { Place, TripPlace, TripPlaceStatus, UUID } from "@/core/models";
import type { PlaceSearchResult } from "@/core/places/types";
import { asRow, asRows, type Db, RepositoryError, unwrap, unwrapVoid } from "./base";
import { toPlace, toTripPlace } from "@/services/mappers";

const TRIP_PLACE_SELECT = "*, place:places(*)";

export interface AddTripPlaceInput {
  status?: TripPlaceStatus;
  notes?: string | null;
  rating?: number | null;
  visitedAt?: string | null;
  /** Foto de portada. `null` vuelve a la automatica. */
  coverPhotoId?: UUID | null;
}

export const placesRepo = {
  /**
   * Persiste un resultado del proveedor externo en el catalogo global.
   * Idempotente: si el lugar ya existe (mismo provider + externalPlaceId) lo reutiliza.
   */
  async upsertPlace(db: Db, result: PlaceSearchResult): Promise<Place> {
    const response = await db.rpc("upsert_place", {
      p_provider: result.provider,
      p_external_id: result.externalPlaceId,
      p_name: result.name,
      p_address: result.address,
      p_city: result.city,
      p_country: result.country,
      p_country_code: result.countryCode,
      p_lat: result.latitude,
      p_lng: result.longitude,
      p_category: result.category,
      p_image: result.image,
    });

    if (response.error) throw new RepositoryError(response.error.message, response.error);
    return toPlace(asRow(response.data));
  },

  /**
   * Lugares del catalogo global por id. Resuelve las coordenadas de lo que solo
   * guarda una referencia (por ejemplo el hotel de una reserva).
   */
  async listByIds(db: Db, ids: readonly UUID[]): Promise<Place[]> {
    if (ids.length === 0) return [];
    const result = await db.from("places").select("*").in("id", [...ids]);
    return asRows(unwrap(result, "Cargar lugares")).map(toPlace);
  },

  async listByTrip(db: Db, tripId: UUID): Promise<TripPlace[]> {
    const result = await db
      .from("trip_places")
      .select(TRIP_PLACE_SELECT)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    return asRows(unwrap(result, "Listar lugares")).map(toTripPlace);
  },

  /** Anade un lugar real al viaje. Si ya estaba, devuelve el existente. */
  async addToTrip(
    db: Db,
    tripId: UUID,
    userId: UUID,
    search: PlaceSearchResult,
    input: AddTripPlaceInput = {},
  ): Promise<TripPlace> {
    const place = await placesRepo.upsertPlace(db, search);

    const existing = await db
      .from("trip_places")
      .select(TRIP_PLACE_SELECT)
      .eq("trip_id", tripId)
      .eq("place_id", place.id)
      .maybeSingle();

    if (existing.data) return toTripPlace(asRow(existing.data));

    const result = await db
      .from("trip_places")
      .insert({
        trip_id: tripId,
        place_id: place.id,
        created_by: userId,
        status: input.status ?? "wishlist",
        notes: input.notes ?? null,
        rating: input.rating ?? null,
        visited_at: input.visitedAt ?? null,
      })
      .select(TRIP_PLACE_SELECT)
      .single();

    return toTripPlace(asRow(unwrap(result, "Añadir lugar al viaje")));
  },

  async update(db: Db, tripPlaceId: UUID, patch: AddTripPlaceInput): Promise<TripPlace> {
    const payload: Record<string, unknown> = {};
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.notes !== undefined) payload.notes = patch.notes;
    if (patch.rating !== undefined) payload.rating = patch.rating;
    if (patch.visitedAt !== undefined) payload.visited_at = patch.visitedAt;
    if (patch.coverPhotoId !== undefined) payload.cover_photo_id = patch.coverPhotoId;

    const result = await db
      .from("trip_places")
      .update(payload)
      .eq("id", tripPlaceId)
      .select(TRIP_PLACE_SELECT)
      .single();

    return toTripPlace(asRow(unwrap(result, "Actualizar lugar")));
  },

  async remove(db: Db, tripPlaceId: UUID): Promise<void> {
    unwrapVoid(await db.from("trip_places").delete().eq("id", tripPlaceId), "Eliminar lugar");
  },
};
