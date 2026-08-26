import {
  ChecklistIcon,
  ExpenseIcon,
  GalleryIcon,
  HomeIcon,
  ItineraryIcon,
  MapIcon,
  MomentIcon,
  PlaceIcon,
  SettingsIcon,
  SummaryIcon,
  type Icon,
} from "@/components/ui/icons";

import type { TripRole } from "@/core/models";
import { canAccessSection, type TripSection } from "@/core/access";

export interface NavItem {
  key: string;
  label: string;
  Icon: Icon;
  /** Segmento relativo a /trips/[tripId]. Cadena vacia = inicio. */
  segment: TripSection;
  primary?: boolean;
}

export const TRIP_NAV: NavItem[] = [
  { key: "home", label: "Inicio", Icon: HomeIcon, segment: "", primary: true },
  { key: "expenses", label: "Gastos", Icon: ExpenseIcon, segment: "expenses", primary: true },
  { key: "moments", label: "Momentos", Icon: MomentIcon, segment: "moments", primary: true },
  { key: "gallery", label: "Galería", Icon: GalleryIcon, segment: "gallery", primary: true },
  { key: "map", label: "Mapa", Icon: MapIcon, segment: "map"},
  { key: "itinerary", label: "Itinerario", Icon: ItineraryIcon, segment: "itinerary" },
  { key: "places", label: "Lugares", Icon: PlaceIcon, segment: "places" },
  { key: "checklist", label: "Preparación", Icon: ChecklistIcon, segment: "checklist" },
  { key: "summary", label: "Resumen", Icon: SummaryIcon, segment: "summary" },
  { key: "settings", label: "Configuración", Icon: SettingsIcon, segment: "settings" },
];

export function tripHref(tripId: string, segment: string): string {
  return segment ? `/trips/${tripId}/${segment}` : `/trips/${tripId}`;
}

/**
 * Navegacion del rol.
 *
 * Un visitante no ve huecos ni botones apagados: sencillamente su menu tiene
 * cuatro secciones. Las que no puede abrir no existen para el.
 */
export function navFor(role: TripRole | null): NavItem[] {
  return TRIP_NAV.filter((item) => canAccessSection(role, item.segment));
}
