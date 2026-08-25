import type { Booking, BookingKind, UUID } from "@/core/models";
import { asRow, asRows, type Db, unwrap, unwrapVoid } from "./base";
import { toBooking } from "@/services/mappers";

/**
 * Reservas del viaje. Un unico repositorio para vuelos, alojamientos y coches:
 * comparten tabla y forma, y el `kind` decide como los lee la interfaz.
 */
export interface BookingInput {
  kind: BookingKind;
  provider: string;
  code: string | null;
  reference: string | null;
  /** RFC3339 o null. La UI trabaja con `datetime-local` y lo convierte. */
  startAt: string | null;
  endAt: string | null;
  fromLabel: string | null;
  fromPlaceId: UUID | null;
  fromTerminal: string | null;
  toLabel: string | null;
  toPlaceId: UUID | null;
  toTerminal: string | null;
  notes: string | null;
}

function payload(input: Partial<BookingInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.provider !== undefined) row.provider = input.provider.trim();
  if (input.code !== undefined) row.code = input.code;
  if (input.reference !== undefined) row.reference = input.reference;
  if (input.startAt !== undefined) row.start_at = input.startAt;
  if (input.endAt !== undefined) row.end_at = input.endAt;
  if (input.fromLabel !== undefined) row.from_label = input.fromLabel;
  if (input.fromPlaceId !== undefined) row.from_place_id = input.fromPlaceId;
  if (input.fromTerminal !== undefined) row.from_terminal = input.fromTerminal;
  if (input.toLabel !== undefined) row.to_label = input.toLabel;
  if (input.toPlaceId !== undefined) row.to_place_id = input.toPlaceId;
  if (input.toTerminal !== undefined) row.to_terminal = input.toTerminal;
  if (input.notes !== undefined) row.notes = input.notes;
  return row;
}

export const bookingsRepo = {
  async listByTrip(db: Db, tripId: UUID): Promise<Booking[]> {
    const result = await db
      .from("trip_bookings")
      .select("*")
      .eq("trip_id", tripId)
      .order("start_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    return asRows(unwrap(result, "Listar reservas")).map(toBooking);
  },

  async create(db: Db, tripId: UUID, userId: UUID, input: BookingInput): Promise<Booking> {
    const result = await db
      .from("trip_bookings")
      .insert({ trip_id: tripId, created_by: userId, ...payload(input) })
      .select("*")
      .single();

    return toBooking(asRow(unwrap(result, "Guardar reserva")));
  },

  async update(db: Db, id: UUID, input: Partial<BookingInput>): Promise<Booking> {
    const result = await db
      .from("trip_bookings")
      .update(payload(input))
      .eq("id", id)
      .select("*")
      .single();

    return toBooking(asRow(unwrap(result, "Actualizar reserva")));
  },

  async remove(db: Db, id: UUID): Promise<void> {
    unwrapVoid(await db.from("trip_bookings").delete().eq("id", id), "Eliminar reserva");
  },
};
