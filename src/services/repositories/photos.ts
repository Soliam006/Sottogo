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

export const photosRepo = {
  async listByTrip(db: Db, tripId: UUID): Promise<Photo[]> {
    const result = await db
      .from("photos")
      .select(PHOTO_SELECT)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    return asRows(unwrap(result, "Listar fotos")).map(toPhoto);
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
