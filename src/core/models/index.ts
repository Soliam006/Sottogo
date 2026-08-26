/**
 * Modelo de dominio de Voyago.
 *
 * Esta capa NO conoce React, Next ni Supabase: solo describe el negocio.
 * Los repositorios (src/services) traducen filas de base de datos a estos tipos.
 */

export type UUID = string;
export type ISODate = string;      // YYYY-MM-DD
export type ISODateTime = string;  // RFC3339

export type TripRole = "owner" | "member";
export type InvitationStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type TripPlaceStatus = "wishlist" | "visited";

export type ExpenseCategory =
  | "food"
  | "accommodation"
  | "transport"
  | "tickets"
  | "shopping"
  | "coffee"
  | "gifts"
  | "fun"
  | "other";

export interface UserProfile {
  id: UUID;
  name: string;
  username: string;
  uniqueCode: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: ISODateTime;
}

/** Identificador publico: `Nombre#Codigo` (ej. Will#4821). */
export interface PublicProfile {
  id: UUID;
  name: string;
  username: string;
  uniqueCode: string;
  avatarUrl: string | null;
}

export interface Trip {
  id: UUID;
  ownerId: UUID;
  name: string;
  destination: string;
  countryCode: string | null;
  startDate: ISODate;
  endDate: ISODate;
  coverImage: string | null;
  baseCurrency: string;
  createdAt: ISODateTime;
}

export interface TripMember {
  id: UUID;
  tripId: UUID;
  userId: UUID;
  role: TripRole;
  joinedAt: ISODateTime;
  profile: PublicProfile;
}

export interface TripInvitation {
  id: UUID;
  tripId: UUID;
  senderId: UUID;
  receiverId: UUID;
  status: InvitationStatus;
  createdAt: ISODateTime;
  respondedAt: ISODateTime | null;
  trip?: Pick<Trip, "id" | "name" | "destination" | "startDate" | "endDate" | "coverImage">;
  sender?: PublicProfile;
  receiver?: PublicProfile;
}

/** Lugar real del mundo, compartido entre viajes. */
export interface Place {
  id: UUID;
  provider: string;
  externalPlaceId: string | null;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  image: string | null;
}

/** Un `Place` en el contexto de un viaje concreto. */
export interface TripPlace {
  id: UUID;
  tripId: UUID;
  placeId: UUID;
  status: TripPlaceStatus;
  notes: string | null;
  rating: number | null;
  visitedAt: ISODate | null;
  createdBy: UUID | null;
  createdAt: ISODateTime;
  place: Place;
  /** Agregados calculados (opcionales, solo en vistas que los piden). */
  stats?: TripPlaceStats;
}

export interface TripPlaceStats {
  photoCount: number;
  expenseTotalBase: number;
  momentCount: number;
}

export interface Expense {
  id: UUID;
  tripId: UUID;
  createdBy: UUID | null;
  paidBy: UUID;
  amount: number;
  currency: string;
  convertedAmount: number | null;
  exchangeRate: number | null;
  description: string;
  category: ExpenseCategory;
  tripPlaceId: UUID | null;
  photoId: UUID | null;
  date: ISODate;
  createdAt: ISODateTime;
  tripPlace?: TripPlace | null;
  payer?: PublicProfile;
}

export interface Photo {
  id: UUID;
  tripId: UUID;
  uploadedBy: UUID | null;
  storagePath: string;
  thumbPath: string | null;
  width: number | null;
  height: number | null;
  description: string | null;
  tripPlaceId: UUID | null;
  /** Ubicacion EXACTA del recuerdo, independiente del lugar del itinerario. */
  latitude: number | null;
  longitude: number | null;
  /** Nombre libre del sitio exacto ("Omoide Yokocho"). Opcional. */
  locationName: string | null;
  /** Place real del catalogo, si la ubicacion vino de una busqueda. Opcional. */
  placeId: UUID | null;
  featured: boolean;
  /**
   * Visible en la Galeria. Una Photo es un recurso compartido: puede estar
   * asociada a momentos y gastos aunque no se muestre en la galeria.
   */
  inGallery: boolean;
  takenAt: ISODateTime | null;
  createdAt: ISODateTime;
  /** URL firmada, resuelta en runtime por PhotoStorage. */
  url?: string;
  thumbUrl?: string;
  uploader?: PublicProfile;
  tripPlace?: TripPlace | null;
}

export interface ItineraryItem {
  id: UUID;
  tripId: UUID;
  tripPlaceId: UUID | null;
  title: string;
  description: string | null;
  date: ISODate;
  startTime: string | null;
  endTime: string | null;
  icon: string | null;
  createdBy: UUID | null;
  createdAt: ISODateTime;
  tripPlace?: TripPlace | null;
}

export interface Moment {
  id: UUID;
  tripId: UUID;
  createdBy: UUID | null;
  title: string;
  description: string | null;
  tripPlaceId: UUID | null;
  /** Ubicacion EXACTA del recuerdo, independiente del lugar del itinerario. */
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  placeId: UUID | null;
  date: ISODate;
  rating: number | null;
  createdAt: ISODateTime;
  tripPlace?: TripPlace | null;
  photos?: Photo[];
  author?: PublicProfile;
}

/** Comentario de un momento. */
export interface MomentComment {
  id: UUID;
  momentId: UUID;
  tripId: UUID;
  authorId: UUID | null;
  body: string;
  createdAt: ISODateTime;
}

/** Vuelo, alojamiento o coche de alquiler. Ver `src/core/bookings`. */
export type BookingKind = "flight" | "stay" | "car";

export interface Booking {
  id: UUID;
  tripId: UUID;
  createdBy: UUID | null;
  kind: BookingKind;
  /** Aerolinea / nombre del hotel / compania de alquiler. */
  provider: string;
  /** Numero de vuelo. Solo lo usan los vuelos. */
  code: string | null;
  /** Localizador de la reserva. */
  reference: string | null;
  /** Salida / check-in / recogida. */
  startAt: ISODateTime | null;
  /** Llegada / check-out / devolucion. */
  endAt: ISODateTime | null;
  fromLabel: string | null;
  fromPlaceId: UUID | null;
  fromTerminal: string | null;
  toLabel: string | null;
  toPlaceId: UUID | null;
  toTerminal: string | null;
  notes: string | null;
  createdAt: ISODateTime;
}

export interface ChecklistItem {
  id: UUID;
  tripId: UUID;
  title: string;
  completed: boolean;
  position: number;
  createdBy: UUID | null;
  createdAt: ISODateTime;
}

export interface JournalEntry {
  id: UUID;
  tripId: UUID;
  createdBy: UUID | null;
  date: ISODate;
  title: string | null;
  content: string;
  createdAt: ISODateTime;
}

/** `Nombre#Codigo` */
export function formatHandle(p: Pick<PublicProfile, "name" | "uniqueCode">): string {
  return `${p.name}#${p.uniqueCode}`;
}
