/**
 * Traductores fila-de-BD -> modelo de dominio.
 *
 * Concentrar aqui el mapeo snake_case -> camelCase evita que la forma de la
 * base de datos se filtre a los componentes. Si en el futuro se generan los
 * tipos con `supabase gen types typescript`, solo cambia este fichero.
 */
import type {
  ChecklistItem,
  Expense,
  ItineraryItem,
  JournalEntry,
  Moment,
  Photo,
  Place,
  PublicProfile,
  Trip,
  TripInvitation,
  TripMember,
  TripPlace,
  UserProfile,
} from "@/core/models";

export type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);
const bool = (v: unknown): boolean => v === true;

export function toProfile(row: Row | null | undefined): PublicProfile {
  return {
    id: str(row?.id),
    name: str(row?.name),
    username: str(row?.username),
    uniqueCode: str(row?.unique_code),
    avatarUrl: strOrNull(row?.avatar_url),
  };
}

export function toUserProfile(row: Row): UserProfile {
  return {
    ...toProfile(row),
    email: strOrNull(row.email),
    createdAt: str(row.created_at),
  };
}

export function toTrip(row: Row): Trip {
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    name: str(row.name),
    destination: str(row.destination),
    countryCode: strOrNull(row.country_code),
    startDate: str(row.start_date),
    endDate: str(row.end_date),
    coverImage: strOrNull(row.cover_image),
    baseCurrency: str(row.base_currency) || "EUR",
    createdAt: str(row.created_at),
  };
}

export function toTripMember(row: Row): TripMember {
  return {
    id: str(row.id),
    tripId: str(row.trip_id),
    userId: str(row.user_id),
    role: row.role === "owner" ? "owner" : "member",
    joinedAt: str(row.joined_at),
    profile: toProfile(row.profile as Row),
  };
}

export function toInvitation(row: Row): TripInvitation {
  const trip = row.trip as Row | undefined;
  return {
    id: str(row.id),
    tripId: str(row.trip_id),
    senderId: str(row.sender_id),
    receiverId: str(row.receiver_id),
    status: (row.status as TripInvitation["status"]) ?? "pending",
    createdAt: str(row.created_at),
    respondedAt: strOrNull(row.responded_at),
    trip: trip
      ? {
          id: str(trip.id),
          name: str(trip.name),
          destination: str(trip.destination),
          startDate: str(trip.start_date),
          endDate: str(trip.end_date),
          coverImage: strOrNull(trip.cover_image),
        }
      : undefined,
    sender: row.sender ? toProfile(row.sender as Row) : undefined,
    receiver: row.receiver ? toProfile(row.receiver as Row) : undefined,
  };
}

export function toPlace(row: Row): Place {
  return {
    id: str(row.id),
    provider: str(row.provider) || "photon",
    externalPlaceId: strOrNull(row.external_place_id),
    name: str(row.name),
    address: strOrNull(row.address),
    city: strOrNull(row.city),
    country: strOrNull(row.country),
    countryCode: strOrNull(row.country_code),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    category: strOrNull(row.category),
    image: strOrNull(row.image),
  };
}

export function toTripPlace(row: Row): TripPlace {
  return {
    id: str(row.id),
    tripId: str(row.trip_id),
    placeId: str(row.place_id),
    status: row.status === "visited" ? "visited" : "wishlist",
    notes: strOrNull(row.notes),
    rating: numOrNull(row.rating),
    visitedAt: strOrNull(row.visited_at),
    createdBy: strOrNull(row.created_by),
    createdAt: str(row.created_at),
    place: toPlace((row.place as Row) ?? {}),
  };
}

export function toExpense(row: Row): Expense {
  return {
    id: str(row.id),
    tripId: str(row.trip_id),
    createdBy: strOrNull(row.created_by),
    paidBy: str(row.paid_by),
    amount: num(row.amount),
    currency: str(row.currency),
    convertedAmount: numOrNull(row.converted_amount),
    exchangeRate: numOrNull(row.exchange_rate),
    description: str(row.description),
    category: (row.category as Expense["category"]) ?? "other",
    tripPlaceId: strOrNull(row.trip_place_id),
    photoId: strOrNull(row.photo_id),
    date: str(row.date),
    createdAt: str(row.created_at),
    tripPlace: row.trip_place ? toTripPlace(row.trip_place as Row) : null,
  };
}

export function toPhoto(row: Row): Photo {
  return {
    id: str(row.id),
    tripId: str(row.trip_id),
    uploadedBy: strOrNull(row.uploaded_by),
    storagePath: str(row.storage_path),
    thumbPath: strOrNull(row.thumb_path),
    width: numOrNull(row.width),
    height: numOrNull(row.height),
    description: strOrNull(row.description),
    tripPlaceId: strOrNull(row.trip_place_id),
    latitude: numOrNull(row.latitude),
    longitude: numOrNull(row.longitude),
    locationName: strOrNull(row.location_name),
    placeId: strOrNull(row.place_id),
    featured: bool(row.featured),
    // Filas anteriores a la columna: se asumen visibles en la galeria.
    inGallery: row.in_gallery === undefined ? true : bool(row.in_gallery),
    takenAt: strOrNull(row.taken_at),
    createdAt: str(row.created_at),
    tripPlace: row.trip_place ? toTripPlace(row.trip_place as Row) : null,
  };
}

export function toItineraryItem(row: Row): ItineraryItem {
  return {
    id: str(row.id),
    tripId: str(row.trip_id),
    tripPlaceId: strOrNull(row.trip_place_id),
    title: str(row.title),
    description: strOrNull(row.description),
    date: str(row.date),
    startTime: strOrNull(row.start_time),
    endTime: strOrNull(row.end_time),
    icon: strOrNull(row.icon),
    createdBy: strOrNull(row.created_by),
    createdAt: str(row.created_at),
    tripPlace: row.trip_place ? toTripPlace(row.trip_place as Row) : null,
  };
}

export function toMoment(row: Row): Moment {
  const links = (row.moment_photos as Row[] | undefined) ?? [];
  return {
    id: str(row.id),
    tripId: str(row.trip_id),
    createdBy: strOrNull(row.created_by),
    title: str(row.title),
    description: strOrNull(row.description),
    tripPlaceId: strOrNull(row.trip_place_id),
    latitude: numOrNull(row.latitude),
    longitude: numOrNull(row.longitude),
    locationName: strOrNull(row.location_name),
    placeId: strOrNull(row.place_id),
    date: str(row.date),
    rating: numOrNull(row.rating),
    createdAt: str(row.created_at),
    tripPlace: row.trip_place ? toTripPlace(row.trip_place as Row) : null,
    photos: links.map((link) => toPhoto((link.photo as Row) ?? {})),
  };
}

export function toChecklistItem(row: Row): ChecklistItem {
  return {
    id: str(row.id),
    tripId: str(row.trip_id),
    title: str(row.title),
    completed: bool(row.completed),
    position: num(row.position),
    createdBy: strOrNull(row.created_by),
    createdAt: str(row.created_at),
  };
}

export function toJournalEntry(row: Row): JournalEntry {
  return {
    id: str(row.id),
    tripId: str(row.trip_id),
    createdBy: strOrNull(row.created_by),
    date: str(row.date),
    title: strOrNull(row.title),
    content: str(row.content),
    createdAt: str(row.created_at),
  };
}
