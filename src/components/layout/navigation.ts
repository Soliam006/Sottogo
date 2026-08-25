export interface NavItem {
  key: string;
  label: string;
  icon: string;
  /** Segmento relativo a /trips/[tripId]. Cadena vacia = inicio. */
  segment: string;
  primary?: boolean;
}

export const TRIP_NAV: NavItem[] = [
  { key: "home", label: "Inicio", icon: "🏠", segment: "", primary: true },
  { key: "map", label: "Mapa", icon: "🗺️", segment: "map", primary: true },
  { key: "itinerary", label: "Itinerario", icon: "📅", segment: "itinerary" },
  { key: "places", label: "Lugares", icon: "📍", segment: "places" },
  { key: "expenses", label: "Gastos", icon: "💰", segment: "expenses", primary: true },
  { key: "gallery", label: "Galería", icon: "📸", segment: "gallery", primary: true },
  { key: "moments", label: "Momentos", icon: "✨", segment: "moments" },
  { key: "summary", label: "Resumen", icon: "🏆", segment: "summary" },
  { key: "checklist", label: "Preparación", icon: "✈️", segment: "checklist" },
  { key: "settings", label: "Configuración", icon: "⚙️", segment: "settings" },
];

export function tripHref(tripId: string, segment: string): string {
  return segment ? `/trips/${tripId}/${segment}` : `/trips/${tripId}`;
}
