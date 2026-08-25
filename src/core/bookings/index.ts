/**
 * Reservas del viaje: vuelos, alojamientos y coche de alquiler.
 *
 * Los tres comparten forma (un proveedor, un localizador, un inicio y un fin y,
 * a veces, un origen y un destino), asi que comparten tipo y tabla. Lo que
 * cambia es COMO se llama cada cosa en cada caso, y eso vive en `BOOKING_KINDS`.
 *
 * Anadir un tipo nuevo (tren, ferry, actividad) es anadir una entrada aqui y un
 * valor al enum de la base de datos: ni el formulario ni la vista cambian.
 *
 * Capa pura: sin React, sin Supabase.
 */

import type { Booking, BookingKind, ISODateTime } from "@/core/models";

/** Que campos usa un tipo de reserva y como se llaman en su contexto. */
export interface BookingKindConfig {
  kind: BookingKind;
  /** Nombre de la pestana. */
  label: string;
  /** Singular, para botones y titulos ("Anadir vuelo"). */
  singular: string;
  emptyTitle: string;
  emptyHint: string;
  /** Clave del icono; la traduce `components/ui/iconFor`. */
  icon: string;

  providerLabel: string;
  providerPlaceholder: string;

  /** Numero de vuelo y similares. `null` = el tipo no lo usa. */
  codeLabel: string | null;
  codePlaceholder?: string;

  startLabel: string;
  endLabel: string;

  /** Origen. `null` = el tipo no lo usa. */
  fromLabel: string | null;
  /** Destino. `null` = el tipo solo tiene una ubicacion. */
  toLabel: string | null;
  /** Si se piden terminales (solo vuelos). */
  terminals: boolean;
}

export const BOOKING_KINDS: BookingKindConfig[] = [
  {
    kind: "flight",
    label: "Vuelos",
    singular: "vuelo",
    emptyTitle: "Todavía no tienes vuelos",
    emptyHint: "Guarda la ida, la vuelta y las escalas para tenerlo todo a mano.",
    icon: "flight",
    providerLabel: "Aerolínea",
    providerPlaceholder: "Iberia, ANA, Ryanair…",
    codeLabel: "Número de vuelo",
    codePlaceholder: "IB6800",
    startLabel: "Salida",
    endLabel: "Llegada",
    fromLabel: "Origen",
    toLabel: "Destino",
    terminals: true,
  },
  {
    kind: "stay",
    label: "Hoteles",
    singular: "alojamiento",
    emptyTitle: "Todavía no tienes alojamientos",
    emptyHint: "Añade dónde duermes cada noche y sus horarios de entrada y salida.",
    icon: "stay",
    providerLabel: "Nombre",
    providerPlaceholder: "Hotel Gracery Shinjuku",
    codeLabel: null,
    startLabel: "Check-in",
    endLabel: "Check-out",
    fromLabel: "Ubicación",
    toLabel: null,
    terminals: false,
  },
  {
    kind: "car",
    label: "Coche",
    singular: "alquiler",
    emptyTitle: "Todavía no tienes coches de alquiler",
    emptyHint: "Guarda dónde recoges y dónde devuelves el coche, y a qué hora.",
    icon: "car",
    providerLabel: "Compañía",
    providerPlaceholder: "Hertz, Europcar…",
    codeLabel: null,
    startLabel: "Recogida",
    endLabel: "Devolución",
    fromLabel: "Lugar de recogida",
    toLabel: "Lugar de devolución",
    terminals: false,
  },
];

const BY_KIND = new Map(BOOKING_KINDS.map((c) => [c.kind, c]));

export function bookingConfig(kind: BookingKind): BookingKindConfig {
  return BY_KIND.get(kind) ?? BOOKING_KINDS[0];
}

/** Reservas de un tipo, de la mas proxima a la mas lejana. */
export function bookingsOfKind(bookings: readonly Booking[], kind: BookingKind): Booking[] {
  return bookings
    .filter((b) => b.kind === kind)
    .sort((a, b) => compareStart(a.startAt, b.startAt));
}

/** Sin fecha van al final: son las que menos ayudan a planificar. */
function compareStart(a: ISODateTime | null, b: ISODateTime | null): number {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

/** Duracion en noches, para alojamientos. `null` si faltan fechas. */
export function nights(booking: Booking): number | null {
  if (!booking.startAt || !booking.endAt) return null;
  const ms = new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** Valida un borrador antes de guardar. Devuelve el primer problema. */
export function validateBooking(
  draft: { provider: string; startAt: string; endAt: string },
  config: BookingKindConfig,
): string | null {
  if (draft.provider.trim().length < 2) {
    return `Indica ${article(config.providerLabel)} ${config.providerLabel.toLowerCase()}.`;
  }
  if (draft.startAt && draft.endAt && draft.endAt < draft.startAt) {
    return `La fecha de ${config.endLabel.toLowerCase()} no puede ser anterior a la de ${config.startLabel.toLowerCase()}.`;
  }
  return null;
}

function article(label: string): string {
  return /^[aeiou]/i.test(label) || label === "Aerolínea" ? "la" : "el";
}
