import type { ItineraryItem, UUID } from "@/core/models";
import { asRow, asRows, type Db, unwrap, unwrapVoid } from "./base";
import { toItineraryItem } from "@/services/mappers";

const SELECT = "*, trip_place:trip_places(*, place:places(*))";

export interface ItineraryInput {
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  icon: string | null;
  tripPlaceId: UUID | null;
}

export const itineraryRepo = {
  async listByTrip(db: Db, tripId: UUID): Promise<ItineraryItem[]> {
    const result = await db
      .from("itinerary_items")
      .select(SELECT)
      .eq("trip_id", tripId)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false });

    return asRows(unwrap(result, "Listar itinerario")).map(toItineraryItem);
  },

  async create(db: Db, tripId: UUID, userId: UUID, input: ItineraryInput): Promise<ItineraryItem> {
    const result = await db
      .from("itinerary_items")
      .insert({
        trip_id: tripId,
        created_by: userId,
        title: input.title.trim(),
        description: input.description,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        icon: input.icon,
        trip_place_id: input.tripPlaceId,
      })
      .select(SELECT)
      .single();

    return toItineraryItem(asRow(unwrap(result, "Crear actividad")));
  },

  async update(db: Db, id: UUID, input: Partial<ItineraryInput>): Promise<ItineraryItem> {
    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.description !== undefined) payload.description = input.description;
    if (input.date !== undefined) payload.date = input.date;
    if (input.startTime !== undefined) payload.start_time = input.startTime;
    if (input.endTime !== undefined) payload.end_time = input.endTime;
    if (input.icon !== undefined) payload.icon = input.icon;
    if (input.tripPlaceId !== undefined) payload.trip_place_id = input.tripPlaceId;

    const result = await db
      .from("itinerary_items")
      .update(payload)
      .eq("id", id)
      .select(SELECT)
      .single();

    return toItineraryItem(asRow(unwrap(result, "Actualizar actividad")));
  },

  async remove(db: Db, id: UUID): Promise<void> {
    unwrapVoid(await db.from("itinerary_items").delete().eq("id", id), "Eliminar actividad");
  },
};
