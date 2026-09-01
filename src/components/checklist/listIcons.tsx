/**
 * Iconos que puede llevar una lista de preparacion.
 *
 * Vive aqui y no en `components/ui/iconFor` a proposito: es una eleccion propia
 * de esta seccion. Todos salen del set global (`components/ui/icons`), asi que
 * no se anade ni se cambia ningun icono de la aplicacion.
 */

import {
  CoffeeIcon,
  ForkKnifeIcon,
  GiftIcon,
  ListIcon,
  MapIcon,
  MomentIcon,
  MountainsIcon,
  PhotoIcon,
  PlaceIcon,
  ShoppingBagIcon,
  StarIcon,
  TicketIcon,
  TrainIcon,
  TripIcon,
  type Icon,
  type IconWeight,
} from "@/components/ui/icons";

export const LIST_ICONS: { key: string; label: string; Icon: Icon }[] = [
  { key: "checklist", label: "Lista", Icon: ListIcon },
  { key: "trip", label: "Equipaje", Icon: TripIcon },
  { key: "place", label: "Lugares", Icon: PlaceIcon },
  { key: "map", label: "Mapa", Icon: MapIcon },
  { key: "food", label: "Restaurantes", Icon: ForkKnifeIcon },
  { key: "coffee", label: "Cafés", Icon: CoffeeIcon },
  { key: "shopping", label: "Compras", Icon: ShoppingBagIcon },
  { key: "idea", label: "Ideas", Icon: MomentIcon },
  { key: "ticket", label: "Entradas", Icon: TicketIcon },
  { key: "transport", label: "Transporte", Icon: TrainIcon },
  { key: "nature", label: "Naturaleza", Icon: MountainsIcon },
  { key: "gift", label: "Regalos", Icon: GiftIcon },
  { key: "star", label: "Imprescindibles", Icon: StarIcon },
  { key: "photo", label: "Fotos", Icon: PhotoIcon },
];

const BY_KEY = new Map(LIST_ICONS.map((entry) => [entry.key, entry.Icon]));

export function listIconFor(icon: string): Icon {
  return BY_KEY.get(icon) ?? ListIcon;
}

export function ListIconGlyph({
  icon,
  size = 20,
  weight = "fill",
  className,
}: {
  icon: string;
  size?: number;
  weight?: IconWeight;
  className?: string;
}) {
  const Glyph = listIconFor(icon);
  return <Glyph size={size} weight={weight} className={className} aria-hidden />;
}
