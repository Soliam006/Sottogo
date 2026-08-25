"use client";

import type { BookingKind, ExpenseCategory } from "@/core/models";
import {
  BedIcon,
  CarRentalIcon,
  CoffeeIcon,
  FlightIcon,
  StayIcon,
  FlowerIcon,
  ForkKnifeIcon,
  GalleryIcon,
  GameControllerIcon,
  GiftIcon,
  MomentIcon,
  MountainsIcon,
  PackageIcon,
  PhotoIcon,
  PlaceIcon,
  ShoppingBagIcon,
  SignpostIcon,
  TicketIcon,
  TrainIcon,
  TripIcon,
  type Icon,
  type IconWeight,
} from "./icons";

/**
 * Traduce las CLAVES que viajan por el dominio y por la base de datos al
 * componente de icono correspondiente.
 *
 * `src/core` no conoce React a proposito, asi que guarda cadenas (`"food"`,
 * `"temple"`) y la traduccion vive aqui.
 */

const CATEGORY_ICONS: Record<ExpenseCategory, Icon> = {
  food: ForkKnifeIcon,
  accommodation: BedIcon,
  transport: TrainIcon,
  tickets: TicketIcon,
  shopping: ShoppingBagIcon,
  coffee: CoffeeIcon,
  gifts: GiftIcon,
  fun: GameControllerIcon,
  other: PackageIcon,
};

export function categoryIcon(category: ExpenseCategory): Icon {
  return CATEGORY_ICONS[category] ?? PackageIcon;
}

/** Icono de una categoria de gasto, listo para pintar. */
export function CategoryIcon({
  category,
  size = 18,
  weight = "fill",
  className,
}: {
  category: ExpenseCategory;
  size?: number;
  weight?: IconWeight;
  className?: string;
}) {
  const Glyph = categoryIcon(category);
  return <Glyph size={size} weight={weight} className={className} aria-hidden />;
}

const BOOKING_ICONS: Record<BookingKind, Icon> = {
  flight: FlightIcon,
  stay: StayIcon,
  car: CarRentalIcon,
};

/** Icono de un tipo de reserva (vuelo, alojamiento, coche). */
export function bookingIcon(kind: BookingKind): Icon {
  return BOOKING_ICONS[kind] ?? FlightIcon;
}

/**
 * Iconos elegibles al crear un punto del itinerario.
 *
 * El valor se guarda en `itinerary_items.icon`. Antes se guardaba el emoji en
 * crudo, asi que las filas anteriores traen "⛩️", "🍜"... `ItineraryIcon` las
 * sigue mostrando tal cual: no hace falta migrar datos.
 */
export const ITINERARY_ICONS: { key: string; label: string; Icon: Icon }[] = [
  { key: "place", label: "Lugar", Icon: PlaceIcon },
  { key: "food", label: "Comida", Icon: ForkKnifeIcon },
  { key: "coffee", label: "Café", Icon: CoffeeIcon },
  { key: "transport", label: "Transporte", Icon: TrainIcon },
  { key: "stay", label: "Alojamiento", Icon: BedIcon },
  { key: "ticket", label: "Entrada", Icon: TicketIcon },
  { key: "shopping", label: "Compras", Icon: ShoppingBagIcon },
  { key: "nature", label: "Naturaleza", Icon: MountainsIcon },
  { key: "temple", label: "Templo", Icon: FlowerIcon },
  { key: "photo", label: "Foto", Icon: PhotoIcon },
  { key: "moment", label: "Momento", Icon: MomentIcon },
  { key: "trip", label: "Viaje", Icon: TripIcon },
];

const ITINERARY_BY_KEY = new Map(ITINERARY_ICONS.map((entry) => [entry.key, entry.Icon]));

/**
 * Pinta el icono de un punto del itinerario.
 * Compatible hacia atras: si el valor guardado no es una clave conocida (los
 * emojis antiguos), se muestra el texto original.
 */
export function ItineraryItemIcon({
  icon,
  size = 16,
  weight = "fill",
  className,
}: {
  icon: string | null;
  size?: number;
  weight?: IconWeight;
  className?: string;
}) {
  if (!icon) return null;

  const Glyph = ITINERARY_BY_KEY.get(icon);
  if (Glyph) return <Glyph size={size} weight={weight} className={className} aria-hidden />;

  // Valor heredado (emoji guardado antes de migrar a iconos).
  return (
    <span className={className} style={{ fontSize: size, lineHeight: 1 }} aria-hidden>
      {icon}
    </span>
  );
}

export { GalleryIcon, SignpostIcon };
