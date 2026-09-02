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

/** Un lote de momentos y cuantos hay en total. */
export interface MomentPage {
  moments: Moment[];
  total: number;
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

  /**
   * Un lote de momentos del viaje.
   *
   * Igual que en las fotos, el desempate por `id` no es adorno: con solo
   * `date` y `created_at`, dos momentos del mismo instante pueden salir en
   * distinto orden entre dos peticiones, y entonces la pagina 2 repite o se
   * salta filas de la 1.
   */
  async listPage(db: Db, tripId: UUID, limit: number, offset: number): Promise<MomentPage> {
    const result = await db
      .from("moments")
      .select(SELECT, { count: "exact" })
      .eq("trip_id", tripId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    // 416: el desplazamiento se paso del final. No es un fallo, es que ya no
    // queda nada; pasa si alguien borra momentos mientras otro esta bajando.
    if (result.error?.code === "PGRST103") {
      return { moments: [], total: result.count ?? 0 };
    }

    return {
      moments: asRows(unwrap(result, "Listar momentos")).map(toMoment),
      total: result.count ?? 0,
    };
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
