import type { Photo, UUID } from "@/core/models";
import { asRow, asRows, type Db, unwrap, unwrapVoid } from "./base";
import { toPhoto } from "@/services/mappers";
import type { PreparedUpload } from "@/services/storage/photoStorage";

const PHOTO_SELECT = "*, trip_place:trip_places(*, place:places(*))";

export interface PhotoMetaInput {
  description: string | null;
  /** Lugar del itinerario (contexto general). Opcional. */
  tripPlaceId: UUID | null;
  /** Ubicacion EXACTA. No requiere tripPlaceId ni placeId. */
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
  placeId?: UUID | null;
  /** Si la foto debe aparecer en la Galeria. Por defecto si. */
  inGallery?: boolean;
}

/** Un lote de fotos y cuantas hay en total con ese mismo filtro. */
export interface PhotoPage {
  photos: Photo[];
  /** Total que cumple el filtro, no solo las de esta pagina. */
  total: number;
}

export interface PhotoPageQuery {
  limit: number;
  offset: number;
  /** Solo las marcadas para la Galeria. El filtro va en la CONSULTA. */
  onlyGallery: boolean;
}

export const photosRepo = {
  async listByTrip(db: Db, tripId: UUID): Promise<Photo[]> {
    const result = await db
      .from("photos")
      .select(PHOTO_SELECT)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    return asRows(unwrap(result, "Listar fotos")).map(toPhoto);
  },

  /**
   * Un lote de fotos del viaje.
   *
   * El desempate por `id` no es decorativo: con solo `created_at desc`, dos
   * fotos subidas en el mismo milisegundo pueden salir en distinto orden entre
   * dos peticiones, y entonces la pagina 2 repite o se salta filas de la 1.
   */
  async listPage(db: Db, tripId: UUID, query: PhotoPageQuery): Promise<PhotoPage> {
    let request = db
      .from("photos")
      .select(PHOTO_SELECT, { count: "exact" })
      .eq("trip_id", tripId);

    if (query.onlyGallery) request = request.eq("in_gallery", true);

    const result = await request
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    // PostgREST responde 416 (PGRST103) si el desplazamiento se pasa del final.
    // No es un fallo: significa que ya no queda nada, y pasa de verdad si
    // alguien borra fotos mientras otro esta navegando la galeria.
    if (result.error?.code === "PGRST103") {
      return { photos: [], total: result.count ?? 0 };
    }

    return {
      photos: asRows(unwrap(result, "Listar fotos")).map(toPhoto),
      total: result.count ?? 0,
    };
  },

  /**
   * Cuantas fotos hay, en total y en la galeria. `head: true` pide solo la
   * cuenta: no viaja ni una fila.
   */
  async countByTrip(db: Db, tripId: UUID): Promise<{ all: number; gallery: number }> {
    const [all, gallery] = await Promise.all([
      db.from("photos").select("id", { count: "exact", head: true }).eq("trip_id", tripId),
      db
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId)
        .eq("in_gallery", true),
    ]);

    // `unwrapVoid` y no `unwrap`: con `head: true` PostgREST no devuelve cuerpo,
    // asi que `data` es null y `unwrap` lo tomaria por un fallo. Lo unico que
    // interesa comprobar aqui es que no haya error; la cuenta viaja aparte.
    unwrapVoid(all, "Contar fotos");
    unwrapVoid(gallery, "Contar fotos de la galeria");
    return { all: all.count ?? 0, gallery: gallery.count ?? 0 };
  },

  async create(
    db: Db,
    tripId: UUID,
    userId: UUID,
    upload: PreparedUpload,
    meta: PhotoMetaInput,
  ): Promise<Photo> {
    const result = await db
      .from("photos")
      .insert({
        trip_id: tripId,
        uploaded_by: userId,
        storage_path: upload.storagePath,
        thumb_path: upload.thumbPath,
        width: upload.width,
        height: upload.height,
        taken_at: upload.takenAt,
        description: meta.description,
        trip_place_id: meta.tripPlaceId,
        latitude: meta.latitude,
        longitude: meta.longitude,
        location_name: meta.locationName ?? null,
        place_id: meta.placeId ?? null,
        in_gallery: meta.inGallery ?? true,
      })
      .select(PHOTO_SELECT)
      .single();

    return toPhoto(asRow(unwrap(result, "Guardar foto")));
  },

  async update(db: Db, photoId: UUID, patch: Partial<PhotoMetaInput & { featured: boolean }>): Promise<Photo> {
    const payload: Record<string, unknown> = {};
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.tripPlaceId !== undefined) payload.trip_place_id = patch.tripPlaceId;
    if (patch.latitude !== undefined) payload.latitude = patch.latitude;
    if (patch.longitude !== undefined) payload.longitude = patch.longitude;
    if (patch.locationName !== undefined) payload.location_name = patch.locationName;
    if (patch.placeId !== undefined) payload.place_id = patch.placeId;
    if (patch.featured !== undefined) payload.featured = patch.featured;
    if (patch.inGallery !== undefined) payload.in_gallery = patch.inGallery;

    const result = await db
      .from("photos")
      .update(payload)
      .eq("id", photoId)
      .select(PHOTO_SELECT)
      .single();

    return toPhoto(asRow(unwrap(result, "Actualizar foto")));
  },

  async remove(db: Db, photoId: UUID): Promise<void> {
    unwrapVoid(await db.from("photos").delete().eq("id", photoId), "Eliminar foto");
  },
};
