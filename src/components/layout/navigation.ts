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

export interface NavItem {
  key: string;
  label: string;
  Icon: Icon;
  /** Segmento relativo a /trips/[tripId]. Cadena vacia = inicio. */
  segment: string;
  primary?: boolean;
}

export const TRIP_NAV: NavItem[] = [
  { key: "home", label: "Inicio", Icon: HomeIcon, segment: "", primary: true },
  { key: "map", label: "Mapa", Icon: MapIcon, segment: "map", primary: true },
  { key: "itinerary", label: "Itinerario", Icon: ItineraryIcon, segment: "itinerary" },
  { key: "places", label: "Lugares", Icon: PlaceIcon, segment: "places" },
  { key: "expenses", label: "Gastos", Icon: ExpenseIcon, segment: "expenses", primary: true },
  { key: "gallery", label: "Galería", Icon: GalleryIcon, segment: "gallery", primary: true },
  { key: "moments", label: "Momentos", Icon: MomentIcon, segment: "moments" },
  { key: "summary", label: "Resumen", Icon: SummaryIcon, segment: "summary" },
  { key: "checklist", label: "Preparación", Icon: ChecklistIcon, segment: "checklist" },
  { key: "settings", label: "Configuración", Icon: SettingsIcon, segment: "settings" },
];

export function tripHref(tripId: string, segment: string): string {
  return segment ? `/trips/${tripId}/${segment}` : `/trips/${tripId}`;
}
